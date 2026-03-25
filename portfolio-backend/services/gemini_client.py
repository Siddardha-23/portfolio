"""
Shared Gemini API client — lazy-loaded singleton + JSON response helpers.

All AI-calling code imports from here instead of duplicating client init.
Includes exponential backoff on API errors and JSON extraction fallbacks.
"""
import json
import logging
import re
import time

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-3.1-pro-preview"

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
    """Strip markdown fences and trailing garbage from a Gemini response."""
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


def _call_gemini(client, prompt: str, tokens: int, temperature: float, max_retries: int = 2):
    """Call Gemini API with exponential backoff on transient errors."""
    from google.genai import types

    last_error = None
    for attempt in range(max_retries + 1):
        try:
            return client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=temperature,
                    max_output_tokens=tokens,
                ),
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
    """Attempt to parse JSON from a Gemini response with multiple fallback strategies."""
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

    return None


def gemini_json(
    prompt: str,
    max_tokens: int = 8192,
    temperature: float = 0.3,
    max_retries: int = 2,
    schema: dict = None,
) -> dict:
    """Call Gemini and parse JSON response.

    Retries with exponential backoff on API errors.
    Retries once with doubled tokens on JSON truncation.
    Uses multiple JSON extraction strategies as fallback.

    If *schema* is provided, validates the parsed result against it and
    retries on schema validation failure. Default None preserves backward
    compatibility for all existing callers.
    """
    client = get_gemini_client()

    for token_attempt, tokens in enumerate([max_tokens, max_tokens * 2]):
        response = _call_gemini(client, prompt, tokens, temperature, max_retries)

        raw = (response.text or "").strip()
        if not raw:
            if token_attempt == 0:
                logger.warning("Gemini returned empty response, retrying with more tokens")
                continue
            raise ValueError("AI returned an empty response. Please try again.")

        result = _try_parse_json(raw)
        if result is not None:
            # Optional schema-aware validation
            if schema is not None:
                try:
                    from schemas.resume_schemas import validate_and_coerce
                    return validate_and_coerce(result, schema)
                except ValueError as e:
                    if token_attempt == 0:
                        logger.warning(
                            "Schema validation failed (%s), retrying with more tokens", e
                        )
                        continue
                    logger.warning(
                        "Schema validation failed on final attempt (%s), returning raw", e
                    )
            return result

        # JSON parse failed — likely truncated, retry with more tokens
        if token_attempt == 0:
            logger.warning(f"JSON truncated (tokens={tokens}), retrying with {tokens * 2}")
            continue

        logger.error(f"Gemini invalid JSON after retry. Raw (first 500): {raw[:500]}")
        raise ValueError("AI returned an invalid response. Please try again.")
