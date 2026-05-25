"""LLM client facade — re-exports active provider's public surface.

This file used to host all Gemini-specific logic. After the multi-provider
migration, the implementation lives in `services/llm_providers/{gemini,claude}.py`
and is selected at runtime by the `LLM_PROVIDER` env var (default: claude).

All 9 dependent modules import from `services.gemini_client` so this shim
keeps their import paths and call signatures unchanged:

    from services.gemini_client import gemini_json, GEMINI_FLASH, GEMINI_PRO

Switch providers without redeploying code:
    LLM_PROVIDER=claude   (default) → AWS Bedrock + Claude Haiku 4.5
    LLM_PROVIDER=gemini             → Google AI Studio (legacy path)

Override individual model tiers (Bedrock only):
    BEDROCK_FLASH_MODEL_ID, BEDROCK_PRO_MODEL_ID, BEDROCK_PREVIEW_MODEL_ID
"""
from services.llm_providers import get_provider
from services.llm_providers.base import LLMRetriesExhaustedError

_provider = get_provider()

# Public model constants — these names are imported all over the codebase.
# They resolve to whichever provider is active at module-load time.
GEMINI_FLASH = _provider.FLASH
GEMINI_PRO = _provider.PRO
GEMINI_PREVIEW = _provider.PREVIEW


def gemini_json(
    prompt=None,
    max_tokens: int = 8192,
    temperature: float = 0.3,
    model: str = None,
    max_retries: int = 2,
    schema: dict = None,
    parts: list = None,
) -> dict:
    """Primary entry point used by all service modules.

    Routes to the active provider's `json()` implementation. Signature is
    preserved from the original Gemini-only version so callers don't change.
    """
    return _provider.json(
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        model=model or _provider.PRO,
        max_retries=max_retries,
        schema=schema,
        parts=parts,
    )


def get_gemini_client():
    """Backward-compat shim. Returns the active provider's raw client when
    available (Gemini exposes one). For Claude, returns the boto3 Bedrock
    runtime client. Most callers should switch to `gemini_json` + provider
    abstractions rather than touching the client directly."""
    return _provider.lazy_client()


def get_active_provider():
    """Escape hatch for the small number of callsites that need provider-
    specific behavior (multimodal PDF parts, tool-calling orchestrator)."""
    return _provider


# Convenience re-exports — some callsites import these from gemini_client too.
clean_json_response = getattr(_provider, "clean_json_response", None)

__all__ = [
    "gemini_json",
    "get_gemini_client",
    "get_active_provider",
    "GEMINI_FLASH",
    "GEMINI_PRO",
    "GEMINI_PREVIEW",
    "LLMRetriesExhaustedError",
    "clean_json_response",
]
