"""
Resume blueprint — Resume tailoring, ATS scoring, and document generation endpoints.

Reuses the same JWT from /api/jobs/auth (job_search_token).

Async pattern: Gemini endpoints submit a job, Lambda processes it
asynchronously, and the frontend polls GET /job/<id> for the result.
  1. POST /extract-jd   → returns { job_id }   (instant)
  2. POST /tailor       → returns { job_id }   (instant)
  3. POST /ats-scores   → returns { job_id }   (instant)
  4. GET  /job/<id>     → returns { status, result | error }

User-specific endpoints with S3 storage:
  5. POST /upload       → parse PDF + store in S3
  6. POST /download     → generate PDF/DOCX + store in S3
  7. GET  /status       → check active base resume for user
  8. GET  /versions     → list base resume versions
  9. GET  /generated    → list generated/tailored resumes
 10. PUT  /active       → set active base resume
 11. GET  /download-file/<s3_key> → download resume from S3
 12. DELETE /file/<s3_key>        → delete resume from S3
"""
import io
import logging
from datetime import datetime

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity

from utils.security import InputSanitizer, get_rate_limiter, get_client_ip
from utils.db_connect import DBConnect
from services.s3_service import get_storage_service

resume_bp = Blueprint("resume", __name__)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# POST /api/resume/extract-jd — Submit JD extraction job
# ------------------------------------------------------------------

@resume_bp.route("/extract-jd", methods=["POST"])
@jwt_required()
def extract_jd():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"resume_tailor:{client_ip}", max_requests=10, window_seconds=300):
        return jsonify({"error": "Rate limit exceeded. Try again in a few minutes."}), 429

    data = request.get_json(force=True) or {}
    jd_text = data.get("job_description", "")
    if not jd_text or not isinstance(jd_text, str):
        return jsonify({"error": "job_description is required"}), 400

    jd_text = InputSanitizer.sanitize_string(jd_text, max_length=10000)
    if not jd_text:
        return jsonify({"error": "Invalid job description"}), 400

    try:
        from services.resume_service import get_resume_service, ResumeService
        svc = get_resume_service()
        user_email = get_jwt_identity()
        job_id = svc.create_job("extract_jd", {"job_description": jd_text}, user_email=user_email)
        ResumeService.invoke_async(job_id, "extract_jd", {"job_description": jd_text})
        return jsonify({"job_id": job_id}), 202

    except Exception as e:
        logger.error(f"JD extraction error: {e}")
        return jsonify({"error": "Failed to start JD analysis. Please try again."}), 500


# ------------------------------------------------------------------
# POST /api/resume/tailor — Submit resume tailoring job
# ------------------------------------------------------------------

@resume_bp.route("/tailor", methods=["POST"])
@jwt_required()
def tailor():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"resume_tailor:{client_ip}", max_requests=10, window_seconds=300):
        return jsonify({"error": "Rate limit exceeded. Try again in a few minutes."}), 429

    data = request.get_json(force=True) or {}
    jd_analysis = data.get("jd_analysis")
    if not jd_analysis or not isinstance(jd_analysis, dict):
        return jsonify({"error": "jd_analysis is required"}), 400

    try:
        user_email = get_jwt_identity()
        from services.resume_service import get_resume_service, ResumeService
        svc = get_resume_service()
        payload = {"jd_analysis": jd_analysis, "user_email": user_email}
        job_id = svc.create_job("tailor", payload, user_email=user_email)
        ResumeService.invoke_async(job_id, "tailor", payload)
        return jsonify({"job_id": job_id}), 202

    except Exception as e:
        logger.error(f"Resume tailor error: {e}")
        return jsonify({"error": "Failed to start resume tailoring. Please try again."}), 500


# ------------------------------------------------------------------
# POST /api/resume/regenerate — Regenerate tailored resume with user feedback
# ------------------------------------------------------------------
@resume_bp.route("/regenerate", methods=["POST"])
@jwt_required()
def regenerate():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"resume_regen:{client_ip}", max_requests=10, window_seconds=300):
        return jsonify({"error": "Rate limit exceeded. Try again in a few minutes."}), 429

    data = request.get_json(force=True) or {}
    jd_analysis = data.get("jd_analysis")
    tailored_resume = data.get("tailored_resume")
    user_feedback = data.get("user_feedback", "").strip()

    if not jd_analysis or not isinstance(jd_analysis, dict):
        return jsonify({"error": "jd_analysis is required"}), 400
    if not tailored_resume or not isinstance(tailored_resume, dict):
        return jsonify({"error": "tailored_resume is required"}), 400
    if not user_feedback:
        return jsonify({"error": "user_feedback is required"}), 400
    if len(user_feedback) > 2000:
        return jsonify({"error": "Feedback too long (max 2000 characters)"}), 400

    try:
        user_email = get_jwt_identity()
        from services.resume_service import get_resume_service, ResumeService
        svc = get_resume_service()
        payload = {
            "jd_analysis": jd_analysis,
            "tailored_resume": tailored_resume,
            "user_feedback": user_feedback,
            "user_email": user_email,
        }
        job_id = svc.create_job("regenerate", payload, user_email=user_email)
        ResumeService.invoke_async(job_id, "regenerate", payload)
        return jsonify({"job_id": job_id}), 202

    except Exception as e:
        logger.error(f"Resume regenerate error: {e}")
        return jsonify({"error": "Failed to start resume regeneration. Please try again."}), 500


# ------------------------------------------------------------------
# POST /api/resume/rewrite-bullet — Rewrite a single bullet with JD context
# ------------------------------------------------------------------
@resume_bp.route("/rewrite-bullet", methods=["POST"])
@jwt_required()
def rewrite_bullet():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"rewrite_bullet:{client_ip}", max_requests=30, window_seconds=300):
        return jsonify({"error": "Rate limit exceeded. Try again in a few minutes."}), 429

    data = request.get_json(force=True) or {}
    bullet = data.get("bullet", "").strip()
    job_title = data.get("job_title", "")
    company = data.get("company", "")
    jd_keywords = data.get("jd_keywords", [])

    if not bullet:
        return jsonify({"error": "bullet is required"}), 400
    if len(bullet) > 1000:
        return jsonify({"error": "Bullet too long (max 1000 chars)"}), 400

    try:
        from services.gemini_client import gemini_json, GEMINI_FLASH

        keyword_ctx = f"Target keywords: {', '.join(jd_keywords[:20])}\n" if jd_keywords else ""
        role_ctx = f"Target role: {job_title}" + (f" at {company}" if company else "") + "\n" if job_title else ""

        from services.gemini_client import gemini_json, GEMINI_FLASH

        prompt = (
            "Rewrite this resume bullet to be more impactful and ATS-optimized.\n\n"
            f"{role_ctx}{keyword_ctx}"
            "RULES:\n"
            "- Start with a strong action verb.\n"
            "- Follow: Action Verb + Technology + Impact.\n"
            "- MUST be ONE single sentence, max 200 characters.\n"
            "- Do NOT invent metrics or technologies.\n"
            "- No buzzwords.\n\n"
            f"ORIGINAL: {bullet}\n\n"
            'Respond with exactly: {"rewritten": "your single sentence here"}'
        )

        schema = {"rewritten": str}
        result = gemini_json(prompt, max_tokens=2048, temperature=0.4, model=GEMINI_FLASH, schema=schema)
        rewritten = result.get("rewritten", "").strip()
        # Strip any leading/trailing quotes Gemini may have added
        if rewritten.startswith('"'):
            rewritten = rewritten.lstrip('"')
        if rewritten.endswith('"'):
            rewritten = rewritten.rstrip('"')

        if not rewritten:
            return jsonify({"rewritten": bullet}), 200
        return jsonify({"rewritten": rewritten}), 200

    except Exception as e:
        logger.error(f"Bullet rewrite error: {e}", exc_info=True)
        return jsonify({"error": f"Rewrite failed: {str(e)[:200]}"}), 500


# ------------------------------------------------------------------
# POST /api/resume/ats-scores — Submit ATS scoring job
# ------------------------------------------------------------------

@resume_bp.route("/ats-scores", methods=["POST"])
@jwt_required()
def ats_scores():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"resume_ats:{client_ip}", max_requests=10, window_seconds=300):
        return jsonify({"error": "Rate limit exceeded. Try again in a few minutes."}), 429

    data = request.get_json(force=True) or {}
    tailored = data.get("tailored_resume")
    jd_analysis = data.get("jd_analysis")

    if not tailored or not isinstance(tailored, dict):
        return jsonify({"error": "tailored_resume is required"}), 400
    if not jd_analysis or not isinstance(jd_analysis, dict):
        return jsonify({"error": "jd_analysis is required"}), 400

    try:
        from services.resume_service import get_resume_service, ResumeService
        svc = get_resume_service()
        user_email = get_jwt_identity()
        payload = {"tailored_resume": tailored, "jd_analysis": jd_analysis}
        job_id = svc.create_job("ats_scores", payload, user_email=user_email)
        ResumeService.invoke_async(job_id, "ats_scores", payload)
        return jsonify({"job_id": job_id}), 202

    except Exception as e:
        logger.error(f"ATS scoring error: {e}")
        return jsonify({"error": "Failed to start ATS scoring. Please try again."}), 500


# ------------------------------------------------------------------
# POST /api/resume/cover-letter — Generate a cover letter
# ------------------------------------------------------------------
@resume_bp.route("/cover-letter", methods=["POST"])
@jwt_required()
def cover_letter():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"cover_letter:{client_ip}", max_requests=10, window_seconds=300):
        return jsonify({"error": "Rate limit exceeded. Try again in a few minutes."}), 429

    data = request.get_json(force=True) or {}
    tailored_resume = data.get("tailored_resume")
    jd_analysis = data.get("jd_analysis")

    if not tailored_resume or not isinstance(tailored_resume, dict):
        return jsonify({"error": "tailored_resume is required"}), 400
    if not jd_analysis or not isinstance(jd_analysis, dict):
        return jsonify({"error": "jd_analysis is required"}), 400

    try:
        user_email = get_jwt_identity()
        from services.resume_service import get_resume_service, ResumeService
        svc = get_resume_service()
        payload = {
            "tailored_resume": tailored_resume,
            "jd_analysis": jd_analysis,
            "user_email": user_email,
        }
        job_id = svc.create_job("cover_letter", payload, user_email=user_email)
        ResumeService.invoke_async(job_id, "cover_letter", payload)
        return jsonify({"job_id": job_id}), 202

    except Exception as e:
        logger.error(f"Cover letter error: {e}")
        return jsonify({"error": "Failed to start cover letter generation"}), 500


# ------------------------------------------------------------------
# POST /api/resume/batch-tailor — Submit multiple JDs for parallel tailoring
# ------------------------------------------------------------------
@resume_bp.route("/batch-tailor", methods=["POST"])
@jwt_required()
def batch_tailor():
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"batch_tailor:{client_ip}", max_requests=3, window_seconds=600):
        return jsonify({"error": "Rate limit exceeded. Max 3 batch submissions per 10 minutes."}), 429

    data = request.get_json(force=True) or {}
    jd_list = data.get("jd_list", [])

    if not isinstance(jd_list, list) or len(jd_list) == 0:
        return jsonify({"error": "jd_list is required (array of JD objects)"}), 400
    if len(jd_list) > 5:
        return jsonify({"error": "Maximum 5 job descriptions per batch"}), 400

    for i, jd in enumerate(jd_list):
        if not isinstance(jd, dict) or not jd.get("text", "").strip():
            return jsonify({"error": f"JD #{i+1} is missing text"}), 400

    try:
        user_email = get_jwt_identity()
        from services.resume_service import get_resume_service, ResumeService
        svc = get_resume_service()

        jobs = []
        for jd in jd_list:
            # Each JD goes through: extract_jd → tailor (handled by batch_tailor_item job type)
            payload = {
                "jd_text": jd["text"].strip()[:15000],
                "jd_title": jd.get("title", "").strip(),
                "user_email": user_email,
            }
            job_id = svc.create_job("batch_tailor_item", payload, user_email=user_email)
            ResumeService.invoke_async(job_id, "batch_tailor_item", payload)
            jobs.append({"job_id": job_id, "title": jd.get("title", "")})

        return jsonify({"jobs": jobs}), 202

    except Exception as e:
        logger.error(f"Batch tailor error: {e}")
        return jsonify({"error": "Failed to start batch tailoring"}), 500


# ------------------------------------------------------------------
# GET /api/resume/tailoring-records — List user's tailoring history
# ------------------------------------------------------------------
@resume_bp.route("/tailoring-records", methods=["GET"])
@jwt_required()
def list_tailoring_records():
    user_email = get_jwt_identity()
    try:
        db = DBConnect().get_db()
        records = list(
            db.tailoring_records.find(
                {"user_email": user_email},
                {
                    "record_id": 1,
                    "jd_analysis.job_title": 1,
                    "jd_analysis.company": 1,
                    "tailored_resume": 1,
                    "jd_analysis": 1,
                    "ats_scores.overall": 1,
                    "created_at": 1,
                    "ats_scored_at": 1,
                    "base_resume_filename": 1,
                    "_id": 0,
                },
            )
            .sort("created_at", -1)
            .limit(50)
        )
        # Serialize datetime fields
        for r in records:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
            if r.get("ats_scored_at"):
                r["ats_scored_at"] = r["ats_scored_at"].isoformat()
        return jsonify({"records": records}), 200
    except Exception as e:
        logger.error(f"List tailoring records error: {e}")
        return jsonify({"error": "Failed to load tailoring history"}), 500


# ------------------------------------------------------------------
# POST /api/resume/save-record — Store complete tailoring session
# ------------------------------------------------------------------

@resume_bp.route("/save-record", methods=["POST"])
@jwt_required()
def save_record():
    """Store a complete tailoring session record for admin analytics.
    Called automatically by the frontend after tailoring completes,
    and updated again after ATS scoring (if performed)."""
    user_email = get_jwt_identity()
    data = request.get_json(force=True) or {}

    record_id = data.get("record_id")  # None on first save, provided for ATS update
    jd_text = data.get("jd_text", "")
    jd_analysis = data.get("jd_analysis")
    tailored_resume = data.get("tailored_resume")
    ats_scores = data.get("ats_scores")
    base_resume_filename = data.get("base_resume_filename", "")
    base_resume_s3_key = data.get("base_resume_s3_key", "")

    if not record_id and (not jd_analysis or not tailored_resume):
        return jsonify({"error": "jd_analysis and tailored_resume are required"}), 400

    try:
        db = DBConnect().get_db()
        col = db.tailoring_records

        if record_id:
            # Update existing record with ATS scores
            update = {"$set": {"ats_scores": ats_scores, "ats_scored_at": datetime.utcnow()}}
            col.update_one({"record_id": record_id, "user_email": user_email}, update)
            return jsonify({"record_id": record_id, "updated": True}), 200

        # Create new record
        import uuid as _uuid
        rid = str(_uuid.uuid4())
        record = {
            "record_id": rid,
            "user_email": user_email,
            "base_resume_filename": base_resume_filename,
            "base_resume_s3_key": base_resume_s3_key,
            "jd_text": jd_text[:15000] if jd_text else "",
            "jd_analysis": jd_analysis,
            "tailored_resume": tailored_resume,
            "ats_scores": ats_scores,
            "created_at": datetime.utcnow(),
            "ats_scored_at": datetime.utcnow() if ats_scores else None,
        }
        col.insert_one(record)
        logger.info(f"Tailoring record saved: {rid} for {user_email}")
        return jsonify({"record_id": rid}), 201

    except Exception as e:
        logger.error(f"Save record error: {e}")
        return jsonify({"error": "Failed to save record"}), 500


# ------------------------------------------------------------------
# GET /api/resume/job/<job_id> — Poll for job result
# ------------------------------------------------------------------

@resume_bp.route("/job/<job_id>", methods=["GET"])
@jwt_required()
def get_job(job_id):
    try:
        from services.resume_service import get_resume_service
        user_email = get_jwt_identity()
        job = get_resume_service().get_job(job_id, user_email=user_email)
        if not job:
            return jsonify({"error": "Job not found"}), 404
        for key in ("created_at", "completed_at"):
            if hasattr(job.get(key), 'isoformat'):
                job[key] = job[key].isoformat()
        return jsonify(job), 200
    except Exception as e:
        logger.error(f"Job status error: {e}")
        return jsonify({"error": "Failed to check job status"}), 500


# ------------------------------------------------------------------
# POST /api/resume/download — Generate PDF or DOCX
# ------------------------------------------------------------------

@resume_bp.route("/download", methods=["POST"])
@jwt_required()
def download():
    user_email = get_jwt_identity()
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"resume_download:{client_ip}", max_requests=20, window_seconds=300):
        return jsonify({"error": "Rate limit exceeded"}), 429

    data = request.get_json(force=True) or {}
    tailored = data.get("tailored_resume")
    jd_analysis = data.get("jd_analysis", {})
    fmt = data.get("format", "pdf")

    if not tailored or not isinstance(tailored, dict):
        return jsonify({"error": "tailored_resume is required"}), 400
    if fmt not in ("pdf", "docx"):
        return jsonify({"error": "format must be 'pdf' or 'docx'"}), 400

    try:
        from services.resume_service import get_resume_service
        svc = get_resume_service()

        if fmt == "pdf":
            file_bytes = svc.renderer.generate_pdf(tailored)
            mimetype = "application/pdf"
        else:
            file_bytes = svc.renderer.generate_docx(tailored)
            mimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        if not file_bytes or len(file_bytes) < 100:
            return jsonify({"error": "Failed to generate document"}), 500

        filename = svc.renderer.build_filename(tailored, jd_analysis, fmt)

        # Upload generated resume to S3 and store metadata
        try:
            storage = get_storage_service()
            db = DBConnect().get_db()
            user = db.users.find_one({'email': user_email})
            if user:
                user_id = str(user['_id'])
                job_title = data.get('job_title', 'untitled')
                s3_key = storage.upload_generated_resume(user_id, file_bytes, job_title, fmt)
                db.user_resumes.insert_one({
                    'user_email': user_email,
                    'user_id': user_id,
                    'type': 'generated',
                    's3_key': s3_key,
                    'filename': f"{job_title}_tailored.{fmt}",
                    'generated_at': datetime.utcnow(),
                    'size_bytes': len(file_bytes),
                    'job_title': job_title
                })
        except Exception as s3_err:
            logger.warning(f"Failed to save generated resume to S3: {s3_err}")

        return send_file(
            io.BytesIO(file_bytes),
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logger.error(f"Resume download error: {e}")
        return jsonify({"error": "Failed to generate document"}), 500


# ------------------------------------------------------------------
# POST /api/resume/upload — Upload and parse a new resume PDF
# ------------------------------------------------------------------

@resume_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload():
    user_email = get_jwt_identity()
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"resume_upload:{client_ip}", max_requests=5, window_seconds=3600):
        return jsonify({"error": "Rate limit exceeded. Max 5 uploads per hour."}), 429

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    allowed_extensions = (".pdf", ".docx")
    if not file.filename or not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
        return jsonify({"error": "Only PDF and DOCX files are accepted"}), 400

    file_bytes = file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        return jsonify({"error": "File too large (max 5 MB)"}), 400

    is_pdf = file.filename.lower().endswith(".pdf")
    if is_pdf and not file_bytes[:5].startswith(b'%PDF'):
        return jsonify({"error": "File is not a valid PDF"}), 400

    original_filename = file.filename

    try:
        from services.resume_service import get_resume_service, ResumeService
        from services.resume_parser import ResumeParser

        # Validate file structure (lightweight, no text extraction)
        ResumeParser.validate_file(file_bytes, original_filename)

        # Upload file to S3 and store metadata
        try:
            storage = get_storage_service()
            db = DBConnect().get_db()
            user = db.users.find_one({'email': user_email})
            if user:
                user_id = str(user['_id'])
                s3_key = storage.upload_base_resume(user_id, file_bytes, original_filename)
                db.user_resumes.insert_one({
                    'user_email': user_email,
                    'user_id': user_id,
                    'type': 'base',
                    's3_key': s3_key,
                    'filename': original_filename,
                    'uploaded_at': datetime.utcnow(),
                    'size_bytes': len(file_bytes),
                    'is_active': True
                })
                # Deactivate previous base resumes
                db.user_resumes.update_many(
                    {'user_email': user_email, 'type': 'base', 's3_key': {'$ne': s3_key}},
                    {'$set': {'is_active': False}}
                )
        except Exception as s3_err:
            logger.warning(f"Failed to save resume to S3: {s3_err}")

        # Async: create a job for Gemini multi-modal parsing and return job_id immediately
        import base64
        file_b64 = base64.b64encode(file_bytes).decode('utf-8')
        mime_type = ResumeParser.get_mime_type(original_filename)

        svc = get_resume_service()
        payload = {
            "file_base64": file_b64,
            "mime_type": mime_type,
            "user_email": user_email,
        }
        job_id = svc.create_job("upload_parse", payload, user_email=user_email)
        ResumeService.invoke_async(job_id, "upload_parse", payload)

        return jsonify({"job_id": job_id}), 202

    except ValueError as e:
        logger.error(f"File validation error: {e}")
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        logger.error(f"Configuration error: {e}")
        return jsonify({"error": f"AI service is not configured: {str(e)}"}), 503
    except Exception as e:
        logger.error(f"Resume upload error: {e}")
        return jsonify({"error": "Failed to process resume upload"}), 500


# ------------------------------------------------------------------
# GET /api/resume/status — Check if a resume is uploaded (user-specific)
# ------------------------------------------------------------------

@resume_bp.route("/status", methods=["GET"])
@jwt_required()
def status():
    user_email = get_jwt_identity()
    try:
        db = DBConnect().get_db()
        # Check for active base resume for this user
        active_resume = db.user_resumes.find_one(
            {'user_email': user_email, 'type': 'base', 'is_active': True}
        )

        from services.resume_service import get_resume_service
        resume = get_resume_service().get_base_resume(user_email=user_email)
        if not resume:
            return jsonify({"has_resume": False}), 200
        parsed_at = resume.get("parsed_at", "")
        if hasattr(parsed_at, 'isoformat'):
            parsed_at = parsed_at.isoformat()
        response = {
            "has_resume": True,
            "skills": resume.get("skills", []),
            "experience_years": resume.get("experience_years"),
            "job_titles": resume.get("job_titles", []),
            "summary": resume.get("summary", ""),
            "parsed_at": parsed_at,
        }
        if active_resume:
            response["s3_key"] = active_resume.get("s3_key", "")
            response["filename"] = active_resume.get("filename", "")
        return jsonify(response), 200
    except Exception as e:
        logger.error(f"Resume status error: {e}")
        return jsonify({"error": "Failed to check resume status"}), 500


# ------------------------------------------------------------------
# GET /api/resume/versions — List base resume versions
# ------------------------------------------------------------------

@resume_bp.route('/versions', methods=['GET'])
@jwt_required()
def list_versions():
    user_email = get_jwt_identity()
    db = DBConnect().get_db()
    resumes = list(db.user_resumes.find(
        {'user_email': user_email, 'type': 'base'},
        {'_id': 0}
    ).sort('uploaded_at', -1))
    for r in resumes:
        if 'uploaded_at' in r and hasattr(r['uploaded_at'], 'isoformat'):
            r['uploaded_at'] = r['uploaded_at'].isoformat()
    return jsonify({'versions': resumes}), 200


# ------------------------------------------------------------------
# GET /api/resume/generated — List generated/tailored resumes
# ------------------------------------------------------------------

@resume_bp.route('/generated', methods=['GET'])
@jwt_required()
def list_generated():
    user_email = get_jwt_identity()
    db = DBConnect().get_db()
    resumes = list(db.user_resumes.find(
        {'user_email': user_email, 'type': 'generated'},
        {'_id': 0}
    ).sort('generated_at', -1))
    for r in resumes:
        if 'generated_at' in r and hasattr(r['generated_at'], 'isoformat'):
            r['generated_at'] = r['generated_at'].isoformat()
    return jsonify({'generated': resumes}), 200


# ------------------------------------------------------------------
# PUT /api/resume/active — Set active base resume
# ------------------------------------------------------------------

@resume_bp.route('/active', methods=['PUT'])
@jwt_required()
def set_active():
    user_email = get_jwt_identity()
    data = request.get_json()
    s3_key = data.get('s3_key', '')
    db = DBConnect().get_db()
    # Deactivate all, then activate the chosen one
    db.user_resumes.update_many(
        {'user_email': user_email, 'type': 'base'},
        {'$set': {'is_active': False}}
    )
    result = db.user_resumes.update_one(
        {'user_email': user_email, 's3_key': s3_key},
        {'$set': {'is_active': True}}
    )
    if result.modified_count:
        return jsonify({'message': 'Active resume updated'}), 200
    return jsonify({'error': 'Resume not found'}), 404


# ------------------------------------------------------------------
# GET /api/resume/download-file/<s3_key> — Download resume from S3
# ------------------------------------------------------------------

@resume_bp.route('/download-file/<path:s3_key>', methods=['GET'])
@jwt_required()
def download_file(s3_key):
    user_email = get_jwt_identity()
    db = DBConnect().get_db()
    # Verify this resume belongs to the user
    resume = db.user_resumes.find_one({'user_email': user_email, 's3_key': s3_key})
    if not resume:
        return jsonify({'error': 'Resume not found'}), 404
    storage = get_storage_service()
    file_bytes = storage.get_resume(s3_key)
    # Determine content type
    content_type = 'application/pdf' if s3_key.endswith('.pdf') else 'application/octet-stream'
    filename = resume.get('filename', 'resume.pdf')
    return send_file(
        io.BytesIO(file_bytes), mimetype=content_type,
        as_attachment=True, download_name=filename
    )


# ------------------------------------------------------------------
# DELETE /api/resume/file/<s3_key> — Delete a resume
# ------------------------------------------------------------------

@resume_bp.route('/file/<path:s3_key>', methods=['DELETE'])
@jwt_required()
def delete_file(s3_key):
    user_email = get_jwt_identity()
    db = DBConnect().get_db()
    resume = db.user_resumes.find_one({'user_email': user_email, 's3_key': s3_key})
    if not resume:
        return jsonify({'error': 'Resume not found'}), 404
    storage = get_storage_service()
    storage.delete_resume(s3_key)
    db.user_resumes.delete_one({'user_email': user_email, 's3_key': s3_key})
    return jsonify({'message': 'Resume deleted'}), 200
