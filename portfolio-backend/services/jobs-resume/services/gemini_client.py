"""
Shared Gemini API Client — Singleton, Model Routing, and JSON Helpers.

This module is the single point of contact between the application and the
Google Gemini API. All AI-calling code (parser, tailor, scorer, project
generator) imports from here instead of duplicating client initialization.

Capabilities:
  - Lazy-loaded client singleton (avoids cold-start penalty on non-AI requests)
  - Exponential-backoff retry on transient API errors
  - Multi-modal content support (text + inline PDF bytes)
  - Optional native Structured Output enforcement via response_schema
  - Multi-strategy JSON extraction fallback for non-schema responses

Model routing constants (import these, don't hardcode model names):
  ┌─────────────────┬──────────────────────────────────────────────────┐
  │ GEMINI_FLASH    │ Gemini 2.5 Flash — fast extraction, parsing (GA) │
  │ GEMINI_PRO      │ Gemini 3.1 Pro — tailoring, scoring, JD parse   │
  │ GEMINI_PREVIEW  │ Gemini 3.1 Pro — error-correction / repair only │
  └─────────────────┴──────────────────────────────────────────────────┘
"""
import json
import logging
import re
import time

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model routing constants
# ---------------------------------------------------------------------------
GEMINI_FLASH   = "gemini-2.5-flash"          # extraction / factual parsing (GA, stable)
GEMINI_PRO     = "gemini-2.5-pro"            # JD-based tailoring (GA, stable)
GEMINI_PREVIEW = "gemini-3.1-pro-preview"    # repair / correction only

# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------

_client = None


def get_gemini_client():
    """Lazy-load the Gemini client to avoid cold-start penalty for non-AI requests."""
    global _client
    if _client is not None:
        return _client

    from utils.config import _get_config_value
    api_key = _get_config_value("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    from google import genai
    _client = genai.Client(api_key=api_key)
    return _client


# ---------------------------------------------------------------------------
# JSON response helpers
# ---------------------------------------------------------------------------

def clean_json_response(text: str) -> str:
    """Strip markdown fences and trailing garbage from a Gemini response.

    Gemini sometimes wraps JSON in ```json ... ``` blocks or appends
    extra text after the closing brace. This function cleans both.

    Args:
        text: Raw Gemini response text.

    Returns:
        Cleaned string that should be valid JSON.
    """
    t = text.strip()
    # Remove ```json ... ``` wrappers
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*\n?", "", t)
        t = re.sub(r"\n?```\s*$", "", t)
    # Trim anything after the last closing brace/bracket
    for end_char in ("}", "]"):
        idx = t.rfind(end_char)
        if idx != -1:
            t = t[: idx + 1]
            break
    return t.strip()
def _to_openapi_schema(spec) -> dict:
    """Recursively convert custom Python schema dicts to Gemini OpenAPI JSON schema.

    Handles the custom schema DSL used by PARSED_RESUME_SCHEMA:
      - Python types (str, int, float) → OpenAPI type strings
      - [spec]                         → ARRAY with items
      - {"_dict_of": spec}            → OBJECT with additionalProperties
      - {key: spec, ...}              → OBJECT with properties

    Note: Gemini's structured output API has limited support for
    additionalProperties, so _dict_of schemas may not be fully enforced.
    See resume_parser.py module docstring for the workaround.

    Args:
        spec: A Python schema definition (type, list, or dict).

    Returns:
        OpenAPI-compatible JSON schema dict for use with Gemini's response_schema.
    """
    if spec is str:
        return {"type": "STRING"}
    if spec is int:
        return {"type": "INTEGER"}
    if spec is float:
        return {"type": "NUMBER"}
    if isinstance(spec, list) and len(spec) == 1:
        return {"type": "ARRAY", "items": _to_openapi_schema(spec[0])}
    if isinstance(spec, dict) and "_dict_of" in spec:
        # Dynamic Record<string, T> — use additionalProperties to hint value type
        return {"type": "OBJECT", "additionalProperties": _to_openapi_schema(spec["_dict_of"])}
    if isinstance(spec, dict):
        properties = {}
        for k, v in spec.items():
            properties[k] = _to_openapi_schema(v)
        return {"type": "OBJECT", "properties": properties}
    return {"type": "STRING"}


def _call_gemini(
    client,
    prompt: str = None,
    tokens: int = 8192,
    temperature: float = 0.3,
    model: str = GEMINI_PRO,
    max_retries: int = 2,
    response_schema: dict = None,
    parts: list = None,
):
    """Low-level Gemini API call with retry, structured output, and multi-modal support.

    Supports two input modes:
      - Simple: pass a `prompt` string.
      - Multi-modal: pass a `parts` list (e.g., inline PDF + text instructions).

    When `response_schema` is provided, Gemini's native Structured Output mode
    guarantees the response is valid JSON matching the schema.

    Uses exponential backoff (1s, 2s, 4s) on transient API errors.

    Args:
        client: google.genai.Client instance.
        prompt: Plain text prompt (ignored if `parts` is provided).
        tokens: Maximum output tokens.
        temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative).
        model: Gemini model name (use module constants).
        max_retries: Number of retry attempts on transient errors.
        response_schema: Optional OpenAPI schema for Structured Output enforcement.
        parts: Optional list of types.Part for multi-modal input.

    Returns:
        google.genai.types.GenerateContentResponse object.

    Raises:
        ValueError: If all retry attempts are exhausted.
    """
    from google.genai import types

    # Support either prompt string or rich parts list (e.g. inline PDFs)
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

    raise ValueError(f"AI service unavailable after {max_retries + 1} attempts: {last_error}")


def _try_parse_json(raw: str) -> dict:
    """Attempt to parse JSON from a Gemini response with multi-strategy fallback.

    Strategy cascade (stops at first success):
      1. Direct json.loads on the raw text.
      2. Clean markdown fences / trailing garbage, then parse.
      3. Regex-extract the largest {...} block from mixed text, then parse.

    Args:
        raw: Raw text from Gemini's response.

    Returns:
        Parsed dict, or None if all strategies fail.
    """
    # Strategy 1: direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Strategy 2: clean markdown fences and trailing garbage
    cleaned = clean_json_response(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Strategy 3: extract embedded JSON object from mixed text
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Strategy 4: repair truncated JSON by closing open structures
    repaired = _repair_truncated_json(raw)
    if repaired:
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

    return None


def _repair_truncated_json(raw: str) -> str:
    """Attempt to repair truncated JSON by closing unclosed brackets/strings.

    Handles the common case where Gemini's output is cut off mid-string,
    leaving unterminated strings, arrays, and objects.
    """
    if not raw or not raw.lstrip().startswith('{'):
        return ""

    # Remove any trailing incomplete string value (cut mid-sentence)
    # Find the last complete JSON value boundary
    text = raw.rstrip()

    # If we're inside an unterminated string, close it
    in_string = False
    last_good = 0
    for i, ch in enumerate(text):
        if ch == '"' and (i == 0 or text[i - 1] != '\\'):
            in_string = not in_string
        if not in_string and ch in ',]}':
            last_good = i

    if in_string:
        # Truncate to last complete value and close the string
        text = text[:last_good + 1] if last_good > 0 else text

    # Count unclosed brackets and close them
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

    # Remove trailing comma before closing
    text = text.rstrip().rstrip(',')
    text += ']' * max(0, open_arrays) + '}' * max(0, opens)

    return text


def gemini_json(
    prompt: str = None,
    max_tokens: int = 8192,
    temperature: float = 0.3,
    model: str = GEMINI_PRO,
    max_retries: int = 2,
    schema: dict = None,
    parts: list = None,
) -> dict:
    """High-level API: call Gemini and return a validated JSON dict.

    This is the primary function all service modules should use. It:
      1. Converts the Python schema dict to OpenAPI format (if provided).
      2. Calls Gemini with response_mime_type="application/json".
      3. Parses the response text as JSON.
      4. Optionally runs validate_and_coerce against the Python schema.

    When `schema` is provided AND the schema doesn't contain unsupported
    features (like _dict_of), the native response_schema param guarantees
    valid JSON output from the API. For schemas with _dict_of, callers
    should omit `schema` and rely on prompt + post-call validation.

    Args:
        prompt: Text prompt (ignored if `parts` is provided).
        max_tokens: Maximum output tokens.
        temperature: Sampling temperature.
        model: Model name (use GEMINI_FLASH / GEMINI_PRO / GEMINI_PREVIEW).
        max_retries: Number of retries on API errors.
        schema: Optional Python schema dict for output validation.
        parts: Optional multi-modal parts list.

    Returns:
        Parsed and optionally validated JSON dict.

    Raises:
        ValueError: If the response is empty or not valid JSON.
    """
    client = get_gemini_client()

    openapi_schema = _to_openapi_schema(schema) if schema else None

    # We don't need token-doubling retry loops for JSON truncation anymore,
    # because 'response_schema' forces complete, valid JSON output.
    response = _call_gemini(
        client=client,
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

    # Try standard JSON parse first, fall back to repair for truncated output
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"Gemini JSON decode failed, attempting repair. Raw: {raw[:500]}")
        result = _try_parse_json(raw)
        if result is None:
            raise ValueError(f"AI returned invalid format: {e}")

    # Optionally run our Python-side default coercion/validation
    # to catch any edge cases that the loose OpenAPI schema missed
    if schema is not None:
        try:
            from schemas.resume_schemas import validate_and_coerce
            result = validate_and_coerce(result, schema)
        except ValueError as e:
            logger.warning(f"Python-side coercion failed: {e}")
            raise  # Don't return invalid data — callers must handle this

    return result
