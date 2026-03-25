"""
Jobs blueprint — Job search dashboard endpoints.

Authentication uses a single shared password verified against a bcrypt hash.
All other endpoints require a valid JWT obtained from the auth endpoint.
"""
import logging
from datetime import timedelta

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required

from utils.config import _get_config_value
from utils.security import InputSanitizer, get_rate_limiter, get_client_ip

jobs_bp = Blueprint("jobs", __name__)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# POST /api/jobs/auth — Password gate
# ------------------------------------------------------------------

@jobs_bp.route("/auth", methods=["POST"])
def auth():
    """Verify shared password and return a JWT (24 h expiry)."""
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"jobs_auth:{client_ip}", max_requests=5, window_seconds=900):
        return jsonify({"error": "Too many attempts. Try again in 15 minutes."}), 429

    data = request.get_json(force=True) or {}
    password = data.get("password", "")
    if not password or not isinstance(password, str):
        return jsonify({"error": "Password is required"}), 400

    stored_hash = _get_config_value('JOB_SEARCH_PASSWORD_HASH', '')
    if not stored_hash:
        logger.error("JOB_SEARCH_PASSWORD_HASH not configured")
        return jsonify({"error": "Service not configured"}), 503

    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
        return jsonify({"error": "Invalid password"}), 401

    token = create_access_token(
        identity="job_search_user",
        expires_delta=timedelta(days=7),
    )
    return jsonify({"access_token": token}), 200


# ------------------------------------------------------------------
# GET /api/jobs/search
# ------------------------------------------------------------------

@jobs_bp.route("/search", methods=["GET"])
@jwt_required()
def search():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"jobs_search:{client_ip}", max_requests=30, window_seconds=60):
        return jsonify({"error": "Rate limit exceeded"}), 429

    query = InputSanitizer.sanitize_string(request.args.get("q", ""), max_length=200)
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    page = request.args.get("page", "1")
    try:
        page = max(1, int(page))
    except ValueError:
        page = 1

    location = InputSanitizer.sanitize_string(request.args.get("location", ""), max_length=100)
    date_posted = request.args.get("date_posted", "today")
    if date_posted not in ("all", "today", "3days", "week", "month"):
        date_posted = "today"
    remote_only = request.args.get("remote", "").lower() == "true"
    employment_type = request.args.get("type", "")
    if employment_type and employment_type not in ("FULLTIME", "PARTTIME", "INTERN", "CONTRACTOR"):
        employment_type = ""

    try:
        from services.job_service import get_job_service
        svc = get_job_service()
        result = svc.search_jobs(
            query=query,
            page=page,
            location=location,
            date_posted=date_posted,
            remote_only=remote_only,
            employment_type=employment_type,
        )
        return jsonify(result), 200
    except RuntimeError as e:
        if "not configured" in str(e).lower():
            return jsonify({"error": "Job search service not available"}), 503
        logger.error(f"Job search error: {e}")
        return jsonify({"error": "Search failed"}), 500
    except Exception as e:
        logger.error(f"Job search error: {e}")
        return jsonify({"error": "Search failed"}), 500


# ------------------------------------------------------------------
# POST /api/jobs/batch-search
# ------------------------------------------------------------------

@jobs_bp.route("/batch-search", methods=["POST"])
@jwt_required()
def batch_search():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"jobs_batch:{client_ip}", max_requests=10, window_seconds=60):
        return jsonify({"error": "Rate limit exceeded"}), 429

    data = request.get_json(force=True) or {}
    queries = data.get("queries", [])
    if not isinstance(queries, list) or not queries:
        return jsonify({"error": "queries must be a non-empty list"}), 400
    if len(queries) > 8:
        return jsonify({"error": "Maximum 8 queries per batch"}), 400

    # Sanitize each query
    queries = [InputSanitizer.sanitize_string(q, max_length=200) for q in queries if isinstance(q, str)]
    queries = [q for q in queries if q]  # remove empties
    if not queries:
        return jsonify({"error": "No valid queries after sanitization"}), 400

    location = InputSanitizer.sanitize_string(data.get("location", ""), max_length=100)
    date_posted = data.get("date_posted", "today")
    if date_posted not in ("all", "today", "3days", "week", "month"):
        date_posted = "today"
    remote_only = str(data.get("remote", "")).lower() == "true"
    employment_type = data.get("type", "")
    if employment_type and employment_type not in ("FULLTIME", "PARTTIME", "INTERN", "CONTRACTOR"):
        employment_type = ""

    try:
        from services.job_service import get_job_service
        svc = get_job_service()
        result = svc.batch_search_jobs(
            queries=queries,
            location=location,
            date_posted=date_posted,
            remote_only=remote_only,
            employment_type=employment_type,
        )
        return jsonify(result), 200
    except RuntimeError as e:
        if "not configured" in str(e).lower():
            return jsonify({"error": "Job search service not available"}), 503
        logger.error(f"Batch search error: {e}")
        return jsonify({"error": "Batch search failed"}), 500
    except Exception as e:
        logger.error(f"Batch search error: {e}")
        return jsonify({"error": "Batch search failed"}), 500


# ------------------------------------------------------------------
# POST /api/jobs/analyze
# ------------------------------------------------------------------

@jobs_bp.route("/analyze", methods=["POST"])
@jwt_required()
def analyze():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"jobs_analyze:{client_ip}", max_requests=10, window_seconds=60):
        return jsonify({"error": "Rate limit exceeded"}), 429

    data = request.get_json(force=True) or {}
    job = data.get("job")
    action = data.get("action", "")
    if not job or not isinstance(job, dict):
        return jsonify({"error": "Job data is required"}), 400
    if action not in ("summarize", "missing_skills", "cover_letter"):
        return jsonify({"error": "Invalid action"}), 400

    try:
        from services.job_service import get_job_service
        result = get_job_service().analyze_job(job, action)
        return jsonify({"result": result, "action": action}), 200
    except Exception as e:
        logger.error(f"Job analysis error: {e}")
        return jsonify({"error": "Analysis failed"}), 500


# ------------------------------------------------------------------
# POST /api/jobs/tailor-resume
# ------------------------------------------------------------------

@jobs_bp.route("/tailor-resume", methods=["POST"])
@jwt_required()
def tailor_resume():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"jobs_tailor:{client_ip}", max_requests=10, window_seconds=60):
        return jsonify({"error": "Rate limit exceeded"}), 429

    data = request.get_json(force=True) or {}
    job_description = data.get("job_description", "")
    if not job_description or not isinstance(job_description, str):
        return jsonify({"error": "job_description is required"}), 400

    job_description = InputSanitizer.sanitize_string(job_description, max_length=6000)
    if not job_description:
        return jsonify({"error": "Invalid job description"}), 400

    try:
        from services.resume_service import get_resume_service
        svc = get_resume_service()

        # Extract JD → get structured resume → tailor
        jd_analysis = svc.extract_jd(job_description)
        resume = svc.parser.get_structured_resume()
        if not resume:
            return jsonify({"error": "No resume uploaded"}), 404

        structured = resume.get("structured")
        if not structured:
            raw_text = resume.get("raw_text", "")
            if not raw_text:
                return jsonify({"error": "Resume data unavailable. Please re-upload."}), 404
            structured = svc.parser.parse_to_structured(raw_text)

        tailored = svc.tailor.tailor(structured, jd_analysis)

        # Map to the simpler format expected by the job search UI
        from schemas.resume_schemas import flatten_skills
        result = {
            "summary": tailored.get("summary", ""),
            "skills": flatten_skills(tailored),
            "experience_bullets": [
                b for exp in tailored.get("experience", [])
                for b in exp.get("bullets", [])
            ],
            "keywords_to_add": jd_analysis.get("keywords", []),
        }
        return jsonify({"tailored": result}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Resume tailoring error: {e}")
        return jsonify({"error": "Failed to tailor resume"}), 500


# ------------------------------------------------------------------
# POST /api/jobs/resume  (multipart PDF upload)
# GET  /api/jobs/resume
# ------------------------------------------------------------------

@jobs_bp.route("/resume", methods=["POST"])
@jwt_required()
def upload_resume():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"jobs_resume:{client_ip}", max_requests=5, window_seconds=3600):
        return jsonify({"error": "Rate limit exceeded. Max 5 uploads per hour."}), 429

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are accepted"}), 400

    # 5 MB limit
    file_bytes = file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        return jsonify({"error": "File too large (max 5 MB)"}), 400

    try:
        from services.resume_service import get_resume_service
        svc = get_resume_service()
        parsed = svc.parser.upload_and_parse(file_bytes)

        # Return flat format matching the job search UI's ParsedResume type
        return jsonify({
            "resume": {
                "skills": parsed.get("skills", []),
                "experience_years": parsed.get("experience_years", 0),
                "education": parsed.get("education", []),
                "certifications": parsed.get("certifications", []),
                "job_titles": parsed.get("job_titles", []),
                "summary": parsed.get("summary", ""),
            }
        }), 200
    except ValueError as e:
        logger.error(f"PDF parsing error: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Resume parsing error: {e}")
        return jsonify({"error": "Failed to parse resume"}), 500


@jobs_bp.route("/resume", methods=["GET"])
@jwt_required()
def get_resume():
    try:
        from services.resume_service import get_resume_service
        resume = get_resume_service().get_base_resume()
        if not resume:
            return jsonify({"error": "No resume uploaded yet"}), 404
        if hasattr(resume.get('parsed_at'), 'isoformat'):
            resume['parsed_at'] = resume['parsed_at'].isoformat()
        return jsonify({"resume": resume}), 200
    except Exception as e:
        logger.error(f"Get resume error: {e}")
        return jsonify({"error": "Failed to retrieve resume"}), 500


# ------------------------------------------------------------------
# Saved Jobs CRUD
# ------------------------------------------------------------------

@jobs_bp.route("/saved", methods=["GET"])
@jwt_required()
def list_saved():
    try:
        from services.job_service import get_job_service
        jobs = get_job_service().get_saved_jobs()
        return jsonify({"jobs": jobs}), 200
    except Exception as e:
        logger.error(f"List saved jobs error: {e}")
        return jsonify({"error": "Failed to load saved jobs"}), 500


@jobs_bp.route("/saved", methods=["POST"])
@jwt_required()
def save_job():
    data = request.get_json(force=True) or {}
    job = data.get("job")
    if not job or not isinstance(job, dict):
        return jsonify({"error": "Job data is required"}), 400
    try:
        from services.job_service import get_job_service
        saved = get_job_service().save_job(job)
        return jsonify({"job": saved}), 201
    except Exception as e:
        logger.error(f"Save job error: {e}")
        return jsonify({"error": "Failed to save job"}), 500


@jobs_bp.route("/saved/<job_id>", methods=["PUT"])
@jwt_required()
def update_saved(job_id):
    data = request.get_json(force=True) or {}
    status = data.get("status")
    notes = data.get("notes")
    if status and status not in ("interested", "applied", "interview", "offer", "rejected", "withdrawn"):
        return jsonify({"error": "Invalid status"}), 400
    try:
        from services.job_service import get_job_service
        updated = get_job_service().update_saved_job(job_id, status=status, notes=notes)
        if not updated:
            return jsonify({"error": "Job not found"}), 404
        return jsonify({"job": updated}), 200
    except Exception as e:
        logger.error(f"Update saved job error: {e}")
        return jsonify({"error": "Failed to update job"}), 500


@jobs_bp.route("/saved/<job_id>", methods=["DELETE"])
@jwt_required()
def delete_saved(job_id):
    try:
        from services.job_service import get_job_service
        deleted = get_job_service().delete_saved_job(job_id)
        if not deleted:
            return jsonify({"error": "Job not found"}), 404
        return jsonify({"message": "Job removed"}), 200
    except Exception as e:
        logger.error(f"Delete saved job error: {e}")
        return jsonify({"error": "Failed to delete job"}), 500
