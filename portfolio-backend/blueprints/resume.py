"""
Resume blueprint — Resume tailoring, ATS scoring, and document generation endpoints.

Reuses the same JWT from /api/jobs/auth (job_search_token).
"""
import io
import json
import logging
import os
import uuid

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required

from utils.security import InputSanitizer, get_rate_limiter, get_client_ip

resume_bp = Blueprint("resume", __name__)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# POST /api/resume/tailor — Start async pipeline (returns task_id)
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

        # Verify resume exists before queueing the task
        resume = svc.get_base_resume()
        if not resume or not resume.get("raw_text"):
            return jsonify({"error": "No resume uploaded. Please upload your resume first."}), 404

        task_id = str(uuid.uuid4())
        svc.create_task(task_id)

        # Invoke Lambda asynchronously (Event invocation = fire-and-forget)
        # AWS_LAMBDA_FUNCTION_NAME is auto-set by the Lambda runtime.
        function_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        if function_name:
            import boto3
            boto3.client("lambda", region_name=os.environ.get("AWS_REGION_NAME", "us-east-1")).invoke(
                FunctionName=function_name,
                InvocationType="Event",
                Payload=json.dumps({
                    "_async_task": "resume_tailor",
                    "task_id": task_id,
                    "jd_text": jd_text,
                }),
            )
        else:
            # Local dev fallback: run synchronously
            try:
                result = svc.full_tailor_pipeline(jd_text, task_id=task_id)
                svc.update_task(task_id, status="completed", result=result)
            except Exception as e:
                logger.error(f"Resume tailor pipeline error: {e}")
                svc.update_task(task_id, status="failed", error=str(e))

        return jsonify({"task_id": task_id}), 202

    except Exception as e:
        logger.error(f"Resume tailor start error: {e}")
        return jsonify({"error": "Failed to start tailoring. Please try again."}), 500


# ------------------------------------------------------------------
# GET /api/resume/tailor/<task_id> — Poll task status
# ------------------------------------------------------------------

@resume_bp.route("/tailor/<task_id>", methods=["GET"])
@jwt_required()
def tailor_status(task_id):
    if not task_id or len(task_id) > 50:
        return jsonify({"error": "Invalid task ID"}), 400

    from services.resume_service import get_resume_service
    task = get_resume_service().get_task(task_id)

    if not task:
        return jsonify({"error": "Task not found"}), 404

    if task["status"] == "completed":
        result = task.get("result", {})
        return jsonify({
            "status": "completed",
            "step": 3,
            **result,
        }), 200

    if task["status"] == "partial":
        result = task.get("result", {})
        return jsonify({
            "status": "partial",
            "step": 2,
            **result,
        }), 200

    if task["status"] == "failed":
        return jsonify({
            "status": "failed",
            "error": task.get("error", "Unknown error"),
        }), 200

    return jsonify({
        "status": "processing",
        "step": task.get("step", 0),
    }), 200


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
