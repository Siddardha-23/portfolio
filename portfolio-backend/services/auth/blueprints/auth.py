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
            'name': user.get('name'),
            'role': user.get('role'),
            'sector': user.get('sector'),
            'created_at': user.get('created_at').isoformat() if user.get('created_at') else None
        }), 200

    except Exception as e:
        logger.error(f"Profile error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user profile"""
    try:
        current_email = get_jwt_identity()
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        db = DBConnect().get_db()
        user = db.users.find_one({'email': current_email})

        if not user:
            return jsonify({'error': 'User not found'}), 404

        update_fields = {}
        for field in ('name', 'role', 'sector'):
            if field in data:
                value = data[field]
                if value is not None:
                    if InputSanitizer.check_nosql_injection(str(value)):
                        return jsonify({'error': 'Invalid input'}), 400
                    update_fields[field] = str(value).strip()[:200]
                else:
                    update_fields[field] = None

        if not update_fields:
            return jsonify({'error': 'No valid fields to update'}), 400

        db.users.update_one({'_id': user['_id']}, {'$set': update_fields})

        updated = db.users.find_one({'_id': user['_id']})
        return jsonify({
            'email': updated['email'],
            'name': updated.get('name'),
            'role': updated.get('role'),
            'sector': updated.get('sector'),
            'created_at': updated.get('created_at').isoformat() if updated.get('created_at') else None
        }), 200

    except Exception as e:
        logger.error(f"Update profile error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@auth_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify_token():
    """Verify JWT token is valid"""
    current_email = get_jwt_identity()
    return jsonify({'email': current_email, 'valid': True}), 200


@auth_bp.route('/validate-password', methods=['POST'])
def validate_password():
    """Real-time password validation for UX (dodging button).
    Returns whether the password matches, without logging the user in.
    Strictly rate-limited to prevent brute force.
    """
    try:
        client_ip = get_client_ip(request)
        rate_limiter = get_rate_limiter()
        if rate_limiter.is_rate_limited(f"validate_pw:{client_ip}", max_requests=30, window_seconds=60):
            return jsonify({'error': 'Too many attempts'}), 429

        data = request.get_json()
        if not data:
            return jsonify({'valid': False}), 200

        email = InputSanitizer.sanitize_email(data.get('email', ''))
        password = data.get('password', '').strip()

        if not email or not password:
            return jsonify({'valid': False}), 200

        if InputSanitizer.check_nosql_injection(data.get('email', '')):
            return jsonify({'valid': False}), 200

        db = DBConnect().get_db()
        user = db.users.find_one({'email': email})

        if not user:
            return jsonify({'valid': False}), 200

        is_valid = User.verify_password(password, user['password_hash'])
        return jsonify({'valid': is_valid}), 200

    except Exception as e:
        logger.error(f"Validate-password error: {e}")
        return jsonify({'valid': False}), 200


@auth_bp.route('/request-password-reset', methods=['POST'])
def request_password_reset():
    """Issue a password-reset token for an email (no-op for unknown emails).

    Always returns 200 with the same message regardless of whether the email
    exists — prevents account enumeration. Internally:
      1. Generates a 32-char URL-safe token
      2. Stores a record in `password_resets` with email + expiry (30 min)
      3. Logs the full reset URL so an admin can manually relay it until the
         email delivery integration lands.

    Frontend uses this to drive the "we sent you a link" UX. The actual
    /reset-password POST verifies the token and updates the hash.
    """
    import secrets
    from datetime import timedelta
    try:
        client_ip = get_client_ip(request)
        rate_limiter = get_rate_limiter()
        # Stricter rate limit than check-email — defends against using this
        # endpoint as a side-channel oracle.
        if rate_limiter.is_rate_limited(
            f"request_pw_reset:{client_ip}", max_requests=5, window_seconds=900
        ):
            return jsonify({'error': 'Too many attempts. Please try again in 15 minutes.'}), 429

        data = request.get_json(silent=True) or {}
        email = InputSanitizer.sanitize_email(data.get('email', ''))
        if not email:
            # Same body as the success path — never leak validity.
            return jsonify({'ok': True, 'message': 'If that email is registered, a reset link has been sent.'}), 200
        if InputSanitizer.check_nosql_injection(data.get('email', '')):
            return jsonify({'ok': True, 'message': 'If that email is registered, a reset link has been sent.'}), 200

        db = DBConnect().get_db()
        user = db.users.find_one({'email': email})
        if user:
            token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(minutes=30)
            db.password_resets.insert_one({
                'email': email,
                'token': token,
                'created_at': datetime.utcnow(),
                'expires_at': expires_at,
                'used': False,
                'ip': client_ip,
            })
            # Log the URL so an admin/dev can manually relay it. When email
            # delivery is wired up, replace this with a queued SES/SendGrid
            # call — schema does not need to change.
            reset_url = f"/reset-password?token={token}"
            logger.info(
                "Password reset issued for %s (token expires %s): %s",
                mask_email(email), expires_at.isoformat(), reset_url,
            )

        return jsonify({
            'ok': True,
            'message': 'If that email is registered, a reset link has been sent.',
        }), 200
    except Exception as e:
        logger.error(f"request-password-reset error: {e}")
        # Same generic response — don't leak failure mode.
        return jsonify({
            'ok': True,
            'message': 'If that email is registered, a reset link has been sent.',
        }), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Consume a reset token and update the user's password hash.

    Body: { token: str, new_password: str }
    Validates: token exists, not expired, not previously used. On success,
    updates user.password_hash, clears login_attempts, marks token used.
    """
    try:
        client_ip = get_client_ip(request)
        rate_limiter = get_rate_limiter()
        if rate_limiter.is_rate_limited(
            f"reset_pw:{client_ip}", max_requests=10, window_seconds=900
        ):
            return jsonify({'error': 'Too many attempts. Please try again later.'}), 429

        data = request.get_json(silent=True) or {}
        token = str(data.get('token') or '').strip()
        new_password = str(data.get('new_password') or '')
        if not token or not new_password:
            return jsonify({'error': 'Token and new password are required'}), 400
        if len(token) < 16 or len(token) > 100:
            return jsonify({'error': 'Invalid token'}), 400
        if InputSanitizer.check_nosql_injection(token):
            return jsonify({'error': 'Invalid token'}), 400

        valid, msg = User.validate_password(new_password)
        if not valid:
            return jsonify({'error': msg}), 400

        db = DBConnect().get_db()
        record = db.password_resets.find_one({'token': token})
        if not record or record.get('used'):
            return jsonify({'error': 'Reset link is invalid or already used.'}), 400
        expires_at = record.get('expires_at')
        if not expires_at or expires_at < datetime.utcnow():
            return jsonify({'error': 'Reset link has expired. Request a new one.'}), 400

        email = record['email']
        password_hash = User.hash_password(new_password)
        db.users.update_one(
            {'email': email},
            {'$set': {
                'password_hash': password_hash,
                'login_attempts': 0,
                'last_password_reset': datetime.utcnow(),
            }},
        )
        # Mark token used so it can't be replayed.
        db.password_resets.update_one(
            {'_id': record['_id']},
            {'$set': {'used': True, 'used_at': datetime.utcnow()}},
        )
        logger.info("Password reset completed for %s", mask_email(email))
        return jsonify({'ok': True, 'message': 'Password updated. You can now sign in.'}), 200
    except Exception as e:
        logger.error(f"reset-password error: {e}")
        return jsonify({'error': 'Could not reset password'}), 500


@auth_bp.route('/check-email', methods=['POST'])
def check_email():
    """Check if an email is already registered — used by the unified auth flow
    to decide whether to show login or registration fields."""
    try:
        client_ip = get_client_ip(request)
        rate_limiter = get_rate_limiter()
        if rate_limiter.is_rate_limited(f"check_email:{client_ip}", max_requests=20, window_seconds=300):
            return jsonify({'error': 'Too many attempts. Please try again later.'}), 429

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        email = InputSanitizer.sanitize_email(data.get('email', ''))
        if not email:
            return jsonify({'error': 'Email is required'}), 400

        if InputSanitizer.check_nosql_injection(data.get('email', '')):
            return jsonify({'error': 'Invalid input'}), 400

        db = DBConnect().get_db()
        user = db.users.find_one({'email': email})

        return jsonify({'exists': bool(user)}), 200

    except Exception as e:
        logger.error(f"Check-email error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


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
