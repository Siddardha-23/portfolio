"""
Resume Service — orchestrator for the resume processing pipeline.

Manages async jobs (create/poll/complete/fail) and delegates domain logic to:
  - ResumeParser:   PDF extraction + structured parsing
  - ResumeTailor:   resume optimization against JD
  - ResumeScorer:   hybrid ATS scoring
  - ResumeRenderer: PDF/DOCX generation

JD extraction stays here (it's a short, self-contained Gemini call).
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from utils.db_connect import DBConnect

logger = logging.getLogger(__name__)


class ResumeService:
    def __init__(self):
        db = DBConnect().get_db()
        self.resume_jobs = db.resume_jobs

        # Domain sub-services
        from services.resume_parser import ResumeParser
        from services.resume_tailor import ResumeTailor
        from services.resume_scorer import ResumeScorer
        from services.resume_renderer import ResumeRenderer
        from services.keyword_gap_engine import KeywordGapEngine
        from services.impact_engine import ImpactEngine
        from services.project_generator import ProjectGenerator

        self.parser = ResumeParser(db)
        self.tailor = ResumeTailor()
        self.scorer = ResumeScorer()
        self.renderer = ResumeRenderer()
        self.keyword_gap = KeywordGapEngine()
        self.impact = ImpactEngine()
        self.project_generator = ProjectGenerator()

    # ------------------------------------------------------------------
    # Job management (async pattern for Lambda)
    # ------------------------------------------------------------------

    def create_job(self, job_type: str, payload: dict) -> str:
        """Create a pending job and return its ID."""
        job_id = str(uuid.uuid4())
        self.resume_jobs.insert_one({
            "job_id": job_id,
            "job_type": job_type,
            "status": "processing",
            "payload": payload,
            "result": None,
            "error": None,
            "created_at": datetime.now(timezone.utc),
            "completed_at": None,
        })
        return job_id

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status and result."""
        job = self.resume_jobs.find_one({"job_id": job_id})
        if not job:
            return None
        job.pop("_id", None)
        job.pop("payload", None)  # Don't send payload back to client
        return job

    def complete_job(self, job_id: str, result: dict):
        """Mark a job as completed with its result."""
        self.resume_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "completed",
                "result": result,
                "completed_at": datetime.now(timezone.utc),
            }},
        )

    def fail_job(self, job_id: str, error: str):
        """Mark a job as failed."""
        self.resume_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "failed",
                "error": error,
                "completed_at": datetime.now(timezone.utc),
            }},
        )

    @staticmethod
    def invoke_async(job_id: str, job_type: str, payload: dict):
        """Invoke Lambda asynchronously to process a job.
        Falls back to background thread when not running on Lambda (local dev / Gunicorn)."""
        func_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        if not func_name:
            import threading
            t = threading.Thread(
                target=_process_job,
                args=(job_id, job_type, payload),
                daemon=True,
            )
            t.start()
            logger.info(f"Async job {job_id} ({job_type}) dispatched to background thread")
            return

        import boto3
        client = boto3.client("lambda", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        client.invoke(
            FunctionName=func_name,
            InvocationType="Event",  # async — returns immediately
            Payload=json.dumps({
                "async_job": True,
                "job_id": job_id,
                "job_type": job_type,
                "payload": payload,
            }),
        )
        logger.info(f"Async job {job_id} ({job_type}) dispatched to Lambda")

    # ------------------------------------------------------------------
    # Resume retrieval (delegates to parser)
    # ------------------------------------------------------------------

    def get_base_resume(self) -> Optional[Dict[str, Any]]:
        """Retrieve the latest stored resume."""
        return self.parser.get_structured_resume()

    # ------------------------------------------------------------------
    # Step 1 — Extract JD fields (stays here — short, self-contained)
    # ------------------------------------------------------------------

    def extract_jd(self, jd_text: str) -> Dict[str, Any]:
        """Parse a job description into structured fields using Gemini."""
        from services.gemini_client import gemini_json
        from schemas.resume_schemas import JD_ANALYSIS_SCHEMA, validate_and_coerce

        prompt = (
            "You are an expert recruiter and ATS specialist.\n"
            "Extract structured information from the following job description.\n"
            "Return a JSON object with EXACTLY these keys:\n"
            '- "job_title": string (the specific role title)\n'
            '- "company": string (company name, or "Not specified")\n'
            '- "location": string (location or "Not specified")\n'
            '- "employment_type": string (Full-time/Part-time/Contract/Intern)\n'
            '- "required_skills": list of strings (must-have technical skills)\n'
            '- "preferred_skills": list of strings (nice-to-have skills)\n'
            '- "responsibilities": list of strings (key job duties, max 8)\n'
            '- "qualifications": list of strings (degree, years of experience, etc.)\n'
            '- "experience_years": string (e.g. "3-5 years" or "Entry level")\n'
            '- "industry": string (e.g. "Cloud Computing", "FinTech")\n'
            '- "keywords": list of strings (ATS-critical keywords from the JD)\n\n'
            f"=== JOB DESCRIPTION ===\n{jd_text[:5000]}"
        )

        result = gemini_json(prompt, max_tokens=4096)
        validated = validate_and_coerce(result, JD_ANALYSIS_SCHEMA)

        # Normalize extracted keywords to canonical forms
        from utils.keyword_normalizer import normalize_keywords
        validated["required_skills"] = normalize_keywords(validated.get("required_skills", []))
        validated["preferred_skills"] = normalize_keywords(validated.get("preferred_skills", []))
        validated["keywords"] = normalize_keywords(validated.get("keywords", []))

        return validated


# ---------------------------------------------------------------------------
# Async job processor (called by Lambda async invocation or background thread)
# ---------------------------------------------------------------------------

def _process_job(job_id: str, job_type: str, payload: dict):
    """Execute the appropriate pipeline step and store the result in MongoDB."""
    svc = get_resume_service()
    try:
        if job_type == "extract_jd":
            result = svc.extract_jd(payload["job_description"])
            svc.complete_job(job_id, {"jd_analysis": result})

        elif job_type == "tailor":
            resume = svc.parser.get_structured_resume()
            if not resume:
                svc.fail_job(job_id, "No resume uploaded.")
                return

            # Use structured JSON if available, fall back to raw_text for backward compat
            structured = resume.get("structured")
            if structured:
                result = svc.tailor.tailor(structured, payload["jd_analysis"])
            else:
                # Legacy resume without structured field — use raw_text
                raw_text = resume.get("raw_text", "")
                if not raw_text:
                    svc.fail_job(job_id, "No resume data available. Please re-upload.")
                    return
                # Parse raw_text to structured first, then tailor
                structured = svc.parser.parse_to_structured(raw_text)
                result = svc.tailor.tailor(structured, payload["jd_analysis"])

            # If original resume had no projects, generate one grounded project
            if not structured.get("projects"):
                generated = svc.project_generator.generate(structured, payload["jd_analysis"])
                if generated:
                    result["projects"] = [generated]
                    logger.info("ProjectGenerator: injected 1 generated project into tailored resume")

            svc.complete_job(job_id, {"tailored_resume": result})

        elif job_type == "ats_scores":
            result = svc.scorer.score(
                payload["tailored_resume"], payload["jd_analysis"]
            )
            svc.complete_job(job_id, {"ats_scores": result})

        else:
            svc.fail_job(job_id, f"Unknown job type: {job_type}")

        logger.info(f"Job {job_id} ({job_type}) completed successfully")

    except Exception as e:
        logger.error(f"Job {job_id} ({job_type}) failed: {e}")
        svc.fail_job(job_id, str(e))


def process_async_job(event: dict):
    """Entry point called by lambda_handler for async job events."""
    job_id = event["job_id"]
    job_type = event["job_type"]
    payload = event["payload"]
    logger.info(f"Processing async job {job_id} ({job_type})")
    _process_job(job_id, job_type, payload)


# Singleton
_resume_service: Optional[ResumeService] = None


def get_resume_service() -> ResumeService:
    global _resume_service
    if _resume_service is None:
        _resume_service = ResumeService()
    return _resume_service
