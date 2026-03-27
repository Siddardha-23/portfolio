"""Authentication blueprint with security improvements - email-based auth"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from utils.db_connect import DBConnect
from utils.security import InputSanitizer, get_rate_limiter, get_client_ip
from models.user import User
from datetime import datetime
import logging

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)


def mask_email(email):
    """Mask email for privacy: show first 2 chars + *** + domain"""
    try:
        local, domain = email.split('@', 1)
        if len(local) <= 2:
            masked_local = local[0] + '***' if local else '***'
        else:
            masked_local = local[:2] + '***'
        return f"{masked_local}@{domain}"
    except (ValueError, AttributeError):
        return '***'


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user with secure password handling"""
    try:
        # Rate limiting
        rate_limiter = get_rate_limiter()
        client_ip = get_client_ip(request)
        if rate_limiter.is_rate_limited(f"register:{client_ip}", max_requests=5, window_seconds=3600):
            logger.warning(f"Rate limit exceeded for registration from {client_ip}")
            return jsonify({'error': 'Too many attempts. Please try again later.'}), 429

        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Sanitize inputs
        email = InputSanitizer.sanitize_email(data.get('email', ''))
        password = data.get('password', '').strip()  # Don't sanitize password to preserve special chars

        # Check for NoSQL injection attempts
        if InputSanitizer.check_nosql_injection(data.get('email', '')):
            logger.warning(f"NoSQL injection attempt in email from {client_ip}")
            return jsonify({'error': 'Invalid input'}), 400

        # Validation
        if not email:
            return jsonify({'error': 'Email is required'}), 400

        # Password strength validation
        is_valid, error_msg = User.validate_password(password)
        if not is_valid:
            return jsonify({'error': error_msg}), 400

        # Sanitize optional fields
        role = data.get('role', '')
        if role:
            if InputSanitizer.check_nosql_injection(role):
                return jsonify({'error': 'Invalid input'}), 400
            role = str(role).strip()[:100]

        sector = data.get('sector', '')
        if sector:
            if InputSanitizer.check_nosql_injection(sector):
                return jsonify({'error': 'Invalid input'}), 400
            sector = str(sector).strip()[:100]

        session_id = data.get('session_id', '')
        if session_id:
            if InputSanitizer.check_nosql_injection(session_id):
                return jsonify({'error': 'Invalid input'}), 400
            session_id = str(session_id).strip()

        fingerprint_hash = data.get('fingerprint_hash', '')
        if fingerprint_hash:
            if InputSanitizer.check_nosql_injection(fingerprint_hash):
                return jsonify({'error': 'Invalid input'}), 400
            fingerprint_hash = str(fingerprint_hash).strip()

        db = DBConnect().get_db()
        users_collection = db.users

        # Check if user exists by email
        existing_user = users_collection.find_one({'email': email})

        if existing_user:
            return jsonify({'error': 'Email already exists'}), 409

        # Create new user with bcrypt hashed password
        password_hash = User.hash_password(password)
        new_user = {
            'email': email,
            'password_hash': password_hash,
            'role': role if role else None,
            'sector': sector if sector else None,
            'session_id': session_id if session_id else None,
            'fingerprint_hash': fingerprint_hash if fingerprint_hash else None,
            'created_at': datetime.utcnow(),
            'last_login': datetime.utcnow(),
            'login_attempts': 0
        }

        result = users_collection.insert_one(new_user)

        if result.inserted_id:
            # Auto-login: create access token
            access_token = create_access_token(identity=email)
            logger.info(f"New user registered: {email}")
            return jsonify({
                'message': 'User registered successfully',
                'email': email,
                'access_token': access_token
            }), 201
        else:
            return jsonify({'error': 'Failed to register user'}), 500

    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user with rate limiting and account lockout"""
    try:
        client_ip = get_client_ip(request)

        # Rate limiting for login attempts
        rate_limiter = get_rate_limiter()
        if rate_limiter.is_rate_limited(f"login:{client_ip}", max_requests=10, window_seconds=300):
            logger.warning(f"Rate limit exceeded for login from {client_ip}")
            return jsonify({'error': 'Too many login attempts. Please try again later.'}), 429

        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        email = InputSanitizer.sanitize_email(data.get('email', ''))
        password = data.get('password', '').strip()

        # Check for injection attempts
        if InputSanitizer.check_nosql_injection(data.get('email', '')):
            logger.warning(f"NoSQL injection attempt in login from {client_ip}")
            return jsonify({'error': 'Invalid credentials'}), 401

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        # Get user from database
        db = DBConnect().get_db()
        user = db.users.find_one({'email': email})

        # Generic error message to prevent email enumeration
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401

        # Check for account lockout (5 failed attempts)
        if user.get('login_attempts', 0) >= 5:
            last_attempt = user.get('last_failed_login')
            if last_attempt:
                lockout_time = 900  # 15 minutes
                import time
                try:
                    attempt_ts = last_attempt.timestamp() if hasattr(last_attempt, 'timestamp') else float(last_attempt)
                    if time.time() - attempt_ts < lockout_time:
                        return jsonify({'error': 'Account locked. Try again in 15 minutes.'}), 423
                except (TypeError, ValueError, OSError):
                    pass  # If timestamp is corrupted, skip lockout check

        # Verify password
        if not User.verify_password(password, user['password_hash']):
            # Increment failed login attempts
            db.users.update_one(
                {'_id': user['_id']},
                {
                    '$inc': {'login_attempts': 1},
                    '$set': {'last_failed_login': datetime.utcnow()}
                }
            )
            logger.warning(f"Failed login attempt for user: {email} from {client_ip}")
            return jsonify({'error': 'Invalid credentials'}), 401

        # Build update fields for successful login
        update_fields = {
            'login_attempts': 0,
            'last_login': datetime.utcnow(),
            'last_login_ip': client_ip
        }

        # Update session_id and fingerprint_hash if provided
        session_id = data.get('session_id', '')
        if session_id:
            if not InputSanitizer.check_nosql_injection(session_id):
                update_fields['session_id'] = str(session_id).strip()

        fingerprint_hash = data.get('fingerprint_hash', '')
        if fingerprint_hash:
            if not InputSanitizer.check_nosql_injection(fingerprint_hash):
                update_fields['fingerprint_hash'] = str(fingerprint_hash).strip()

        # Reset login attempts on successful login
        db.users.update_one(
            {'_id': user['_id']},
            {'$set': update_fields}
        )

        # Create access token
        access_token = create_access_token(identity=email)

        logger.info(f"User logged in: {email}")
        return jsonify({
            'access_token': access_token,
            'email': user['email'],
            'role': user.get('role'),
            'sector': user.get('sector')
        }), 200

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    try:
        current_email = get_jwt_identity()

        db = DBConnect().get_db()
        user = db.users.find_one({'email': current_email})

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Don't expose sensitive fields
        return jsonify({
            'email': user['email'],
            'role': user.get('role'),
            'sector': user.get('sector'),
            'created_at': user.get('created_at').isoformat() if user.get('created_at') else None
        }), 200

    except Exception as e:
        logger.error(f"Profile error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@auth_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify_token():
    """Verify JWT token is valid"""
    current_email = get_jwt_identity()
    return jsonify({'email': current_email, 'valid': True}), 200


@auth_bp.route('/check-user', methods=['POST'])
def check_user():
    """Check if a user exists by fingerprint hash for welcome-back UX"""
    try:
        client_ip = get_client_ip(request)

        # Rate limiting
        rate_limiter = get_rate_limiter()
        if rate_limiter.is_rate_limited(f"check_user:{client_ip}", max_requests=20, window_seconds=300):
            logger.warning(f"Rate limit exceeded for check-user from {client_ip}")
            return jsonify({'error': 'Too many attempts. Please try again later.'}), 429

        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        fingerprint_hash = data.get('fingerprint_hash', '')

        if not fingerprint_hash:
            return jsonify({'error': 'fingerprint_hash is required'}), 400

        # Check for NoSQL injection attempts
        if InputSanitizer.check_nosql_injection(fingerprint_hash):
            logger.warning(f"NoSQL injection attempt in check-user from {client_ip}")
            return jsonify({'error': 'Invalid input'}), 400

        fingerprint_hash = str(fingerprint_hash).strip()

        db = DBConnect().get_db()
        user = db.users.find_one({'fingerprint_hash': fingerprint_hash})

        if user and user.get('email'):
            return jsonify({
                'exists': True,
                'email': mask_email(user['email'])
            }), 200
        else:
            return jsonify({'exists': False}), 200

    except Exception as e:
        logger.error(f"Check-user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500
