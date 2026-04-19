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
# Datetime serialization helper
# Nested datetimes live in tailoring_records under:
#   versions[*].created_at
#   versions[*].files.{pdf,docx}.rendered_at
#   application.{applied_at,next_action_date,updated_at}
#   application.interview_dates[*]
#   interview_prep.generated_at
# ------------------------------------------------------------------
def _iso(v):
    return v.isoformat() if hasattr(v, 'isoformat') else v


def _serialize_tailoring_record(rec):
    """Convert datetimes throughout a tailoring record to ISO strings.

    Returns the mutated record for convenience. Handles None-safe access to
    every known datetime-bearing nested field so admin queries don't trip on
    JSON encoding regardless of legacy shape.
    """
    if not rec:
        return rec
    rec.pop('_id', None)

    for k in ('created_at', 'updated_at', 'ats_scored_at'):
        if rec.get(k) is not None:
            rec[k] = _iso(rec[k])

    versions = rec.get('versions') or []
    for v in versions:
        if v.get('created_at') is not None:
            v['created_at'] = _iso(v['created_at'])
        files = v.get('files') or {}
        for f in files.values():
            if isinstance(f, dict) and f.get('rendered_at') is not None:
                f['rendered_at'] = _iso(f['rendered_at'])

    app = rec.get('application')
    if isinstance(app, dict):
        for k in ('applied_at', 'next_action_date', 'updated_at'):
            if app.get(k) is not None:
                app[k] = _iso(app[k])
        dates = app.get('interview_dates')
        if isinstance(dates, list):
            app['interview_dates'] = [_iso(d) for d in dates]

    prep = rec.get('interview_prep')
    if isinstance(prep, dict) and prep.get('generated_at') is not None:
        prep['generated_at'] = _iso(prep['generated_at'])

    return rec


def _summarise_record(rec):
    """Compact summary used by list endpoints — keeps payload small."""
    versions = rec.get('versions') or []
    current_id = rec.get('current_version_id')
    current = next((v for v in versions if v.get('version_id') == current_id), None)
    if not current and versions:
        current = versions[-1]
    files_cached = 0
    sources = set()
    for v in versions:
        sources.add(v.get('source') or 'initial')
        f = v.get('files') or {}
        files_cached += sum(1 for fv in f.values() if isinstance(fv, dict) and fv.get('s3_key'))
    summary = {
        'version_count': len(versions),
        'current_version_number': (current or {}).get('version_number'),
        'current_source': (current or {}).get('source'),
        'files_cached': files_cached,
        'version_sources': sorted(sources),
    }
    app = rec.get('application') or {}
    if app:
        summary['application_status'] = app.get('status')
        summary['applied_at'] = app.get('applied_at')
        summary['next_action_date'] = app.get('next_action_date')
        summary['recruiter_name'] = app.get('recruiter_name')
        summary['recruiter_company'] = app.get('recruiter_company')
    prep = rec.get('interview_prep') or {}
    if prep:
        summary['interview_prep_ready'] = bool(prep.get('generated_at'))
        summary['interview_prep_generated_at'] = prep.get('generated_at')
    return summary


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
        # Legacy rows only — new downloads cache in tailoring_records.versions.files
        legacy_generated = db.user_resumes.count_documents({'type': 'generated'})
        total_tailoring = db.tailoring_records.count_documents({})

        # Users registered in the last 7 / 30 days
        from datetime import timedelta
        now = datetime.utcnow()
        users_7d = db.users.count_documents({'created_at': {'$gte': now - timedelta(days=7)}})
        users_30d = db.users.count_documents({'created_at': {'$gte': now - timedelta(days=30)}})

        # Version + application + prep rollups via aggregation
        # 1. Total versions + cached rendered files across all records
        version_rollup = list(db.tailoring_records.aggregate([
            {'$project': {'versions': {'$ifNull': ['$versions', []]}}},
            {'$project': {
                'version_count': {'$size': '$versions'},
                'cached_pdf': {'$size': {'$filter': {
                    'input': '$versions', 'as': 'v',
                    'cond': {'$and': [
                        {'$ne': [{'$ifNull': ['$$v.files.pdf.s3_key', None]}, None]}
                    ]},
                }}},
                'cached_docx': {'$size': {'$filter': {
                    'input': '$versions', 'as': 'v',
                    'cond': {'$and': [
                        {'$ne': [{'$ifNull': ['$$v.files.docx.s3_key', None]}, None]}
                    ]},
                }}},
            }},
            {'$group': {
                '_id': None,
                'total_versions': {'$sum': '$version_count'},
                'cached_pdf_files': {'$sum': '$cached_pdf'},
                'cached_docx_files': {'$sum': '$cached_docx'},
            }},
        ]))
        versions_stats = version_rollup[0] if version_rollup else {
            'total_versions': 0, 'cached_pdf_files': 0, 'cached_docx_files': 0,
        }
        versions_stats.pop('_id', None)

        # 2. Application pipeline breakdown
        app_rollup = list(db.tailoring_records.aggregate([
            {'$match': {'application.status': {'$exists': True, '$ne': None}}},
            {'$group': {'_id': '$application.status', 'count': {'$sum': 1}}},
        ]))
        applications_by_status = {row['_id']: row['count'] for row in app_rollup}
        total_applications = sum(applications_by_status.values())

        # 3. Interview prep
        total_prep_packs = db.tailoring_records.count_documents(
            {'interview_prep.generated_at': {'$exists': True, '$ne': None}}
        )

        # 4. Recent activity (last 7/30 days of tailoring)
        tailoring_7d = db.tailoring_records.count_documents(
            {'created_at': {'$gte': now - timedelta(days=7)}}
        )
        tailoring_30d = db.tailoring_records.count_documents(
            {'created_at': {'$gte': now - timedelta(days=30)}}
        )

        return jsonify({
            'total_users': total_users,
            'users_7d': users_7d,
            'users_30d': users_30d,
            'total_parsed_resumes': total_parsed,
            'total_base_resumes': total_base_resumes,
            'legacy_generated_resumes': legacy_generated,
            'total_tailoring_sessions': total_tailoring,
            'tailoring_7d': tailoring_7d,
            'tailoring_30d': tailoring_30d,
            'total_versions': versions_stats.get('total_versions', 0),
            'cached_pdf_files': versions_stats.get('cached_pdf_files', 0),
            'cached_docx_files': versions_stats.get('cached_docx_files', 0),
            'total_applications': total_applications,
            'applications_by_status': applications_by_status,
            'total_interview_prep_packs': total_prep_packs,
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

        # Tailoring records — strip heavy fields, keep versions/application/
        # interview_prep shape + run full nested datetime serialization.
        tailoring = list(db.tailoring_records.find(
            {'user_email': email},
            {
                'tailored_resume': 0,          # legacy mirror — use versions[0] instead
                'versions.tailored_resume': 0, # heavy per-version bodies
                'interview_prep.content': 0,   # heavy AI content
                'interview_chat': 0,           # chat transcript (load per-record)
                'jd_text': 0,                  # loaded per-record on demand
            },
        ).sort('created_at', -1))
        for t in tailoring:
            _serialize_tailoring_record(t)
            t['_summary'] = _summarise_record(t)

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
    """List tailoring sessions across all users — admin overview.

    Projection drops heavy bodies (tailored_resume, versions[].tailored_resume,
    interview_prep.content, interview_chat, jd_text) to keep the list light.
    Each record is returned with an inline `_summary` so the admin UI can
    render version count, application status, and prep readiness without
    further requests.
    """
    try:
        db = DBConnect().get_db()
        limit = max(1, min(int(request.args.get('limit', 200)), 1000))
        status_filter = request.args.get('status')  # optional application.status

        query = {}
        if status_filter:
            query['application.status'] = status_filter

        records = list(db.tailoring_records.find(
            query,
            {
                'tailored_resume': 0,
                'versions.tailored_resume': 0,
                'interview_prep.content': 0,
                'interview_chat': 0,
                'jd_text': 0,
            },
        ).sort('created_at', -1).limit(limit))
        for r in records:
            _serialize_tailoring_record(r)
            r['_summary'] = _summarise_record(r)
        return jsonify({'records': records}), 200
    except Exception as e:
        logger.exception(f"Admin tailoring list error: {e}")
        return jsonify({'error': 'Failed to fetch tailoring records'}), 500


# ------------------------------------------------------------------
# GET /api/admin/tailoring/<record_id> — Full record with JD + versions
# ------------------------------------------------------------------
@admin_bp.route('/tailoring/<record_id>', methods=['GET'])
@require_super_admin
def get_tailoring_detail(record_id):
    try:
        db = DBConnect().get_db()
        rec = db.tailoring_records.find_one({'record_id': record_id})
        if not rec:
            return jsonify({'error': 'Record not found'}), 404
        _serialize_tailoring_record(rec)
        rec['_summary'] = _summarise_record(rec)
        # Strip heavy per-version resume bodies by default; keep jd_text + prep.content
        for v in (rec.get('versions') or []):
            v.pop('tailored_resume', None)
        # Optionally include the current version's body
        if request.args.get('include_current_resume') == '1':
            current_id = rec.get('current_version_id')
            full = db.tailoring_records.find_one(
                {'record_id': record_id},
                {'versions': 1, 'current_version_id': 1, '_id': 0},
            )
            for v in (full.get('versions') or []):
                if v.get('version_id') == current_id:
                    rec['current_version_resume'] = v.get('tailored_resume')
                    break
        return jsonify({'record': rec}), 200
    except Exception as e:
        logger.exception(f"Admin tailoring detail error: {e}")
        return jsonify({'error': 'Failed to fetch record'}), 500


# ------------------------------------------------------------------
# GET /api/admin/applications — Application pipeline view
# ------------------------------------------------------------------
@admin_bp.route('/applications', methods=['GET'])
@require_super_admin
def list_applications():
    """Flat view of all application-tracked records across all users.

    Useful to see the global pipeline: who's interviewing, who's waiting on
    a response, who got an offer. Only returns records with an application
    object set (drops raw drafts for brevity).
    """
    try:
        db = DBConnect().get_db()
        query = {'application': {'$exists': True, '$ne': None}}
        status_filter = request.args.get('status')
        if status_filter:
            query['application.status'] = status_filter

        records = list(db.tailoring_records.find(
            query,
            {
                'tailored_resume': 0,
                'versions.tailored_resume': 0,
                'interview_prep': 0,
                'interview_chat': 0,
                'jd_text': 0,
            },
        ).sort('application.updated_at', -1).limit(500))

        out = []
        for r in records:
            _serialize_tailoring_record(r)
            app = r.get('application') or {}
            out.append({
                'record_id': r.get('record_id'),
                'user_email': r.get('user_email'),
                'job_title': (r.get('jd_analysis') or {}).get('job_title'),
                'company': (r.get('jd_analysis') or {}).get('company'),
                'ats_overall': (r.get('ats_scores') or {}).get('overall'),
                'status': app.get('status'),
                'applied_at': app.get('applied_at'),
                'next_action_date': app.get('next_action_date'),
                'next_action_note': app.get('next_action_note'),
                'recruiter_name': app.get('recruiter_name'),
                'recruiter_email': app.get('recruiter_email'),
                'recruiter_company': app.get('recruiter_company'),
                'job_url': app.get('job_url'),
                'created_at': r.get('created_at'),
                'updated_at': r.get('updated_at'),
            })
        return jsonify({'applications': out}), 200
    except Exception as e:
        logger.exception(f"Admin applications error: {e}")
        return jsonify({'error': 'Failed to fetch applications'}), 500


# ------------------------------------------------------------------
# GET /api/admin/interview-prep — Interview-prep coverage view
# ------------------------------------------------------------------
@admin_bp.route('/interview-prep', methods=['GET'])
@require_super_admin
def list_interview_prep():
    """Which records have interview prep generated and when."""
    try:
        db = DBConnect().get_db()
        records = list(db.tailoring_records.find(
            {'interview_prep.generated_at': {'$exists': True, '$ne': None}},
            {
                'record_id': 1,
                'user_email': 1,
                'jd_analysis.job_title': 1,
                'jd_analysis.company': 1,
                'interview_prep.generated_at': 1,
                'interview_prep.grounded_version_id': 1,
                'interview_prep.content.role_type': 1,
                'application.status': 1,
                'created_at': 1,
                '_id': 0,
            },
        ).sort('interview_prep.generated_at', -1).limit(500))
        for r in records:
            for k in ('created_at',):
                if hasattr(r.get(k), 'isoformat'):
                    r[k] = r[k].isoformat()
            prep = r.get('interview_prep') or {}
            if hasattr(prep.get('generated_at'), 'isoformat'):
                prep['generated_at'] = prep['generated_at'].isoformat()
        return jsonify({'prep_packs': records}), 200
    except Exception as e:
        logger.exception(f"Admin prep list error: {e}")
        return jsonify({'error': 'Failed to fetch prep packs'}), 500


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
