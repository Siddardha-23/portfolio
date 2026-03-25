"""
Resume blueprint — Resume tailoring, ATS scoring, and document generation endpoints.

Reuses the same JWT from /api/jobs/auth (job_search_token).

Async pattern: Gemini endpoints submit a job, Lambda processes it
asynchronously, and the frontend polls GET /job/<id> for the result.
  1. POST /extract-jd   → returns { job_id }   (instant)
  2. POST /tailor       → returns { job_id }   (instant)
  3. POST /ats-scores   → returns { job_id }   (instant)
  4. GET  /job/<id>     → returns { status, result | error }
"""
import io
import logging

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required

from utils.security import InputSanitizer, get_rate_limiter, get_client_ip

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
        job_id = svc.create_job("extract_jd", {"job_description": jd_text})
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
        from services.resume_service import get_resume_service, ResumeService
        svc = get_resume_service()
        job_id = svc.create_job("tailor", {"jd_analysis": jd_analysis})
        ResumeService.invoke_async(job_id, "tailor", {"jd_analysis": jd_analysis})
        return jsonify({"job_id": job_id}), 202

    except Exception as e:
        logger.error(f"Resume tailor error: {e}")
        return jsonify({"error": "Failed to start resume tailoring. Please try again."}), 500


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
        payload = {"tailored_resume": tailored, "jd_analysis": jd_analysis}
        job_id = svc.create_job("ats_scores", payload)
        ResumeService.invoke_async(job_id, "ats_scores", payload)
        return jsonify({"job_id": job_id}), 202

    except Exception as e:
        logger.error(f"ATS scoring error: {e}")
        return jsonify({"error": "Failed to start ATS scoring. Please try again."}), 500


# ------------------------------------------------------------------
# GET /api/resume/job/<job_id> — Poll for job result
# ------------------------------------------------------------------

@resume_bp.route("/job/<job_id>", methods=["GET"])
@jwt_required()
def get_job(job_id):
    try:
        from services.resume_service import get_resume_service
        job = get_resume_service().get_job(job_id)
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

        filename = svc.renderer.build_filename(tailored, jd_analysis, fmt)

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
    client_ip = get_client_ip(request)
    limiter = get_rate_limiter()
    if limiter.is_rate_limited(f"resume_upload:{client_ip}", max_requests=5, window_seconds=3600):
        return jsonify({"error": "Rate limit exceeded. Max 5 uploads per hour."}), 429

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are accepted"}), 400

    file_bytes = file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        return jsonify({"error": "File too large (max 5 MB)"}), 400

    try:
        from services.resume_service import get_resume_service
        svc = get_resume_service()
        parsed = svc.parser.upload_and_parse(file_bytes)

        # Return flat format matching frontend ParsedResume type
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


# ------------------------------------------------------------------
# GET /api/resume/status — Check if a resume is uploaded
# ------------------------------------------------------------------

@resume_bp.route("/status", methods=["GET"])
@jwt_required()
def status():
    try:
        from services.resume_service import get_resume_service
        resume = get_resume_service().get_base_resume()
        if not resume:
            return jsonify({"has_resume": False}), 200
        parsed_at = resume.get("parsed_at", "")
        if hasattr(parsed_at, 'isoformat'):
            parsed_at = parsed_at.isoformat()
        return jsonify({
            "has_resume": True,
            "skills": resume.get("skills", []),
            "experience_years": resume.get("experience_years"),
            "job_titles": resume.get("job_titles", []),
            "summary": resume.get("summary", ""),
            "parsed_at": parsed_at,
        }), 200
    except Exception as e:
        logger.error(f"Resume status error: {e}")
        return jsonify({"error": "Failed to check resume status"}), 500
