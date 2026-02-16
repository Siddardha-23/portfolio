"""Visitor info blueprint - routes for visitor tracking and registration."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime
import logging
from ua_parser import user_agent_parser

from services.visitor_service import get_visitor_service
from services.ip_service import get_ip_service
from services.linkedin_service import (
    search_linkedin_profile,
    extract_organization_from_email,
)
from utils.db_connect import DBConnect
from utils.security import InputSanitizer, get_rate_limiter, get_client_ip

info_bp = Blueprint('info', __name__)
logger = logging.getLogger(__name__)

# Map country codes to full names so frontend map always gets a known key (India, United States, etc.)
COUNTRY_CODE_TO_NAME = {
    'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada', 'IN': 'India',
    'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'JP': 'Japan', 'CN': 'China',
    'BR': 'Brazil', 'MX': 'Mexico', 'NL': 'Netherlands', 'SE': 'Sweden', 'KR': 'South Korea',
    'IT': 'Italy', 'ES': 'Spain', 'SG': 'Singapore', 'AE': 'UAE', 'RU': 'Russia',
    'IL': 'Israel', 'TR': 'Turkey', 'PL': 'Poland', 'BE': 'Belgium', 'AT': 'Austria',
    'CH': 'Switzerland', 'PT': 'Portugal', 'ZA': 'South Africa', 'AR': 'Argentina',
    'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru', 'PH': 'Philippines', 'ID': 'Indonesia',
    'VN': 'Vietnam', 'TH': 'Thailand', 'MY': 'Malaysia', 'EG': 'Egypt', 'PK': 'Pakistan',
    'BD': 'Bangladesh', 'NG': 'Nigeria', 'KE': 'Kenya', 'NZ': 'New Zealand', 'HK': 'Hong Kong',
}


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
        
        ip_address = get_client_ip(request)
        client_ip = data.get('clientIp', data.get('client_ip'))
        user_agent = request.headers.get('User-Agent', data.get('user_agent', 'unknown'))
        page = data.get('page', 'unknown')
        referrer = data.get('referrer', 'direct')
        fingerprint_hash = data.get('fingerprintHash') or data.get('fingerprint_hash') or None

        visitor_service = get_visitor_service()
        result = visitor_service.track_visitor(
            session_id=session_id,
            ip_address=ip_address,
            client_ip=client_ip,
            user_agent=user_agent,
            page=page,
            referrer=referrer,
            raw_data=data,
            fingerprint_hash=fingerprint_hash
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
        rate_limiter = get_rate_limiter()
        client_ip = get_client_ip(request)
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

        ip_address = get_client_ip(request)
        ip_service = get_ip_service()
        ip_info = ip_service.get_ip_info(ip_address)
        
        user_agent_string = request.headers.get('User-Agent', 'unknown')
        ua_parsed = user_agent_parser.Parse(user_agent_string)
        
        organization = extract_organization_from_email(email)

        linkedin_info = search_linkedin_profile(first_name, last_name, email)
        if linkedin_info.get("organization_from_headline"):
            organization = organization or linkedin_info["organization_from_headline"]
        linkedin_response = {
            "found": linkedin_info.get("found", False),
            "url": linkedin_info.get("url"),
            "headline": linkedin_info.get("headline", ""),
            "source": linkedin_info.get("source", ""),
        }

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
            'linkedin': linkedin_response,
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
            'linkedin': linkedin_response,
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
    """
    Public stats: total visitors (all who visited, including skip),
    plus organizations and LinkedIn counts from form submitters only.
    """
    try:
        visitor_service = get_visitor_service()
        total_visitors = visitor_service.get_unique_visitor_count()

        db = DBConnect().get_db()
        collection = db.registered_visitors

        # Derive org from email when organization is missing (e.g. @asu.edu -> Asu) so all ASU users count together
        _email_domain = {"$toLower": {"$arrayElemAt": [{"$split": [{"$ifNull": ["$email", ""]}, "@"]}, 1]}}
        _has_org = {"$and": [
            {"$ne": ["$organization", None]},
            {"$gt": [{"$strLenCP": {"$ifNull": ["$organization", ""]}}, 0]}
        ]}
        # Prefer email domain for known .edu so "Arizona State University" and "Asu" both become "asu"
        _edu_org_key_branches = [
            {"case": {"$eq": ["$_email_domain", "asu.edu"]}, "then": "asu"},
            {"case": {"$eq": ["$_email_domain", "mit.edu"]}, "then": "mit"},
            {"case": {"$eq": ["$_email_domain", "stanford.edu"]}, "then": "stanford"},
            {"case": {"$eq": ["$_email_domain", "harvard.edu"]}, "then": "harvard"},
            {"case": {"$eq": ["$_email_domain", "berkeley.edu"]}, "then": "berkeley"},
            {"case": {"$eq": ["$_email_domain", "yale.edu"]}, "then": "yale"},
            {"case": {"$eq": ["$_email_domain", "princeton.edu"]}, "then": "princeton"},
            {"case": {"$eq": ["$_email_domain", "caltech.edu"]}, "then": "caltech"},
            {"case": {"$eq": ["$_email_domain", "cmu.edu"]}, "then": "cmu"},
            {"case": {"$eq": ["$_email_domain", "cornell.edu"]}, "then": "cornell"},
        ]
        _edu_display_branches = [
            {"case": {"$eq": ["$_email_domain", "asu.edu"]}, "then": "Asu"},
            {"case": {"$eq": ["$_email_domain", "mit.edu"]}, "then": "MIT"},
            {"case": {"$eq": ["$_email_domain", "stanford.edu"]}, "then": "Stanford"},
            {"case": {"$eq": ["$_email_domain", "harvard.edu"]}, "then": "Harvard"},
            {"case": {"$eq": ["$_email_domain", "berkeley.edu"]}, "then": "Berkeley"},
            {"case": {"$eq": ["$_email_domain", "yale.edu"]}, "then": "Yale"},
            {"case": {"$eq": ["$_email_domain", "princeton.edu"]}, "then": "Princeton"},
            {"case": {"$eq": ["$_email_domain", "caltech.edu"]}, "then": "Caltech"},
            {"case": {"$eq": ["$_email_domain", "cmu.edu"]}, "then": "CMU"},
            {"case": {"$eq": ["$_email_domain", "cornell.edu"]}, "then": "Cornell"},
        ]
        pipeline = [
            {"$match": {"email": {"$exists": True}, "email": {"$regex": "@", "$ne": ""}}},
            {"$addFields": {"_email_domain": _email_domain}},
            {"$addFields": {
                "_org_from_edu": {"$switch": {"branches": _edu_org_key_branches, "default": None}},
                "_display_from_edu": {"$switch": {"branches": _edu_display_branches, "default": None}}
            }},
            {"$addFields": {
                "org_key": {"$cond": [
                    {"$ne": ["$_org_from_edu", None]},
                    "$_org_from_edu",
                    {"$cond": [_has_org, {"$toLower": {"$ifNull": ["$organization", ""]}}, None]}
                ]},
                "_display_name": {"$cond": [
                    {"$ne": ["$_display_from_edu", None]},
                    "$_display_from_edu",
                    {"$cond": [_has_org, "$organization", None]}
                ]}
            }},
            {"$match": {"org_key": {"$nin": [None, "", "gmaio"]}}},
            {"$group": {
                "_id": "$org_key",
                "count": {"$sum": 1},
                "display_name": {"$first": {"$ifNull": ["$_display_name", "$organization"]}},
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
        
        # Geographic distribution from registered_visitors (form submitters) for top_countries
        geo_pipeline = [
            {"$match": {"geo.country": {"$exists": True}, "geo.country": {"$nin": [None, ""]}}},
            {"$group": {"_id": "$geo.country", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20}
        ]
        top_countries_raw = list(collection.aggregate(geo_pipeline))

        # Normalize country so frontend map finds it: "IN" -> "India", "United States" stays
        def country_for_map(raw_country):
            s = (raw_country or "").strip()
            if len(s) == 2:
                return COUNTRY_CODE_TO_NAME.get(s.upper(), s)
            return s or raw_country

        top_countries = [
            {'country': country_for_map(c['_id']), 'count': c['count']}
            for c in top_countries_raw
        ]

        def build_map_entry(m):
            cid = m["_id"]
            country = country_for_map(cid.get("country"))
            city = (cid.get("city") or "").strip() or None
            lat, lng = m.get("lat"), m.get("lng")
            if lat is not None and lng is not None:
                try:
                    lat, lng = float(lat), float(lng)
                except (TypeError, ValueError):
                    lat, lng = None, None
            return {
                "country": country,
                "city": city,
                "latitude": lat,
                "longitude": lng,
                "count": m["count"]
            }

        # City-level points: include BOTH registered_visitors (form submitters) AND visitor_info (all visitors)
        # so Bengaluru and other cities show on the map even if they didn't submit the form
        map_locations_pipeline = [
            {"$match": {"geo.country": {"$exists": True}, "geo.country": {"$nin": [None, ""]}}},
            {"$group": {
                "_id": {"country": "$geo.country", "city": {"$ifNull": ["$geo.city", ""]}},
                "count": {"$sum": 1},
                "lat": {"$first": "$ip_info.latitude"},
                "lng": {"$first": "$ip_info.longitude"}
            }},
            {"$match": {"_id.country": {"$ne": ""}}},
            {"$sort": {"count": -1}},
            {"$limit": 100}
        ]
        map_locations_raw = list(collection.aggregate(map_locations_pipeline))

        # Also get locations from visitor_info (all tracked visitors, not just form submitters)
        visitor_info_coll = db.visitor_info
        visitor_map_pipeline = [
            {"$match": {
                "$or": [
                    {"geo.country": {"$exists": True, "$nin": [None, ""]}},
                    {"geo.country_name": {"$exists": True, "$nin": [None, ""]}}
                ]
            }},
            {"$group": {
                "_id": {
                    "country": {"$ifNull": ["$geo.country", "$geo.country_name"]},
                    "city": {"$ifNull": ["$geo.city", ""]}
                },
                "count": {"$sum": 1},
                "lat": {"$first": "$ip_info.latitude"},
                "lng": {"$first": "$ip_info.longitude"}
            }},
            {"$match": {"_id.country": {"$ne": ""}}},
            {"$sort": {"count": -1}},
            {"$limit": 100}
        ]
        visitor_map_raw = list(visitor_info_coll.aggregate(visitor_map_pipeline))

        # Merge: key by (country, city), sum counts, keep any non-null lat/lng
        merged = {}
        for m in map_locations_raw:
            entry = build_map_entry(m)
            key = (entry["country"], entry["city"] or "")
            merged[key] = dict(entry)
        for m in visitor_map_raw:
            entry = build_map_entry(m)
            key = (entry["country"], entry["city"] or "")
            if key not in merged:
                merged[key] = dict(entry)
            else:
                merged[key]["count"] += entry["count"]
                if merged[key]["latitude"] is None and entry["latitude"] is not None:
                    merged[key]["latitude"] = entry["latitude"]
                    merged[key]["longitude"] = entry["longitude"]

        map_locations = sorted(merged.values(), key=lambda x: -x["count"])[:50]

        return jsonify({
            'total_visitors': total_visitors,
            'organizations': [
                {
                    'name': stat.get('display_name') or (stat['_id'].title() if stat.get('_id') else ''),
                    'visitors': stat['count'],
                    'latest_visit': stat['latest_visit'].isoformat() if stat.get('latest_visit') else None
                }
                for stat in org_stats
            ],
            'total_registered': total_registered,
            'linkedin_profiles_found': linkedin_found,
            'top_countries': top_countries,
            'map_locations': map_locations
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting org stats: {e}")
        return jsonify({'error': 'Database error'}), 500
