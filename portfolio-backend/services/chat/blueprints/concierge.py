"""Concierge blueprint - drives the animated AI avatar on the portfolio home page."""
from flask import Blueprint, request, jsonify
import logging

from utils.security import InputSanitizer, get_rate_limiter, get_client_ip

concierge_bp = Blueprint("concierge", __name__)
logger = logging.getLogger(__name__)


@concierge_bp.route("/concierge", methods=["POST"])
def concierge():
    """
    Single-turn Concierge endpoint.

    Request body:
        message (str, required, ≤ 500 chars)
        history (list[{role, content}], optional, ≤ 16 turns)
        current_section (str, optional)
        recruiter_mode (bool, optional)

    Returns:
        { spoken, caption, intents[], display|null, suggestions[], emotion, meta{} }
    """
    # Retired — see services/sunset.py. Answered before rate limiting and
    # input validation because the reply is constant: there is no input that
    # produces a different one, and no reason to 429 someone out of reading it.
    from services.sunset import concierge_envelope
    return jsonify(concierge_envelope()), 200

    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()

    # Slightly tighter than chat: 8/min (Pro tier is more expensive)
    if limiter.is_rate_limited(f"concierge:{client_ip}", max_requests=8, window_seconds=60):
        return jsonify({"error": "Too many requests. Please wait a moment.", "success": False}), 429

    try:
        data = request.get_json(force=True) or {}
    except Exception:
        return jsonify({"error": "Invalid JSON", "success": False}), 400

    raw_message = data.get("message", "")
    if not raw_message or not isinstance(raw_message, str):
        return jsonify({"error": "Message is required", "success": False}), 400

    if InputSanitizer.check_nosql_injection(raw_message):
        logger.warning(f"NoSQL injection attempt in concierge from {client_ip}")
        return jsonify({"error": "Invalid input", "success": False}), 400

    message = InputSanitizer.sanitize_string(raw_message, max_length=500)
    if not message:
        return jsonify({"error": "Message is required", "success": False}), 400

    # History
    raw_history = data.get("history", [])
    history = []
    if isinstance(raw_history, list):
        for entry in raw_history[:16]:
            if not isinstance(entry, dict):
                continue
            role = entry.get("role", "")
            content = entry.get("content", "")
            if role not in ("user", "model") or not isinstance(content, str):
                continue
            sanitized = InputSanitizer.sanitize_string(content, max_length=2000)
            if sanitized:
                history.append({"role": role, "content": sanitized})

    current_section = InputSanitizer.sanitize_string(str(data.get("current_section", "")), max_length=32)
    recruiter_mode = bool(data.get("recruiter_mode"))

    try:
        from services.concierge_service import generate_concierge_turn, resolve_tailor_resume_intent

        envelope = generate_concierge_turn(
            message=message,
            history=history,
            current_section=current_section or None,
            recruiter_mode=recruiter_mode,
        )

        # Resolve server-side tool calls (currently: JD tailoring)
        for it in envelope.get("intents", []):
            if it["name"] == "tailor_resume_to_jd":
                payload = resolve_tailor_resume_intent(it["args"].get("jd_text", ""))
                if payload:
                    envelope["display"] = {"type": "JDMatchCard", "payload": payload}
                break

        envelope["success"] = True
        return jsonify(envelope), 200

    except Exception as e:
        logger.exception(f"Concierge error: {e}")
        return jsonify({
            "spoken": "Something glitched. Try again?",
            "caption": "Service error.",
            "intents": [], "display": None, "suggestions": [], "emotion": "thoughtful",
            "success": False,
        }), 200  # 200 so frontend still gets a usable envelope
