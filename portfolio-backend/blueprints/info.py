"""Visitor info blueprint - Updated to use service layer with security"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from services.visitor_service import get_visitor_service
from services.ip_service import get_ip_service
from utils.db_connect import DBConnect
from utils.security import InputSanitizer, get_rate_limiter
from datetime import datetime
import logging
import requests
from ua_parser import user_agent_parser


info_bp = Blueprint('info', __name__)
logger = logging.getLogger(__name__)


def search_linkedin_via_duckduckgo(first_name, last_name, email=None):
    """
    Search for LinkedIn profile using DuckDuckGo Instant Answer API.
    This is a privacy-respecting, free API that doesn't require authentication.
    """
    try:
        query = f"{first_name} {last_name} site:linkedin.com/in"
        url = f"https://api.duckduckgo.com/?q={query}&format=json&no_html=1"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            # Check for results
            if data.get('AbstractURL') and 'linkedin.com' in data.get('AbstractURL', ''):
                return {
                    'found': True,
                    'url': data.get('AbstractURL'),
                    'headline': data.get('AbstractText', ''),
                    'source': 'duckduckgo'
                }
            # Check related topics
            for topic in data.get('RelatedTopics', []):
                if isinstance(topic, dict) and 'FirstURL' in topic:
                    if 'linkedin.com/in' in topic.get('FirstURL', ''):
                        return {
                            'found': True,
                            'url': topic.get('FirstURL'),
                            'headline': topic.get('Text', ''),
                            'source': 'duckduckgo'
                        }
        return {'found': False, 'source': 'duckduckgo'}
    except Exception as e:
        logger.error(f"LinkedIn search error: {e}")
        return {'found': False, 'error': str(e)}


def extract_company_from_email(email):
    """Extract company/organization name from email domain"""
    try:
        if not email or '@' not in email:
            return None
        domain = email.split('@')[1].lower()
        # Skip common personal email providers
        personal_domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
                          'icloud.com', 'aol.com', 'protonmail.com', 'mail.com']
        if domain in personal_domains:
            return None
        # Extract company name from domain
        company = domain.split('.')[0]
        return company.title()
    except:
        return None


@info_bp.route('', methods=['POST'])
def store_visitor_info():
    """
    Store visitor information with session-based deduplication.
    Uses the new service layer for tracking.
    """
    try:
        data = request.get_json(force=True) or {}
        
        # Get session ID from request
        session_id = data.get('sessionId', data.get('session_id', ''))
        
        if not session_id:
            # Generate a temporary session ID if not provided
            import uuid
            session_id = str(uuid.uuid4())
        
        # Enhanced IP detection
        if request.headers.getlist("X-Forwarded-For"):
            ip_address = request.headers.getlist("X-Forwarded-For")[0]
        else:
            ip_address = request.remote_addr
        
        # Client-provided IP (from frontend IP detection)
        client_ip = data.get('clientIp', data.get('client_ip'))
        
        user_agent = request.headers.get('User-Agent', data.get('user_agent', 'unknown'))
        page = data.get('page', 'unknown')
        referrer = data.get('referrer', 'direct')
        
        # Use visitor service for tracking
        visitor_service = get_visitor_service()
        result = visitor_service.track_visitor(
            session_id=session_id,
            ip_address=ip_address,
            client_ip=client_ip,
            user_agent=user_agent,
            page=page,
            referrer=referrer,
            raw_data=data
        )
        
        if result.get('status') == 'existing':
            logger.info(f"Returning visitor session: {session_id}")
            return jsonify({
                'message': 'Session already tracked',
                'status': 'existing',
                'session_id': session_id,
                'ip': result.get('ip')
            }), 200
        
        if result.get('status') == 'created':
            logger.info(f"New visitor tracked: {session_id}")
            return jsonify({
                'message': 'Visitor info stored',
                'status': 'new',
                'session_id': session_id,
                'ip': result.get('ip'),
                'location': result.get('location')
            }), 200
        
        return jsonify({
            'message': 'Tracking failed',
            'error': result.get('message')
        }), 500
            
    except Exception as e:
        logger.error(f"Error storing visitor info: {e}")
        return jsonify({'error': 'Database error'}), 500


@info_bp.route('/register-visitor', methods=['POST'])
def register_visitor():
    """
    Register a visitor with their details, auto-create a user account,
    and attempt to find their LinkedIn profile.
    """
    try:
        # Rate limiting
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        rate_limiter = get_rate_limiter()
        if rate_limiter.is_rate_limited(f"register-visitor:{client_ip}", max_requests=10, window_seconds=3600):
            return jsonify({'error': 'Too many requests'}), 429
        
        db = DBConnect().get_db()
        data = request.get_json(force=True) or {}
        
        # Sanitize all inputs
        first_name = InputSanitizer.sanitize_html(data.get('firstName', ''), max_length=50)
        middle_name = InputSanitizer.sanitize_html(data.get('middleName', ''), max_length=50)
        last_name = InputSanitizer.sanitize_html(data.get('lastName', ''), max_length=50)
        email = InputSanitizer.sanitize_email(data.get('email', ''))
        
        # Check for injection attempts
        raw_values = [data.get('firstName', ''), data.get('lastName', '')]
        for value in raw_values:
            if InputSanitizer.check_nosql_injection(str(value)):
                logger.warning(f"NoSQL injection attempt in visitor registration from {client_ip}")
                return jsonify({'error': 'Invalid input'}), 400
        
        if not first_name or not last_name:
            return jsonify({'error': 'First and last name are required'}), 400
        
        # Enhanced IP detection
        if request.headers.getlist("X-Forwarded-For"):
            ip_address = request.headers.getlist("X-Forwarded-For")[0]
        else:
            ip_address = request.remote_addr
        
        # Get IP geolocation
        ip_service = get_ip_service()
        ip_info = ip_service.get_ip_info(ip_address)
        
        user_agent_string = request.headers.get('User-Agent', 'unknown')
        ua_parsed = user_agent_parser.Parse(user_agent_string)
        
        # Extract organization from email
        organization = extract_company_from_email(email)
        
        # Attempt LinkedIn lookup (non-blocking, best effort)
        linkedin_info = search_linkedin_via_duckduckgo(first_name, last_name, email)
        
        # Store in registered_visitors collection
        visitor_doc = {
            'first_name': first_name,
            'middle_name': middle_name,
            'last_name': last_name,
            'full_name': f"{first_name} {middle_name} {last_name}".strip().replace('  ', ' '),
            'email': email,
            'organization': organization,
            'ip_address': ip_address,
            'ip_info': ip_info,  # Store full geolocation data
            'browser': ua_parsed.get('user_agent', {}).get('family'),
            'os': ua_parsed.get('os', {}).get('family'),
            'device': ua_parsed.get('device', {}).get('family'),
            'linkedin': linkedin_info,
            'registered_at': datetime.utcnow(),
            'fingerprint': data.get('fingerprint', {}),
            'session_id': data.get('sessionId', data.get('session_id')),
            # Add geolocation summary
            'geo': {
                'city': ip_info.get('city'),
                'region': ip_info.get('region'),
                'country': ip_info.get('country_name'),
                'timezone': ip_info.get('timezone')
            }
        }
        
        db.registered_visitors.insert_one(visitor_doc)
        
        logger.info(f"Visitor registered: {first_name} {last_name} from {ip_info.get('city')}, {ip_info.get('country_name')}")
        
        return jsonify({
            'success': True,
            'message': 'Visitor registered successfully',
            'linkedin': linkedin_info,
            'organization': organization,
            'location': {
                'city': ip_info.get('city'),
                'country': ip_info.get('country_name')
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error registering visitor: {e}")
        return jsonify({'error': 'Registration failed'}), 500


@info_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_visitor_stats():
    """Get comprehensive visitor statistics (protected endpoint)"""
    try:
        visitor_service = get_visitor_service()
        stats = visitor_service.get_statistics()
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Error getting visitor stats: {e}")
        return jsonify({'error': 'Database error'}), 500


@info_bp.route('/org-stats', methods=['GET'])
def get_organization_stats():
    """Get public organization visitor statistics (no auth required)"""
    try:
        db = DBConnect().get_db()
        collection = db.registered_visitors
        
        # Aggregate visitors by organization
        pipeline = [
            {"$match": {"organization": {"$ne": None}}},
            {"$group": {
                "_id": "$organization",
                "count": {"$sum": 1},
                "latest_visit": {"$max": "$registered_at"}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        org_stats = list(collection.aggregate(pipeline))
        
        # Total registered visitors
        total_registered = collection.count_documents({})
        
        # Count with LinkedIn found
        linkedin_found = collection.count_documents({"linkedin.found": True})
        
        # Geographic distribution
        geo_pipeline = [
            {"$match": {"geo.country": {"$ne": None}}},
            {"$group": {"_id": "$geo.country", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        top_countries = list(collection.aggregate(geo_pipeline))
        
        return jsonify({
            'organizations': [
                {
                    'name': stat['_id'],
                    'visitors': stat['count'],
                    'latest_visit': stat['latest_visit'].isoformat() if stat.get('latest_visit') else None
                }
                for stat in org_stats
            ],
            'total_registered': total_registered,
            'linkedin_profiles_found': linkedin_found,
            'top_countries': [
                {'country': c['_id'], 'count': c['count']} 
                for c in top_countries
            ]
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting org stats: {e}")
        return jsonify({'error': 'Database error'}), 500
