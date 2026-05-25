"""Gemini provider — Google AI Studio + google-genai SDK.

Ports the original `gemini_client.py` (singleton client, structured output,
multi-strategy JSON parsing, ReAct tool calling) into a class that conforms
to the `LLMProvider` interface so it's interchangeable with `ClaudeProvider`.
"""
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from .base import LLMProvider, LLMRetriesExhaustedError

logger = logging.getLogger(__name__)


_MAX_ORCHESTRATOR_ROUNDS = 6
_ORCHESTRATOR_DEADLINE_SECONDS = 25.0


class GeminiProvider(LLMProvider):
    """Gemini implementation. Keeps the exact public behavior of the
    pre-migration `gemini_client.py` so flipping `LLM_PROVIDER=gemini`
    restores the original code path bit-for-bit."""

    FLASH = "gemini-2.5-flash"
    PRO = "gemini-2.5-pro"
    PREVIEW = "gemini-2.5-flash"

    def __init__(self):
        self._client = None

    # ------------------------------------------------------------------
    # Client lifecycle
    # ------------------------------------------------------------------

    def lazy_client(self):
        """Lazy-load the Gemini client to avoid cold-start penalty for
        non-AI requests."""
        if self._client is not None:
            return self._client

        from utils.config import _get_config_value
        api_key = _get_config_value("GEMINI_API_KEY", "")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        from google import genai
        self._client = genai.Client(api_key=api_key)
        return self._client

    # ------------------------------------------------------------------
    # JSON helpers (lifted unchanged from original gemini_client.py)
    # ------------------------------------------------------------------

    @staticmethod
    def clean_json_response(text: str) -> str:
        t = text.strip()
        if t.startswith("```"):
            t = re.sub(r"^```(?:json)?\s*\n?", "", t)
            t = re.sub(r"\n?```\s*$", "", t)
        for end_char in ("}", "]"):
            idx = t.rfind(end_char)
            if idx != -1:
                t = t[: idx + 1]
                break
        return t.strip()

    @staticmethod
    def _to_openapi_schema(spec) -> dict:
        if spec is str:
            return {"type": "STRING"}
        if spec is int:
            return {"type": "INTEGER"}
        if spec is float:
            return {"type": "NUMBER"}
        if isinstance(spec, list) and len(spec) == 1:
            return {"type": "ARRAY", "items": GeminiProvider._to_openapi_schema(spec[0])}
        if isinstance(spec, dict) and "_dict_of" in spec:
            inner = GeminiProvider._to_openapi_schema(spec["_dict_of"])
            return {"type": "OBJECT", "additionalProperties": inner}
        if isinstance(spec, dict):
            props = {k: GeminiProvider._to_openapi_schema(v) for k, v in spec.items()}
            return {"type": "OBJECT", "properties": props}
        return {"type": "STRING"}

    @staticmethod
    def _try_parse_json(raw: str) -> Optional[dict]:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        cleaned = GeminiProvider.clean_json_response(raw)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        repaired = GeminiProvider._repair_truncated_json(raw)
        if repaired:
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass

        return None

    @staticmethod
    def _repair_truncated_json(raw: str) -> str:
        if not raw or not raw.lstrip().startswith('{'):
            return ""

        text = raw.rstrip()
        in_string = False
        last_good = 0
        for i, ch in enumerate(text):
            if ch == '"' and (i == 0 or text[i - 1] != '\\'):
                in_string = not in_string
            if not in_string and ch in ',]}':
                last_good = i

        if in_string:
            text = text[:last_good + 1] if last_good > 0 else text

        opens = 0
        open_arrays = 0
        for ch in text:
            if ch == '{':
                opens += 1
            elif ch == '}':
                opens -= 1
            elif ch == '[':
                open_arrays += 1
            elif ch == ']':
                open_arrays -= 1

        text = text.rstrip().rstrip(',')
        text += ']' * max(0, open_arrays) + '}' * max(0, opens)
        return text

    # ------------------------------------------------------------------
    # Low-level call with retry
    # ------------------------------------------------------------------

    def _call(
        self,
        prompt: Optional[str] = None,
        tokens: int = 8192,
        temperature: float = 0.3,
        model: Optional[str] = None,
        max_retries: int = 2,
        response_schema: Optional[dict] = None,
        parts: Optional[list] = None,
    ):
        from google.genai import types
        client = self.lazy_client()
        model = model or self.PRO

        user_parts = parts if parts else [types.Part.from_text(text=prompt)]

        config_kwargs = {
            "response_mime_type": "application/json",
            "temperature": temperature,
            "max_output_tokens": tokens,
        }
        if response_schema:
            config_kwargs["response_schema"] = response_schema

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                return client.models.generate_content(
                    model=model,
                    contents=[types.Content(role="user", parts=user_parts)],
                    config=types.GenerateContentConfig(**config_kwargs),
                )
            except Exception as e:
                last_error = e
                if attempt == max_retries:
                    break
                wait = 2 ** attempt
                logger.warning(
                    f"Gemini API error (attempt {attempt + 1}/{max_retries + 1}), "
                    f"retrying in {wait}s: {e}"
                )
                time.sleep(wait)

        raise LLMRetriesExhaustedError(
            f"AI service unavailable after {max_retries + 1} attempts: {last_error}"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def json(
        self,
        prompt: Optional[str] = None,
        max_tokens: int = 8192,
        temperature: float = 0.3,
        model: Optional[str] = None,
        max_retries: int = 2,
        schema: Optional[dict] = None,
        parts: Optional[list] = None,
    ) -> dict:
        openapi_schema = self._to_openapi_schema(schema) if schema else None

        response = self._call(
            prompt=prompt,
            tokens=max_tokens,
            temperature=temperature,
            model=model,
            max_retries=max_retries,
            response_schema=openapi_schema,
            parts=parts,
        )

        raw = (response.text or "").strip()
        if not raw:
            raise ValueError("AI returned an empty response. Please try again.")

        try:
            result = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning(f"Gemini JSON decode failed, attempting repair. Raw: {raw[:500]}")
            result = self._try_parse_json(raw)
            if result is None:
                raise ValueError(f"AI returned invalid format: {e}")

        if schema is not None:
            try:
                from schemas.resume_schemas import validate_and_coerce
                result = validate_and_coerce(result, schema)
            except ValueError as e:
                logger.warning(f"Python-side coercion failed: {e}")
                raise

        return result

    def text(
        self,
        prompt: str,
        max_tokens: int = 1024,
        temperature: float = 0.5,
        model: Optional[str] = None,
        max_retries: int = 2,
        system: Optional[str] = None,
        history: Optional[list] = None,
    ) -> str:
        """Plain text conversational generation via Gemini.

        `history` shape: [{"role": "user"|"assistant"|"model", "content": str}].
        Gemini's API uses "model" for assistant turns; "assistant" is mapped.
        """
        from google.genai import types
        client = self.lazy_client()
        model = model or self.FLASH

        contents: List[Any] = []
        for turn in (history or []):
            role = turn.get("role", "user")
            if role == "assistant":
                role = "model"
            elif role not in ("user", "model"):
                role = "user"
            content = (turn.get("content") or "")[:8000]
            if not content:
                continue
            contents.append(types.Content(role=role, parts=[types.Part(text=content)]))

        contents.append(types.Content(role="user", parts=[types.Part(text=prompt)]))

        config_kwargs = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        if system:
            config_kwargs["system_instruction"] = system

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(**config_kwargs),
                )
                return (response.text or "").strip()
            except Exception as e:
                last_error = e
                if attempt == max_retries:
                    break
                time.sleep(2 ** attempt)

        raise LLMRetriesExhaustedError(
            f"Gemini text generation failed after {max_retries + 1} attempts: {last_error}"
        )

    def build_pdf_parts(
        self,
        prompt_text: str,
        pdf_bytes: bytes,
        mime_type: str = "application/pdf",
    ) -> list:
        from google.genai import types
        # Text-only fallback (no PDF available): single text part.
        if not pdf_bytes or mime_type == "text/plain":
            return [types.Part.from_text(text=prompt_text)]
        return [
            types.Part.from_bytes(data=pdf_bytes, mime_type=mime_type),
            types.Part.from_text(text=prompt_text),
        ]

    def tool_call(
        self,
        system_text: str,
        user_message: str,
        tools: List[Dict[str, Any]],
        execute_tool,
        max_rounds: int = _MAX_ORCHESTRATOR_ROUNDS,
        deadline_seconds: float = _ORCHESTRATOR_DEADLINE_SECONDS,
        temperature: float = 0.35,
        max_tokens: int = 2800,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        from google.genai import types
        client = self.lazy_client()
        pipeline_log: List[Dict[str, Any]] = []
        start_ts = time.time()

        tool_config = types.Tool(function_declarations=tools)
        contents = [
            types.Content(role="user", parts=[
                types.Part.from_text(text=system_text),
                types.Part.from_text(text=f"USER_MESSAGE:\n{user_message}"),
            ]),
        ]

        # Match the prior behavior: prefer Flash; on error fall back to Pro.
        model = self.FLASH
        text_parts: List[str] = []

        for round_num in range(max_rounds):
            if (time.time() - start_ts) > deadline_seconds:
                return (
                    "I started processing your request but hit a time limit. "
                    "Try a narrower follow-up.",
                    pipeline_log,
                )

            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                        max_output_tokens=max_tokens,
                        tools=[tool_config],
                    ),
                )
            except Exception as e:
                logger.exception("Orchestrator round %d failed: %s", round_num, e)
                if model == self.FLASH:
                    model = self.PRO
                    try:
                        response = client.models.generate_content(
                            model=model,
                            contents=contents,
                            config=types.GenerateContentConfig(
                                temperature=0.4,
                                max_output_tokens=2200,
                                tools=[tool_config],
                            ),
                        )
                    except Exception as e2:
                        logger.exception("Orchestrator fallback failed: %s", e2)
                        return ("I could not generate a response — try again.", pipeline_log)
                else:
                    return ("I could not generate a response — try again.", pipeline_log)

            candidate = response.candidates[0] if response.candidates else None
            if not candidate or not candidate.content or not candidate.content.parts:
                return ("I could not generate a response — try again.", pipeline_log)

            has_function_calls = False
            text_parts = []
            function_call_parts = []
            for part in candidate.content.parts:
                if part.function_call:
                    has_function_calls = True
                    function_call_parts.append(part)
                elif part.text:
                    text_parts.append(part.text)

            if not has_function_calls:
                final_text = "\n".join(text_parts) if text_parts else "I could not generate a response."
                return (final_text, pipeline_log)

            contents.append(candidate.content)

            function_response_parts = []
            for part in function_call_parts:
                if (time.time() - start_ts) > deadline_seconds:
                    return (
                        "I completed part of your request but hit a time limit while running tools.",
                        pipeline_log,
                    )

                fc = part.function_call
                tool_name = fc.name
                tool_args = dict(fc.args) if fc.args else {}

                logger.info("Orchestrator round %d: calling tool %s(%s)", round_num, tool_name, list(tool_args.keys()))
                result, agent_tag = execute_tool(tool_name, tool_args)

                pipeline_log.append({
                    "agent": agent_tag,
                    "label": tool_name,
                    "summary": f"Called {tool_name} with {list(tool_args.keys())}",
                    "round": round_num,
                })

                result_str = json.dumps(result, default=str)[:8000]
                function_response_parts.append(
                    types.Part.from_function_response(
                        name=tool_name,
                        response={"result": result_str},
                    )
                )

            contents.append(types.Content(role="user", parts=function_response_parts))

        final_text = "\n".join(text_parts) if text_parts else "Reached maximum tool-calling rounds."
        return (final_text, pipeline_log)
