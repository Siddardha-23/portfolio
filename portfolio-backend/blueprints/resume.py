"""
Resume blueprint — Resume tailoring, ATS scoring, and document generation endpoints.

Reuses the same JWT from /api/jobs/auth (job_search_token).

All endpoints run synchronously — no async Lambda self-invocation or polling.
The pipeline is split into two calls so each fits within API Gateway's 29s timeout:
  1. POST /tailor  → extract JD + tailor resume (~15-25s)
  2. POST /ats-scores → compute ATS scores (~10-15s)
"""
import io
import logging

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required

from utils.security import InputSanitizer, get_rate_limiter, get_client_ip

resume_bp = Blueprint("resume", __name__)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# POST /api/resume/tailor — Extract JD + tailor resume (synchronous)
# ------------------------------------------------------------------

@resume_bp.route("/tailor", methods=["POST"])
@jwt_required()
def tailor():
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
        from services.resume_service import get_resume_service
        svc = get_resume_service()

        resume = svc.get_base_resume()
        if not resume or not resume.get("raw_text"):
            return jsonify({"error": "No resume uploaded. Please upload your resume first."}), 404

        jd_analysis = svc.extract_jd(jd_text)
        tailored = svc.tailor_resume(resume["raw_text"], jd_analysis)

        return jsonify({
            "jd_analysis": jd_analysis,
            "tailored_resume": tailored,
        }), 200

    except Exception as e:
        logger.error(f"Resume tailor error: {e}")
        return jsonify({"error": "Failed to tailor resume. Please try again."}), 500


# ------------------------------------------------------------------
# POST /api/resume/ats-scores — Compute ATS scores (synchronous)
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
        from services.resume_service import get_resume_service
        scores = get_resume_service().compute_ats_scores(tailored, jd_analysis)
        return jsonify({"ats_scores": scores}), 200

    except Exception as e:
        logger.error(f"ATS scoring error: {e}")
        return jsonify({"error": "Failed to compute ATS scores. Please try again."}), 500


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
            file_bytes = svc.generate_pdf(tailored)
            mimetype = "application/pdf"
        else:
            file_bytes = svc.generate_docx(tailored)
            mimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        filename = svc.build_filename(tailored, jd_analysis, fmt)

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
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            text += (page.extract_text() or "") + "\n"
        text = text.strip()
        if not text:
            return jsonify({"error": "Could not extract text from PDF"}), 400
    except Exception as e:
        logger.error(f"PDF parsing error: {e}")
        return jsonify({"error": "Failed to read PDF"}), 400

    try:
        from services.job_service import get_job_service
        parsed = get_job_service().parse_resume(text)
        return jsonify({"resume": parsed}), 200
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
        return jsonify({
            "has_resume": True,
            "skills": resume.get("skills", []),
            "experience_years": resume.get("experience_years"),
            "job_titles": resume.get("job_titles", []),
            "summary": resume.get("summary", ""),
            "parsed_at": resume.get("parsed_at", ""),
        }), 200
    except Exception as e:
        logger.error(f"Resume status error: {e}")
        return jsonify({"error": "Failed to check resume status"}), 500
