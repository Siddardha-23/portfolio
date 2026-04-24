"""
Agent tools — pure functions the orchestrator and specialists can call.

Each tool follows the contract:
    def name(**kwargs) -> dict
        return {"ok": bool, "data": ..., "error": str | None, "meta": ...}

`TOOL_REGISTRY` maps tool name → (callable, specialist_id, gemini_declaration).
The Gemini declaration uses the SDK's FunctionDeclaration JSON schema so the
orchestrator can do native function calling.
"""
from .registry import TOOL_REGISTRY, gemini_tools, dispatch, get_tool_meta

__all__ = ["TOOL_REGISTRY", "gemini_tools", "dispatch", "get_tool_meta"]
