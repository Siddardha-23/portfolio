"""IP Geolocation blueprint"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from services.ip_service import get_ip_service
import logging

geo_bp = Blueprint('geolocation', __name__)
logger = logging.getLogger(__name__)


@geo_bp.route('/lookup', methods=['POST'])
def lookup_ip():
    """
    Look up geolocation info for an IP address.
    Can be used by frontend to get location info.
    """
    try:
        data = request.get_json(force=True) or {}
        
        # Get IP - prefer client-provided, fallback to request IP
        ip_address = data.get('ip')
        
        if not ip_address:
            # Use request IP
            if request.headers.getlist("X-Forwarded-For"):
                ip_address = request.headers.getlist("X-Forwarded-For")[0]
            else:
                ip_address = request.remote_addr
        
        ip_service = get_ip_service()
        ip_info = ip_service.get_ip_info(ip_address)
        
        # Remove internal fields for response
        response_info = {
            'ip': ip_info.get('ip'),
            'city': ip_info.get('city'),
            'region': ip_info.get('region'),
            'country': ip_info.get('country'),
            'country_name': ip_info.get('country_name'),
            'timezone': ip_info.get('timezone'),
            'org': ip_info.get('org'),
            'latitude': ip_info.get('latitude'),
            'longitude': ip_info.get('longitude'),
        }
        
        return jsonify(response_info), 200
        
    except Exception as e:
        logger.error(f"Error looking up IP: {e}")
        return jsonify({'error': 'IP lookup failed'}), 500


@geo_bp.route('/my-ip', methods=['GET'])
def get_my_ip():
    """
    Get the visitor's IP address as detected by the server.
    Useful for frontend to know what IP the backend sees.
    """
    try:
        if request.headers.getlist("X-Forwarded-For"):
            ip_address = request.headers.getlist("X-Forwarded-For")[0]
        else:
            ip_address = request.remote_addr
        
        ip_service = get_ip_service()
        ip_info = ip_service.get_ip_info(ip_address)
        
        return jsonify({
            'ip': ip_address,
            'location': {
                'city': ip_info.get('city'),
                'region': ip_info.get('region'),
                'country': ip_info.get('country_name'),
                'timezone': ip_info.get('timezone')
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting IP: {e}")
        return jsonify({'error': 'Failed to get IP'}), 500


@geo_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_ip_stats():
    """Get IP geolocation statistics (protected endpoint)"""
    try:
        ip_service = get_ip_service()
        stats = ip_service.get_ip_stats()
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Error getting IP stats: {e}")
        return jsonify({'error': 'Failed to get IP stats'}), 500
