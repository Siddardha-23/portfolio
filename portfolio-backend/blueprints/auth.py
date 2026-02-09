"""Authentication blueprint with security improvements"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from utils.db_connect import DBConnect
from utils.security import InputSanitizer, get_rate_limiter
from models.user import User
from datetime import datetime
import logging

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user with secure password handling"""
    try:
        # Rate limiting
        rate_limiter = get_rate_limiter()
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if rate_limiter.is_rate_limited(f"register:{client_ip}", max_requests=5, window_seconds=3600):
            logger.warning(f"Rate limit exceeded for registration from {client_ip}")
            return jsonify({'error': 'Too many attempts. Please try again later.'}), 429
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Sanitize inputs
        username = InputSanitizer.sanitize_username(data.get('username', ''))
        password = data.get('password', '').strip()  # Don't sanitize password to preserve special chars
        email = InputSanitizer.sanitize_email(data.get('email', ''))
        
        # Check for NoSQL injection attempts
        if InputSanitizer.check_nosql_injection(data.get('username', '')):
            logger.warning(f"NoSQL injection attempt in username from {client_ip}")
            return jsonify({'error': 'Invalid input'}), 400
        
        # Validation
        if not username or len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters (alphanumeric only)'}), 400
        
        if len(username) > 50:
            return jsonify({'error': 'Username too long'}), 400
        
        # Password strength validation
        is_valid, error_msg = User.validate_password(password)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        db = DBConnect().get_db()
        users_collection = db.users
        
        # Check if user exists (use sanitized values)
        existing_user = users_collection.find_one({
            '$or': [{'username': username}, {'email': email}]
        }) if email else users_collection.find_one({'username': username})
        
        if existing_user:
            return jsonify({'error': 'Username or email already exists'}), 409
        
        # Create new user with bcrypt hashed password
        password_hash = User.hash_password(password)
        new_user = {
            'username': username,
            'password_hash': password_hash,
            'email': email if email else None,
            'created_at': datetime.utcnow(),
            'last_login': None,
            'login_attempts': 0
        }
        
        result = users_collection.insert_one(new_user)
        
        if result.inserted_id:
            logger.info(f"New user registered: {username}")
            return jsonify({
                'message': 'User registered successfully',
                'username': username
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
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        
        # Rate limiting for login attempts
        rate_limiter = get_rate_limiter()
        if rate_limiter.is_rate_limited(f"login:{client_ip}", max_requests=10, window_seconds=300):
            logger.warning(f"Rate limit exceeded for login from {client_ip}")
            return jsonify({'error': 'Too many login attempts. Please try again later.'}), 429
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        username = InputSanitizer.sanitize_username(data.get('username', ''))
        password = data.get('password', '').strip()
        
        # Check for injection attempts
        if InputSanitizer.check_nosql_injection(data.get('username', '')):
            logger.warning(f"NoSQL injection attempt in login from {client_ip}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        # Get user from database
        db = DBConnect().get_db()
        user = db.users.find_one({'username': username})
        
        # Generic error message to prevent username enumeration
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check for account lockout (5 failed attempts)
        if user.get('login_attempts', 0) >= 5:
            last_attempt = user.get('last_failed_login')
            if last_attempt:
                lockout_time = 900  # 15 minutes
                import time
                if time.time() - last_attempt.timestamp() < lockout_time:
                    return jsonify({'error': 'Account locked. Try again in 15 minutes.'}), 423
        
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
            logger.warning(f"Failed login attempt for user: {username} from {client_ip}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Reset login attempts on successful login
        db.users.update_one(
            {'_id': user['_id']},
            {
                '$set': {
                    'login_attempts': 0,
                    'last_login': datetime.utcnow(),
                    'last_login_ip': client_ip
                }
            }
        )
        
        # Create access token
        access_token = create_access_token(identity=user['username'])
        
        logger.info(f"User logged in: {username}")
        return jsonify({
            'access_token': access_token,
            'username': user['username']
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    try:
        current_username = get_jwt_identity()
        
        db = DBConnect().get_db()
        user = db.users.find_one({'username': current_username})
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Don't expose sensitive fields
        return jsonify({
            'username': user['username'],
            'email': user.get('email'),
            'created_at': user.get('created_at').isoformat() if user.get('created_at') else None
        }), 200
        
    except Exception as e:
        logger.error(f"Profile error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify_token():
    """Verify JWT token is valid"""
    current_username = get_jwt_identity()
    return jsonify({'username': current_username, 'valid': True}), 200
