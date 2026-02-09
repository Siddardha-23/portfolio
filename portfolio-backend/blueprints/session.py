"""Session management blueprint"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from services.session_service import get_session_service
import logging

session_bp = Blueprint('session', __name__)
logger = logging.getLogger(__name__)


@session_bp.route('/validate', methods=['POST'])
def validate_session():
    """
    Validate a session ID and return session info.
    Creates a new session if the provided ID doesn't exist.
    """
    try:
        data = request.get_json(force=True) or {}
        session_id = data.get('session_id', '')
        
        if not session_id:
            return jsonify({
                'valid': False,
                'error': 'Session ID required'
            }), 400
        
        # Get IP address
        if request.headers.getlist("X-Forwarded-For"):
            ip_address = request.headers.getlist("X-Forwarded-For")[0]
        else:
            ip_address = request.remote_addr
        
        user_agent = request.headers.get('User-Agent', 'unknown')
        
        session_service = get_session_service()
        session = session_service.create_or_get_session(session_id, ip_address, user_agent)
        
        return jsonify({
            'valid': True,
            'session_id': session_id,
            'is_new': session.get('is_new', False),
            'page_views': session.get('page_views', 1),
            'is_tracked': session.get('is_tracked', False)
        }), 200
        
    except Exception as e:
        logger.error(f"Error validating session: {e}")
        return jsonify({'error': 'Session validation failed'}), 500


@session_bp.route('/track-page', methods=['POST'])
def track_page_view():
    """
    Track a page view for an existing session.
    This doesn't create a new visitor entry, just updates session stats.
    """
    try:
        data = request.get_json(force=True) or {}
        session_id = data.get('session_id', '')
        page = data.get('page', 'unknown')
        
        if not session_id:
            return jsonify({'error': 'Session ID required'}), 400
        
        session_service = get_session_service()
        session_service.add_page_visit(session_id, page)
        
        return jsonify({
            'success': True,
            'message': 'Page view tracked'
        }), 200
        
    except Exception as e:
        logger.error(f"Error tracking page view: {e}")
        return jsonify({'error': 'Failed to track page view'}), 500


@session_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_session_stats():
    """Get session statistics (protected endpoint)"""
    try:
        session_service = get_session_service()
        stats = session_service.get_session_stats()
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Error getting session stats: {e}")
        return jsonify({'error': 'Failed to get session stats'}), 500
