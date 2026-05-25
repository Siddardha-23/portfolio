"""LLM provider abstraction with runtime selection via `LLM_PROVIDER` env var.

Default: `claude` (Anthropic Claude on AWS Bedrock).
Fallback: `gemini` (Google AI Studio) — flip `LLM_PROVIDER=gemini` to revert.

The public surface (`gemini_json`, `GEMINI_FLASH`, etc.) is kept under the
original `services.gemini_client` import path so the 9 dependent files stay
untouched. Internally, both names route to whichever provider is active.
"""
import os
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_provider():
    """Return the active LLM provider instance (cached per-process)."""
    name = (os.getenv("LLM_PROVIDER") or "claude").strip().lower()

    if name == "gemini":
        from .gemini import GeminiProvider
        logger.info("LLM provider: gemini (Google AI Studio)")
        return GeminiProvider()

    # Default: Claude on Bedrock
    from .claude import ClaudeProvider
    logger.info("LLM provider: claude (AWS Bedrock)")
    return ClaudeProvider()
