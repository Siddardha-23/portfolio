"""Chat blueprint - AI chatbot endpoint powered by Google Gemini."""
from flask import Blueprint, request, jsonify
import logging

from utils.security import InputSanitizer, get_rate_limiter, get_client_ip

chat_bp = Blueprint('chat', __name__)
logger = logging.getLogger(__name__)


@chat_bp.route('', methods=['POST'])
def chat():
    """
    Process a chat message and return an AI-generated response.

    Request body:
        message (str): The user's message (max 500 chars).
        history (list, optional): Previous conversation turns,
            each with 'role' ('user'|'model') and 'content' (str).

    Returns:
        JSON with 'response' and 'success' fields.
    """
    # Retired — see services/sunset.py. Same constant reply for every input,
    # so it short-circuits ahead of rate limiting and validation.
    from services.sunset import SUNSET_REPLY
    return jsonify({'response': SUNSET_REPLY, 'success': True}), 200

    # Rate limit: 10 requests per minute per IP
    client_ip = get_client_ip(request)
    rate_limiter = get_rate_limiter()
    if rate_limiter.is_rate_limited(f"chat:{client_ip}", max_requests=10, window_seconds=60):
        return jsonify({'error': 'Too many requests. Please wait a moment.', 'success': False}), 429

    try:
        data = request.get_json(force=True) or {}
    except Exception:
        return jsonify({'error': 'Invalid JSON', 'success': False}), 400

    # Validate and sanitize message
    raw_message = data.get('message', '')
    if not raw_message or not isinstance(raw_message, str):
        return jsonify({'error': 'Message is required', 'success': False}), 400

    if InputSanitizer.check_nosql_injection(raw_message):
        logger.warning(f"NoSQL injection attempt in chat from {client_ip}")
        return jsonify({'error': 'Invalid input', 'success': False}), 400

    message = InputSanitizer.sanitize_string(raw_message, max_length=500)
    if not message:
        return jsonify({'error': 'Message is required', 'success': False}), 400

    # Validate and sanitize history
    raw_history = data.get('history', [])
    history = None
    if raw_history:
        if not isinstance(raw_history, list):
            return jsonify({'error': 'History must be a list', 'success': False}), 400

        history = []
        for entry in raw_history[:20]:
            if not isinstance(entry, dict):
                continue
            role = entry.get('role', '')
            content = entry.get('content', '')
            if role not in ('user', 'model') or not isinstance(content, str):
                continue
            sanitized_content = InputSanitizer.sanitize_string(content, max_length=2000)
            if sanitized_content:
                history.append({'role': role, 'content': sanitized_content})

    try:
        from services.chat_service import generate_response
        response_text = generate_response(message, history)
        return jsonify({'response': response_text, 'success': True}), 200
    except RuntimeError as e:
        if 'not configured' in str(e).lower():
            logger.error(f"Chat service not configured: {e}")
            return jsonify({'error': 'Chat service is not available', 'success': False}), 503
        logger.error(f"Chat runtime error: {e}")
        return jsonify({'error': 'Failed to generate response', 'success': False}), 500
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return jsonify({'error': 'Failed to generate response', 'success': False}), 500
