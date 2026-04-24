"""
Agent blueprint — exposes the multi-agent orchestrator to the frontend.

Routes:
    POST /api/chat/agent       — Server-Sent Events stream of one orchestrated turn
    GET  /api/chat/diary       — recent Cloud Diary entries
    GET  /api/chat/diary/latest — newest Cloud Diary entry (powers the Now Building ticker)
    GET  /api/chat/specialists — static metadata about the four specialists
"""
from __future__ import annotations

import json
import logging
from typing import Generator

from flask import Blueprint, Response, jsonify, request, stream_with_context

from utils.security import InputSanitizer, get_client_ip, get_rate_limiter

agent_bp = Blueprint("agent", __name__)
logger = logging.getLogger(__name__)


def _sse(event: str, data: dict) -> str:
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


@agent_bp.route("/agent", methods=["POST", "OPTIONS"])
def agent():
    if request.method == "OPTIONS":
        return "", 204

    client_ip = get_client_ip(request)
    rate_limiter = get_rate_limiter()
    if rate_limiter.is_rate_limited(f"agent:{client_ip}", max_requests=12, window_seconds=60):
        return jsonify({"error": "Too many requests. Please slow down.", "success": False}), 429

    try:
        data = request.get_json(force=True) or {}
    except Exception:
        return jsonify({"error": "Invalid JSON", "success": False}), 400

    raw_message = data.get("message", "")
    if not isinstance(raw_message, str) or not raw_message.strip():
        return jsonify({"error": "Message is required", "success": False}), 400
    if InputSanitizer.check_nosql_injection(raw_message):
        return jsonify({"error": "Invalid input", "success": False}), 400
    message = InputSanitizer.sanitize_string(raw_message, max_length=1500)
    if not message:
        return jsonify({"error": "Message is required", "success": False}), 400

    raw_history = data.get("history") or []
    history = []
    if isinstance(raw_history, list):
        for entry in raw_history[-20:]:
            if not isinstance(entry, dict):
                continue
            role = entry.get("role")
            content = entry.get("content")
            if role in ("user", "model") and isinstance(content, str) and content.strip():
                history.append({
                    "role": role,
                    "content": InputSanitizer.sanitize_string(content, max_length=3000),
                })

    # Import inside the request so cold start doesn't pay this cost on health checks
    from agents import run_agent_stream

    @stream_with_context
    def stream() -> Generator[str, None, None]:
        try:
            for event_name, payload in run_agent_stream(message, history):
                yield _sse(event_name, payload)
        except Exception as exc:
            logger.exception("Agent stream crashed")
            yield _sse("error", {"message": "Agent crashed mid-stream."})
            yield _sse("done", {"latency_ms": 0, "specialists_used": [], "final_text": str(exc)[:300]})

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    }
    return Response(stream(), headers=headers)


@agent_bp.route("/diary", methods=["GET"])
def diary_recent():
    from tools.diary_tools import get_cloud_diary
    limit = request.args.get("limit", "5")
    try:
        n = int(limit)
    except ValueError:
        n = 5
    result = get_cloud_diary(limit=n)
    status = 200 if result.get("ok") else 503
    return jsonify(result), status


@agent_bp.route("/diary/latest", methods=["GET"])
def diary_latest():
    from tools.diary_tools import get_latest_diary
    result = get_latest_diary()
    status = 200 if result.get("ok") else 503
    return jsonify(result), status


@agent_bp.route("/specialists", methods=["GET"])
def specialists():
    from tools.registry import SPECIALIST_META
    items = [{"id": sid, **meta} for sid, meta in SPECIALIST_META.items()]
    return jsonify({"ok": True, "data": {"specialists": items}})
