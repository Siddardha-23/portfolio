"""Claude provider — Anthropic Claude on AWS Bedrock.

Uses the Bedrock InvokeModel API with the Anthropic Messages API body shape:
  {
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": N,
    "system": "...",
    "messages": [{"role": "...", "content": [...]}],
    "tools": [{"name", "description", "input_schema"}],
    "tool_choice": {"type": "tool", "name": "..."}  # optional, forces tool use
  }

Default models (override via env): Haiku 4.5 across all three tiers
(FLASH / PRO / PREVIEW). Haiku 4.5 is benchmark-competitive with Gemini 2.5
Pro on structured extraction and tailoring, so a single model is enough.
"""
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

from .base import LLMProvider, LLMRetriesExhaustedError
from ._json_repair import (
    try_parse_json,
    python_schema_to_json_schema,
    repair_truncated_json,
)

logger = logging.getLogger(__name__)


_MAX_ORCHESTRATOR_ROUNDS = 6
_ORCHESTRATOR_DEADLINE_SECONDS = 25.0
_BEDROCK_ANTHROPIC_VERSION = "bedrock-2023-05-31"


def _model_id(env_key: str, default: str) -> str:
    """Read a model ID from env or fall back to default. Lets us upgrade
    Haiku → Sonnet for a single tier without code changes."""
    return os.getenv(env_key, default).strip() or default


class ClaudeProvider(LLMProvider):
    """Claude on Bedrock implementation.

    Default model strategy: Haiku 4.5 across all tiers — it's the cost/quality
    sweet spot for the portfolio's workload (parsing, JD analysis, tailoring,
    scoring, chat orchestration). Each tier can be independently bumped to
    Sonnet via env var if a specific feature needs more horsepower:

      BEDROCK_FLASH_MODEL_ID    — used by parse, repair, simple extraction
      BEDROCK_PRO_MODEL_ID      — used by tailor, scorer, JD analysis
      BEDROCK_PREVIEW_MODEL_ID  — used by JSON repair / correction tier

    Model IDs follow the standard Bedrock pattern:
      anthropic.claude-haiku-4-5-<date>-v1:0
      anthropic.claude-sonnet-4-6-<date>-v1:0
    Cross-region inference profiles work too (prefix with `us.`).
    """

    FLASH = _model_id("BEDROCK_FLASH_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
    PRO = _model_id("BEDROCK_PRO_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
    PREVIEW = _model_id("BEDROCK_PREVIEW_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")

    def __init__(self):
        self._client = None

    # ------------------------------------------------------------------
    # Client lifecycle (boto3 Bedrock Runtime)
    # ------------------------------------------------------------------

    def _bedrock(self):
        if self._client is not None:
            return self._client
        import boto3
        region = os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION_NAME") or os.getenv("AWS_REGION") or "us-east-1"
        self._client = boto3.client("bedrock-runtime", region_name=region)
        return self._client

    def lazy_client(self):
        return self._bedrock()

    # ------------------------------------------------------------------
    # Low-level invoke with retry
    # ------------------------------------------------------------------

    def _invoke(self, body: dict, model: str, max_retries: int = 2) -> dict:
        """Call bedrock-runtime InvokeModel and return the parsed response."""
        last_error = None
        for attempt in range(max_retries + 1):
            try:
                resp = self._bedrock().invoke_model(
                    modelId=model,
                    body=json.dumps(body),
                    contentType="application/json",
                    accept="application/json",
                )
                return json.loads(resp["body"].read())
            except Exception as e:
                last_error = e
                if attempt == max_retries:
                    break
                wait = 2 ** attempt
                logger.warning(
                    f"Bedrock InvokeModel error (attempt {attempt + 1}/{max_retries + 1}) "
                    f"model={model}, retrying in {wait}s: {e}"
                )
                time.sleep(wait)

        raise LLMRetriesExhaustedError(
            f"AI service unavailable after {max_retries + 1} attempts: {last_error}"
        )

    # ------------------------------------------------------------------
    # JSON / text mode — uses tool-use trick for guaranteed structured output
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
        model = model or self.PRO

        # Build the user message content blocks. `parts` (if provided) was
        # built via build_pdf_parts() and is already in Claude's content-block
        # shape. Otherwise we wrap the prompt in a single text block.
        if parts:
            content_blocks = parts
        else:
            content_blocks = [{"type": "text", "text": prompt or ""}]

        body: Dict[str, Any] = {
            "anthropic_version": _BEDROCK_ANTHROPIC_VERSION,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": content_blocks}],
        }

        if schema is not None:
            # Force structured output by giving Claude a single tool whose
            # input_schema is the desired JSON shape, and require it to call
            # that tool. This is Anthropic's recommended pattern.
            json_schema = python_schema_to_json_schema(schema)
            body["tools"] = [{
                "name": "submit_response",
                "description": "Return the structured response to the user's request.",
                "input_schema": json_schema,
            }]
            body["tool_choice"] = {"type": "tool", "name": "submit_response"}

        response = self._invoke(body, model=model, max_retries=max_retries)

        # Extract the dict result depending on whether we forced tool use.
        result: Optional[dict] = None
        for block in response.get("content", []):
            block_type = block.get("type")
            if schema is not None and block_type == "tool_use":
                # tool-use payload is already a dict (parsed JSON)
                result = block.get("input") or {}
                break
            if schema is None and block_type == "text":
                raw = (block.get("text") or "").strip()
                if not raw:
                    continue
                # Without schema, attempt JSON parse with multi-strategy repair.
                try:
                    result = json.loads(raw)
                except json.JSONDecodeError as e:
                    logger.warning(f"Claude JSON decode failed, attempting repair. Raw: {raw[:500]}")
                    result = try_parse_json(raw)
                    if result is None:
                        raise ValueError(f"AI returned invalid format: {e}")
                break

        if result is None:
            raise ValueError("AI returned an empty response. Please try again.")

        # Optional Python-side coercion to fill defaults / coerce types.
        if schema is not None:
            try:
                from schemas.resume_schemas import validate_and_coerce
                result = validate_and_coerce(result, schema)
            except ValueError as e:
                logger.warning(f"Python-side coercion failed: {e}")
                raise

        return result

    # ------------------------------------------------------------------
    # Multimodal PDF — Claude has native PDF support via `document` blocks
    # ------------------------------------------------------------------

    def build_pdf_parts(
        self,
        prompt_text: str,
        pdf_bytes: bytes,
        mime_type: str = "application/pdf",
    ) -> list:
        """Build Anthropic content blocks for an inline PDF + prompt.

        Claude on Bedrock accepts PDFs directly as a `document` block. For
        DOCX (mime_type != application/pdf) we fall back to extracting text
        upstream; passing the bytes here would fail Claude validation.
        """
        import base64 as _b64
        if mime_type == "application/pdf":
            return [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": _b64.b64encode(pdf_bytes).decode("ascii"),
                    },
                },
                {"type": "text", "text": prompt_text},
            ]
        # Non-PDF (e.g. DOCX): caller should have pre-extracted text and
        # passed it via the prompt. Return text-only parts as a safety net.
        return [{"type": "text", "text": prompt_text}]

    # ------------------------------------------------------------------
    # Tool calling — ReAct loop using Claude's native tool use
    # ------------------------------------------------------------------

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
        """Multi-round tool-calling loop. Translates the caller's Gemini-style
        function declarations (`{"name", "description", "parameters"}`) into
        Claude tool specs (`{"name", "description", "input_schema"}`)."""
        pipeline_log: List[Dict[str, Any]] = []
        start_ts = time.time()

        claude_tools = [
            {
                "name": t["name"],
                "description": t.get("description", ""),
                "input_schema": t.get("parameters") or {"type": "object", "properties": {}},
            }
            for t in tools
        ]

        messages: List[Dict[str, Any]] = [
            {"role": "user", "content": [{"type": "text", "text": user_message}]},
        ]

        model = self.FLASH
        last_text = ""

        for round_num in range(max_rounds):
            if (time.time() - start_ts) > deadline_seconds:
                return (
                    "I started processing your request but hit a time limit. "
                    "Try a narrower follow-up.",
                    pipeline_log,
                )

            body = {
                "anthropic_version": _BEDROCK_ANTHROPIC_VERSION,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "system": system_text,
                "messages": messages,
                "tools": claude_tools,
            }

            try:
                response = self._invoke(body, model=model, max_retries=1)
            except Exception as e:
                logger.exception("Orchestrator round %d failed: %s", round_num, e)
                if model == self.FLASH and self.PRO != self.FLASH:
                    model = self.PRO
                    try:
                        response = self._invoke(body, model=model, max_retries=1)
                    except Exception as e2:
                        logger.exception("Orchestrator fallback failed: %s", e2)
                        return ("I could not generate a response — try again.", pipeline_log)
                else:
                    return ("I could not generate a response — try again.", pipeline_log)

            content_blocks = response.get("content", [])
            stop_reason = response.get("stop_reason")

            tool_use_blocks = [b for b in content_blocks if b.get("type") == "tool_use"]
            text_blocks = [b for b in content_blocks if b.get("type") == "text"]
            last_text = "\n".join((b.get("text") or "") for b in text_blocks)

            # Append assistant turn verbatim so tool_use IDs match in the next user turn.
            messages.append({"role": "assistant", "content": content_blocks})

            # No more tool calls? We're done.
            if stop_reason != "tool_use" and not tool_use_blocks:
                final_text = last_text or "I could not generate a response."
                return (final_text, pipeline_log)

            # Execute every requested tool and post results.
            tool_results_content: List[Dict[str, Any]] = []
            for block in tool_use_blocks:
                if (time.time() - start_ts) > deadline_seconds:
                    return (
                        "I completed part of your request but hit a time limit while running tools.",
                        pipeline_log,
                    )

                tool_name = block.get("name")
                tool_args = block.get("input") or {}
                tool_use_id = block.get("id")

                logger.info(
                    "Orchestrator round %d: calling tool %s(%s)",
                    round_num, tool_name, list(tool_args.keys()),
                )
                try:
                    result, agent_tag = execute_tool(tool_name, tool_args)
                except Exception as e:
                    logger.exception("Tool %s execution failed: %s", tool_name, e)
                    result, agent_tag = {"error": str(e)}, "error"

                pipeline_log.append({
                    "agent": agent_tag,
                    "label": tool_name,
                    "summary": f"Called {tool_name} with {list(tool_args.keys())}",
                    "round": round_num,
                })

                result_str = json.dumps(result, default=str)[:8000]
                tool_results_content.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": result_str,
                })

            messages.append({"role": "user", "content": tool_results_content})

        return (last_text or "Reached maximum tool-calling rounds.", pipeline_log)
