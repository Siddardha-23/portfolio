"""LLM client facade for the chat service — re-exports active provider.

The chat service originally exposed a single `get_gemini_client()` returning
the raw `google.genai.Client`. After the multi-provider migration, callers
should prefer the abstractions in `services.llm_providers`:

    from services.llm_providers import get_provider
    text = get_provider().text(prompt=..., system=..., history=...)

This shim is kept for the orchestrator (`agents/orchestrator.py`) which
still uses the raw Gemini tool-calling client directly — its SSE streaming
loop is more involved than the abstraction supports today, so it bypasses
the provider system and goes straight to `google.genai`. That callsite
imports `get_gemini_client()` from here.

Note: this shim ALWAYS returns the Gemini client regardless of
LLM_PROVIDER, because the orchestrator uses Gemini-specific API surfaces
(`types.FunctionDeclaration`, `Part.from_function_response`, etc.) that
have no Claude equivalent without a full refactor.
"""
import logging

logger = logging.getLogger(__name__)

_client = None


def get_gemini_client():
    """Lazy-load the Gemini client (kept on Gemini for the orchestrator).

    Other chat callsites should use `services.llm_providers.get_provider()`
    instead — it routes through Bedrock + Claude by default.
    """
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
