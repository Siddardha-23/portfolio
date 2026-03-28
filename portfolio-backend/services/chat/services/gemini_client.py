"""
Gemini API Client singleton for the Chat microservice.

Lazy-loads the google-genai client using the GEMINI_API_KEY
from SSM Parameter Store (Lambda) or environment variable (local).
"""
import logging

logger = logging.getLogger(__name__)

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
