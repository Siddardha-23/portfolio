"""Contact form blueprint with security improvements"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.db_connect import DBConnect
from utils.security import InputSanitizer, get_rate_limiter
from datetime import datetime
import logging

contact_bp = Blueprint('contact', __name__)
logger = logging.getLogger(__name__)

@contact_bp.route('', methods=['POST'])
def submit_contact():
    """Submit contact form message with input validation and rate limiting"""
    try:
        # Rate limiting to prevent spam
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        rate_limiter = get_rate_limiter()
        
        if rate_limiter.is_rate_limited(f"contact:{client_ip}", max_requests=5, window_seconds=3600):
            logger.warning(f"Rate limit exceeded for contact form from {client_ip}")
            return jsonify({'error': 'Too many submissions. Please try again later.'}), 429
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Sanitize all inputs
        name = InputSanitizer.sanitize_html(data.get('name', ''), max_length=100)
        email = InputSanitizer.sanitize_email(data.get('email', ''))
        subject = InputSanitizer.sanitize_html(data.get('subject', ''), max_length=200)
        message = InputSanitizer.sanitize_html(data.get('message', ''), max_length=5000)
        
        # Check for NoSQL injection in all fields
        raw_fields = [data.get('name', ''), data.get('subject', ''), data.get('message', '')]
        for field in raw_fields:
            if InputSanitizer.check_nosql_injection(str(field)):
                logger.warning(f"NoSQL injection attempt in contact form from {client_ip}")
                return jsonify({'error': 'Invalid input detected'}), 400
        
        # Validation
        if not name or len(name) < 2:
            return jsonify({'error': 'Name must be at least 2 characters'}), 400
        
        if not email:
            return jsonify({'error': 'Valid email is required'}), 400
        
        if not subject or len(subject) < 3:
            return jsonify({'error': 'Subject must be at least 3 characters'}), 400
        
        if not message or len(message) < 10:
            return jsonify({'error': 'Message must be at least 10 characters'}), 400
        
        # Additional spam detection - check for suspicious patterns
        spam_patterns = ['http://', 'https://', '[url=', '<a href']
        message_lower = message.lower()
        if any(pattern in message_lower for pattern in spam_patterns):
            # Allow but flag for review
            is_suspicious = True
        else:
            is_suspicious = False
        
        # Validate IP address
        ip_address = InputSanitizer.sanitize_ip_address(client_ip) or 'unknown'
        
        msg_doc = {
            'name': name,
            'email': email,
            'subject': subject,
            'message': message,
            'ip_address': ip_address,
            'created_at': datetime.utcnow(),
            'is_suspicious': is_suspicious,
            'is_read': False
        }
        
        db = DBConnect().get_db()
        result = db.contact_messages.insert_one(msg_doc)
        
        if result.inserted_id:
            logger.info(f"Contact message received from: {email} (suspicious: {is_suspicious})")
            return jsonify({
                'message': 'Message sent successfully',
                'success': True
            }), 200
        else:
            return jsonify({'error': 'Failed to send message'}), 500
            
    except Exception as e:
        logger.error(f"Error submitting contact message: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@contact_bp.route('/messages', methods=['GET'])
@jwt_required()
def get_messages():
    """Get all contact messages (protected endpoint)"""
    try:
        db = DBConnect().get_db()
        collection = db.contact_messages
        
        # Sort by created_at DESC, limit 100
        cursor = collection.find().sort('created_at', -1).limit(100)
        messages = list(cursor)
        
        return jsonify({
            'messages': [
                {
                    'id': str(msg['_id']),
                    'name': msg.get('name'),
                    'email': msg.get('email'),
                    'subject': msg.get('subject'),
                    'message': msg.get('message'),
                    'created_at': msg.get('created_at').isoformat() if msg.get('created_at') else None,
                    'is_suspicious': msg.get('is_suspicious', False),
                    'is_read': msg.get('is_read', False)
                }
                for msg in messages
            ]
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting contact messages: {e}")
        return jsonify({'error': 'Database error'}), 500
