"""
Resume Service — Top-level orchestrator for the resume processing pipeline.

This is the central hub that coordinates all resume-related operations.
It does NOT contain domain logic itself — instead, it delegates to
specialized sub-services for each concern:

  ┌────────────────────────────────────────────────────────────────────┐
  │                      ResumeService (orchestrator)                 │
  │                                                                   │
  │   Manages:                                                        │
  │     - Async job lifecycle (create → poll → complete/fail)         │
  │     - JD extraction (short, self-contained Gemini call)           │
  │     - Lambda / background-thread dispatch                         │
  │                                                                   │
  │   Delegates to:                                                   │
  │     ├─ ResumeParser:      PDF extraction + structured parsing     │
  │     ├─ ResumeTailor:      resume ↔ JD alignment                   │
  │     ├─ ResumeScorer:      hybrid ATS scoring                      │
  │     ├─ ResumeRenderer:    PDF/DOCX generation                     │
  │     ├─ KeywordGapEngine:  missing keyword analysis                │
  │     ├─ ImpactEngine:      bullet quality assessment               │
  │     └─ ProjectGenerator:  grounded project generation             │
  └────────────────────────────────────────────────────────────────────┘

Async pattern:
  1. Client POSTs to /upload → creates a job (status: "processing"), returns job_id.
  2. Backend dispatches the job to a background thread (local) or Lambda (prod).
  3. Client polls GET /job/<id> until status is "completed" or "failed".
  4. On completion, the result dict is stored in MongoDB and returned.
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
    """Central orchestrator for resume processing.

    Manages the async job lifecycle and delegates domain-specific work
    to specialized sub-services. Instantiated as a singleton via
    get_resume_service().
    """

    def __init__(self):
        """Initialize with all sub-services.

        Uses lazy imports to avoid circular dependencies between service modules.
        Each sub-service is responsible for one domain concern.
        """
        db = DBConnect().get_db()
        self.resume_jobs = db.resume_jobs

        # Domain sub-services (lazy-imported to avoid circular deps)
        from services.resume_parser import ResumeParser
        from services.resume_tailor import ResumeTailor
        from services.resume_scorer import ResumeScorer
        from services.resume_renderer import ResumeRenderer
        from services.keyword_gap_engine import KeywordGapEngine
        from services.impact_engine import ImpactEngine
        from services.project_generator import ProjectGenerator
        from services.content_augmenter import ContentAugmenter

        self.parser = ResumeParser(db)
        self.tailor = ResumeTailor()
        self.scorer = ResumeScorer()
        self.renderer = ResumeRenderer()
        self.keyword_gap = KeywordGapEngine()
        self.impact = ImpactEngine()
        self.project_generator = ProjectGenerator()
        self.augmenter = ContentAugmenter(self.renderer, self.project_generator)

    # ------------------------------------------------------------------
    # Job management (async pattern for Lambda)
    # ------------------------------------------------------------------

    def create_job(self, job_type: str, payload: dict) -> str:
        """Create a pending async job and return its unique ID.

        The job is stored in MongoDB with status='processing'.
        The caller should then dispatch it via invoke_async().

        Args:
            job_type: One of 'upload_parse', 'extract_jd', 'tailor', 'ats_scores'.
            payload: Job-type-specific data (e.g., raw_text, jd_analysis).

        Returns:
            UUID string identifying the job.
        """
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
        """Retrieve a job's current status and result for client polling.

        The payload field is stripped from the response to avoid sending
        large data (e.g., base64 PDFs) back to the client.

        Args:
            job_id: UUID of the job to check.

        Returns:
            Job dict with status/result/error, or None if not found.
        """
        job = self.resume_jobs.find_one({"job_id": job_id})
        if not job:
            return None
        job.pop("_id", None)
        job.pop("payload", None)  # Don't send payload back to client
        return job

    def complete_job(self, job_id: str, result: dict):
        """Mark a job as completed with its result dict."""
        self.resume_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "completed",
                "result": result,
                "completed_at": datetime.now(timezone.utc),
            }},
        )

    def fail_job(self, job_id: str, error: str):
        """Mark a job as failed with an error message."""
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
        """Dispatch a job for background processing.

        In production (AWS Lambda): uses boto3 to invoke the same Lambda
        function asynchronously via InvocationType='Event'.

        In local dev: spawns a daemon thread to process the job immediately.

        Args:
            job_id: UUID of the job to process.
            job_type: The pipeline step to execute.
            payload: Job-specific data.
        """
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

    def get_base_resume(self, user_email: str = "") -> Optional[Dict[str, Any]]:
        """Retrieve the latest stored resume for the given user."""
        return self.parser.get_structured_resume(user_email=user_email)

    # ------------------------------------------------------------------
    # Step 1 — Extract JD fields (stays here — short, self-contained)
    # ------------------------------------------------------------------

    def extract_jd(self, jd_text: str) -> Dict[str, Any]:
        """Parse a job description into structured fields using Gemini Pro.

        Extracts: job title, company, location, required/preferred skills,
        responsibilities, qualifications, experience requirements, industry,
        and ATS-critical keywords.

        All skill and keyword lists are normalized to canonical forms.

        Args:
            jd_text: Raw job description text (max 5000 chars sent to AI).

        Returns:
            Validated dict conforming to JD_ANALYSIS_SCHEMA.
        """
        from services.gemini_client import gemini_json, GEMINI_PRO
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

        result = gemini_json(prompt, max_tokens=4096, model=GEMINI_PRO, schema=JD_ANALYSIS_SCHEMA)
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

        elif job_type == "upload_parse":
            user_email = payload.get("user_email", "")
            # Async resume extraction: raw_text was pre-extracted synchronously
            raw_text = payload["raw_text"]
            pdf_base64 = payload.get("pdf_base64")

            # parse_to_structured validates internally via validate_and_coerce.
            # If Gemini returns fundamentally broken output, attempt one repair.
            try:
                validated = svc.parser.parse_to_structured(raw_text, pdf_base64)
            except (ValueError, KeyError) as ve:
                logger.warning("Upload parse validation failed, attempting repair: %s", ve)
                # Try to get raw Gemini output for repair (re-parse without validation)
                validated = _repair_extraction(raw_text, {}, str(ve))
                if validated is None:
                    svc.fail_job(job_id, f"Resume parsing failed validation: {ve}")
                    return

            # Store in DB
            doc = svc.parser.save_parsed_resume(validated, raw_text, user_email=user_email)
            svc.complete_job(job_id, {"parsed_resume": doc})

        elif job_type == "tailor":
            user_email = payload.get("user_email", "")
            resume = svc.parser.get_structured_resume(user_email=user_email)
            if not resume:
                svc.fail_job(job_id, "No resume uploaded.")
                return

            # Use structured JSON if available, fall back to raw_text for backward compat
            structured = resume.get("structured")
            if structured:
                # Safety net: backfill any empty critical fields from raw_text
                # before sending to the tailor. This handles resumes parsed
                # before the backfill fix was deployed, or when Gemini
                # partially extracts contact/education.
                raw_text = resume.get("raw_text", "")
                if raw_text:
                    from services.resume_parser import ResumeParser

                    # Backfill individual empty contact fields (phone, name, etc.)
                    contact = structured.get("contact", {})
                    contact_fields = ("name", "email", "phone", "linkedin", "github")
                    missing_contact = [f for f in contact_fields if not contact.get(f, "").strip()]
                    if missing_contact:
                        structured = ResumeParser._backfill_contact(structured, raw_text)
                        logger.info("Tailor: backfilled missing contact fields: %s", missing_contact)

                    # Backfill empty education institution names
                    edu_missing = any(
                        not edu.get("institution", "").strip()
                        for edu in structured.get("education", [])
                    )
                    if edu_missing:
                        structured = ResumeParser._backfill_education(structured, raw_text)
                        logger.info("Tailor: backfilled missing education institutions")

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

            # Normalize contact whitespace (safety net for resumes parsed before the fix)
            result_contact = result.get("contact", {})
            if result_contact.get("name"):
                result_contact["name"] = " ".join(result_contact["name"].split())
            if result_contact.get("phone"):
                result_contact["phone"] = " ".join(result_contact["phone"].split())


            # Content augmentation: page-fill, impact injection, ATS hardening
            result = svc.augmenter.augment(result, structured, payload["jd_analysis"])

            # Date normalization: consistent "Month YYYY – Present" format
            from services.date_normalizer import normalize_dates
            result = normalize_dates(result)

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


def _repair_extraction(raw_text: str, invalid_output: dict, error_msg: str):
    """Attempt one bounded repair of invalid extraction output using Preview model.

    Returns the repaired and validated dict, or None if repair fails.
    """
    import json
    from services.gemini_client import gemini_json, GEMINI_PREVIEW
    from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce

    repair_prompt = (
        "You are a JSON repair assistant. The following resume extraction output "
        "failed schema validation.\n\n"
        f"VALIDATION ERROR:\n{error_msg}\n\n"
        f"INVALID OUTPUT:\n{json.dumps(invalid_output, indent=2)[:6000]}\n\n"
        f"ORIGINAL RESUME TEXT:\n{raw_text[:4000]}\n\n"
        "Fix ONLY the validation errors. Do not change any factual content. "
        "Do not invent or infer any information. Return the corrected JSON object "
        "with the same schema as the original output."
    )

    try:
        result = gemini_json(
        repair_prompt,
        max_tokens=8192,
        temperature=0.2,
        model=GEMINI_PREVIEW
    )
        validated = validate_and_coerce(result, PARSED_RESUME_SCHEMA)
        logger.info("Repair extraction succeeded via Preview model")
        return validated
    except Exception as e:
        logger.error("Repair extraction also failed: %s", e)
        return None


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
