"""Super Admin blueprint — admin-only endpoints for user & resume analytics.

Only the super admin (mannesiddardha@gmail.com) can access these endpoints.
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.db_connect import DBConnect
from datetime import datetime
import logging

admin_bp = Blueprint('admin', __name__)
logger = logging.getLogger(__name__)

SUPER_ADMIN_EMAIL = 'mannesiddardha@gmail.com'


def require_super_admin(fn):
    """Decorator: returns 403 unless the JWT identity is the super admin."""
    from functools import wraps

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if get_jwt_identity() != SUPER_ADMIN_EMAIL:
            return jsonify({'error': 'Forbidden'}), 403
        return fn(*args, **kwargs)
    return wrapper


# ------------------------------------------------------------------
# GET /api/admin/stats — Dashboard summary stats
# ------------------------------------------------------------------
@admin_bp.route('/stats', methods=['GET'])
@require_super_admin
def dashboard_stats():
    try:
        db = DBConnect().get_db()

        total_users = db.users.count_documents({})
        total_parsed = db.parsed_resumes.count_documents({})
        total_base_resumes = db.user_resumes.count_documents({'type': 'base'})
        total_generated = db.user_resumes.count_documents({'type': 'generated'})
        total_tailoring = db.tailoring_records.count_documents({})

        # Users registered in the last 7 / 30 days
        from datetime import timedelta
        now = datetime.utcnow()
        users_7d = db.users.count_documents({'created_at': {'$gte': now - timedelta(days=7)}})
        users_30d = db.users.count_documents({'created_at': {'$gte': now - timedelta(days=30)}})

        return jsonify({
            'total_users': total_users,
            'users_7d': users_7d,
            'users_30d': users_30d,
            'total_parsed_resumes': total_parsed,
            'total_base_resumes': total_base_resumes,
            'total_generated_resumes': total_generated,
            'total_tailoring_sessions': total_tailoring,
        }), 200
    except Exception as e:
        logger.error(f"Admin stats error: {e}")
        return jsonify({'error': 'Failed to fetch stats'}), 500


# ------------------------------------------------------------------
# GET /api/admin/users — All registered users with details
# ------------------------------------------------------------------
@admin_bp.route('/users', methods=['GET'])
@require_super_admin
def list_users():
    try:
        db = DBConnect().get_db()
        users = list(db.users.find(
            {},
            {'password_hash': 0}  # Never expose password hashes
        ).sort('created_at', -1))

        result = []
        for u in users:
            email = u.get('email', '')
            # Count resumes for this user
            base_count = db.user_resumes.count_documents({'user_email': email, 'type': 'base'})
            generated_count = db.user_resumes.count_documents({'user_email': email, 'type': 'generated'})
            tailoring_count = db.tailoring_records.count_documents({'user_email': email})
            parsed_resume = db.parsed_resumes.find_one({'user_email': email})

            result.append({
                'id': str(u['_id']),
                'email': email,
                'name': u.get('name'),
                'role': u.get('role'),
                'sector': u.get('sector'),
                'created_at': u['created_at'].isoformat() if u.get('created_at') else None,
                'last_login': u['last_login'].isoformat() if u.get('last_login') else None,
                'last_login_ip': u.get('last_login_ip'),
                'login_attempts': u.get('login_attempts', 0),
                'base_resumes': base_count,
                'generated_resumes': generated_count,
                'tailoring_sessions': tailoring_count,
                'has_parsed_resume': parsed_resume is not None,
            })

        return jsonify({'users': result}), 200
    except Exception as e:
        logger.error(f"Admin list users error: {e}")
        return jsonify({'error': 'Failed to fetch users'}), 500


# ------------------------------------------------------------------
# GET /api/admin/user/<email> — Detailed view for a single user
# ------------------------------------------------------------------
@admin_bp.route('/user/<email>', methods=['GET'])
@require_super_admin
def get_user_detail(email):
    try:
        db = DBConnect().get_db()
        user = db.users.find_one({'email': email}, {'password_hash': 0})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Parsed resume
        parsed = db.parsed_resumes.find_one({'user_email': email}, {'_id': 0})
        if parsed and hasattr(parsed.get('parsed_at'), 'isoformat'):
            parsed['parsed_at'] = parsed['parsed_at'].isoformat()

        # Base resumes
        bases = list(db.user_resumes.find(
            {'user_email': email, 'type': 'base'}, {'_id': 0}
        ).sort('uploaded_at', -1))
        for b in bases:
            for key in ('uploaded_at',):
                if hasattr(b.get(key), 'isoformat'):
                    b[key] = b[key].isoformat()

        # Generated resumes
        generated = list(db.user_resumes.find(
            {'user_email': email, 'type': 'generated'}, {'_id': 0}
        ).sort('generated_at', -1))
        for g in generated:
            for key in ('generated_at',):
                if hasattr(g.get(key), 'isoformat'):
                    g[key] = g[key].isoformat()

        # Tailoring records
        tailoring = list(db.tailoring_records.find(
            {'user_email': email},
            {'_id': 0, 'jd_text': 0, 'tailored_resume': 0}  # Exclude large fields
        ).sort('created_at', -1))
        for t in tailoring:
            for key in ('created_at', 'ats_scored_at'):
                if hasattr(t.get(key), 'isoformat'):
                    t[key] = t[key].isoformat()

        return jsonify({
            'user': {
                'id': str(user['_id']),
                'email': user.get('email'),
                'name': user.get('name'),
                'role': user.get('role'),
                'sector': user.get('sector'),
                'created_at': user['created_at'].isoformat() if user.get('created_at') else None,
                'last_login': user['last_login'].isoformat() if user.get('last_login') else None,
                'last_login_ip': user.get('last_login_ip'),
                'login_attempts': user.get('login_attempts', 0),
                'fingerprint_hash': user.get('fingerprint_hash'),
                'session_id': user.get('session_id'),
            },
            'parsed_resume': parsed,
            'base_resumes': bases,
            'generated_resumes': generated,
            'tailoring_records': tailoring,
        }), 200
    except Exception as e:
        logger.error(f"Admin user detail error: {e}")
        return jsonify({'error': 'Failed to fetch user details'}), 500


# ------------------------------------------------------------------
# GET /api/admin/resumes — All parsed resumes across all users
# ------------------------------------------------------------------
@admin_bp.route('/resumes', methods=['GET'])
@require_super_admin
def list_resumes():
    try:
        db = DBConnect().get_db()
        resumes = list(db.parsed_resumes.find({}, {'_id': 0}).sort('parsed_at', -1))
        for r in resumes:
            if hasattr(r.get('parsed_at'), 'isoformat'):
                r['parsed_at'] = r['parsed_at'].isoformat()
        return jsonify({'resumes': resumes}), 200
    except Exception as e:
        logger.error(f"Admin list resumes error: {e}")
        return jsonify({'error': 'Failed to fetch resumes'}), 500


# ------------------------------------------------------------------
# GET /api/admin/tailoring — All tailoring sessions
# ------------------------------------------------------------------
@admin_bp.route('/tailoring', methods=['GET'])
@require_super_admin
def list_tailoring():
    try:
        db = DBConnect().get_db()
        records = list(db.tailoring_records.find(
            {},
            {'_id': 0, 'jd_text': 0, 'tailored_resume': 0}  # Exclude large blobs
        ).sort('created_at', -1))
        for r in records:
            for key in ('created_at', 'ats_scored_at'):
                if hasattr(r.get(key), 'isoformat'):
                    r[key] = r[key].isoformat()
        return jsonify({'records': records}), 200
    except Exception as e:
        logger.error(f"Admin tailoring list error: {e}")
        return jsonify({'error': 'Failed to fetch tailoring records'}), 500
