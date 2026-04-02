"""Super Admin blueprint — admin-only endpoints for user & resume analytics.

Only the super admin (mannesiddardha@gmail.com) can access these endpoints.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.db_connect import DBConnect
from datetime import datetime, timedelta
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


# ------------------------------------------------------------------
# GET /api/admin/resume-url?s3_key=... — Presigned download URL
# ------------------------------------------------------------------
@admin_bp.route('/resume-url', methods=['GET'])
@require_super_admin
def get_resume_presigned_url():
    """Generate a presigned S3 URL so the admin can view/download a user resume."""
    CONTENT_TYPES = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'txt': 'text/plain',
    }
    try:
        s3_key = request.args.get('s3_key', '').strip()
        if not s3_key:
            return jsonify({'error': 's3_key query parameter is required'}), 400

        disposition = request.args.get('disposition', 'inline').strip()
        filename = request.args.get('filename', '').strip()

        import boto3, os
        bucket = os.getenv('RESUME_S3_BUCKET', '')
        if not bucket:
            return jsonify({'error': 'S3 bucket not configured'}), 500

        # Detect content type from s3_key or filename
        name_for_ext = filename or s3_key.split('/')[-1]
        ext = name_for_ext.rsplit('.', 1)[-1].lower() if '.' in name_for_ext else ''
        content_type = CONTENT_TYPES.get(ext, 'application/octet-stream')

        params = {'Bucket': bucket, 'Key': s3_key, 'ResponseContentType': content_type}
        if disposition == 'attachment' and filename:
            params['ResponseContentDisposition'] = f'attachment; filename="{filename}"'
        elif disposition == 'attachment':
            params['ResponseContentDisposition'] = 'attachment'

        client = boto3.client('s3')
        url = client.generate_presigned_url(
            'get_object',
            Params=params,
            ExpiresIn=3600,
        )
        return jsonify({'url': url, 'content_type': content_type}), 200
    except Exception as e:
        logger.error(f"Admin presigned URL error: {e}")
        return jsonify({'error': 'Failed to generate download URL'}), 500


# ------------------------------------------------------------------
# GET /api/admin/activity — Recent activity feed
# ------------------------------------------------------------------
@admin_bp.route('/activity', methods=['GET'])
@require_super_admin
def activity_feed():
    """Return recent activity across registrations, logins, uploads, and tailoring."""
    try:
        db = DBConnect().get_db()
        now = datetime.utcnow()
        since = now - timedelta(days=30)
        activities = []

        # Recent registrations
        new_users = list(db.users.find(
            {'created_at': {'$gte': since}},
            {'email': 1, 'name': 1, 'created_at': 1, '_id': 0}
        ).sort('created_at', -1).limit(20))
        for u in new_users:
            activities.append({
                'type': 'registration',
                'email': u.get('email'),
                'name': u.get('name'),
                'timestamp': u['created_at'].isoformat() if u.get('created_at') else None,
            })

        # Recent logins (users who logged in recently)
        recent_logins = list(db.users.find(
            {'last_login': {'$gte': since}},
            {'email': 1, 'name': 1, 'last_login': 1, '_id': 0}
        ).sort('last_login', -1).limit(20))
        for u in recent_logins:
            activities.append({
                'type': 'login',
                'email': u.get('email'),
                'name': u.get('name'),
                'timestamp': u['last_login'].isoformat() if u.get('last_login') else None,
            })

        # Recent resume uploads
        recent_uploads = list(db.user_resumes.find(
            {'type': 'base', 'uploaded_at': {'$gte': since}},
            {'user_email': 1, 'filename': 1, 'uploaded_at': 1, '_id': 0}
        ).sort('uploaded_at', -1).limit(20))
        for r in recent_uploads:
            activities.append({
                'type': 'upload',
                'email': r.get('user_email'),
                'detail': r.get('filename'),
                'timestamp': r['uploaded_at'].isoformat() if r.get('uploaded_at') else None,
            })

        # Recent tailoring sessions
        recent_tailoring = list(db.tailoring_records.find(
            {'created_at': {'$gte': since}},
            {'user_email': 1, 'jd_analysis.job_title': 1, 'jd_analysis.company': 1,
             'ats_scores.overall': 1, 'created_at': 1, '_id': 0}
        ).sort('created_at', -1).limit(20))
        for t in recent_tailoring:
            activities.append({
                'type': 'tailoring',
                'email': t.get('user_email'),
                'detail': t.get('jd_analysis', {}).get('job_title'),
                'company': t.get('jd_analysis', {}).get('company'),
                'ats_score': t.get('ats_scores', {}).get('overall'),
                'timestamp': t['created_at'].isoformat() if t.get('created_at') else None,
            })

        # Sort all by timestamp descending
        activities.sort(key=lambda a: a.get('timestamp') or '', reverse=True)

        return jsonify({'activities': activities[:50]}), 200
    except Exception as e:
        logger.error(f"Admin activity feed error: {e}")
        return jsonify({'error': 'Failed to fetch activity feed'}), 500
