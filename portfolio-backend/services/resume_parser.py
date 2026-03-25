"""
Resume Parser — PDF text extraction + Gemini structured parsing.

Pipeline: PDF bytes → raw text (PyPDF2) → structured JSON (Gemini) → validated → stored in MongoDB.
The structured output matches PARSED_RESUME_SCHEMA so downstream steps (tailor, score) consume JSON, not raw text.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from schemas.resume_schemas import (
    PARSED_RESUME_SCHEMA,
    validate_and_coerce,
    flatten_skills,
    extract_job_titles,
)

logger = logging.getLogger(__name__)


class ResumeParser:
    def __init__(self, db):
        self.user_resumes = db.user_resumes

    # ------------------------------------------------------------------
    # PDF text extraction
    # ------------------------------------------------------------------

    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> str:
        """Extract text from PDF bytes using PyPDF2.

        Raises ValueError if no text can be extracted.
        """
        from PyPDF2 import PdfReader
        import io

        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text() or ""
            text += page_text + "\n"
            
            # Extract clickable URLs from annotations (so AI can see hidden links)
            if "/Annots" in page:
                for annot_ref in page["/Annots"]:
                    try:
                        annot = annot_ref.get_object()
                        if annot.get("/Subtype") == "/Link":
                            action = annot.get("/A")
                            if action and action.get("/S") == "/URI":
                                uri = action.get("/URI")
                                if uri:
                                    text += f"[Extracted Link: {uri}]\n"
                    except Exception:
                        pass
                        
        text = text.strip()
        if not text:
            raise ValueError("Could not extract text from PDF")
        return text

    # ------------------------------------------------------------------
    # Gemini structured parsing
    # ------------------------------------------------------------------

    def parse_to_structured(self, raw_text: str) -> dict:
        """Parse raw resume text into a fully structured JSON using Gemini.

        Output conforms to PARSED_RESUME_SCHEMA (same shape as TailoredFullResume
        minus certifications) so the tailor can consume it directly.
        """
        from services.gemini_client import gemini_json

        prompt = (
            "You are a strict resume parser. Your ONLY job is to extract information that is "
            "explicitly present in the resume text. NEVER infer, synthesize, or invent anything.\n\n"
            "Return a JSON object with EXACTLY this structure:\n"
            "{\n"
            '  "contact": {\n'
            '    "name": "Full Name",\n'
            '    "email": "email address",\n'
            '    "phone": "phone number",\n'
            '    "linkedin": "linkedin url or profile path",\n'
            '    "github": "github url or username"\n'
            "  },\n"
            '  "summary": "Copy the exact summary/objective text verbatim if present, else empty string",\n'
            '  "skills": {\n'
            '    "Category Name": ["Skill1", "Skill2", ...],\n'
            '    "Another Category": ["Skill3", "Skill4", ...]\n'
            "  },\n"
            '  "experience": [\n'
            "    {\n"
            '      "title": "Job Title",\n'
            '      "company": "Company Name",\n'
            '      "location": "City, State/Country",\n'
            '      "dates": "Start - End",\n'
            '      "type": "Full-time/Internship/Contract",\n'
            '      "bullets": ["Responsibility/achievement 1", "Responsibility/achievement 2"]\n'
            "    }\n"
            "  ],\n"
            '  "education": [\n'
            "    {\n"
            '      "degree": "Degree Name",\n'
            '      "institution": "University Name",\n'
            '      "location": "City, State",\n'
            '      "dates": "Start - End",\n'
            '      "gpa": "GPA if stated, else empty string",\n'
            '      "coursework": "Relevant coursework if listed, else empty string"\n'
            "    }\n"
            "  ],\n"
            '  "projects": [\n'
            "    {\n"
            '      "name": "Project Name",\n'
            '      "dates": "Date Range if stated, else empty string",\n'
            '      "bullets": ["Description 1", "Description 2"],\n'
            '      "tech": "Tech1, Tech2, Tech3"\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "STRICT EXTRACTION RULES:\n"
            "1. Extract ONLY information that is explicitly present in the resume text. NEVER fabricate, infer, or invent.\n"
            "2. Summary: If no summary or objective section exists, return empty string. DO NOT write one.\n"
            "3. Location: If a location is not stated for a job or education entry, use empty string. DO NOT guess.\n"
            "4. Employment type: If not explicitly stated (Full-time, Internship, Contract), use empty string.\n"
            "5. Bullet points: Copy the original bullet text. Do NOT rewrite, improve, or condense bullets.\n"
            "6. If a section is not present in the resume, use an empty string or empty array.\n"
            "7. For contact info, extract what's available. Use empty string for missing fields.\n"
            "8. Every field must be a non-null string or array — never null.\n"
            "9. Extract skills from ALL sections — not just the Skills heading. "
            "If a bullet says 'Built microservices using Go and gRPC', extract 'Go', 'gRPC', "
            "and 'microservices' as skills under appropriate categories.\n"
            "10. Include technologies mentioned in deployment/infrastructure context "
            "(e.g., 'Deployed on AWS ECS' means 'AWS' and 'ECS' are Cloud & DevOps skills).\n\n"
            f"=== RESUME TEXT ===\n{raw_text[:8000]}"
        )

        result = gemini_json(prompt, max_tokens=8192, temperature=0.2)
        validated = validate_and_coerce(result, PARSED_RESUME_SCHEMA)

        # Post-parse normalization: canonical forms for all skills
        from utils.keyword_normalizer import normalize_keywords
        skills = validated.get("skills", {})
        if isinstance(skills, dict):
            for cat in list(skills.keys()):
                if isinstance(skills[cat], list):
                    skills[cat] = normalize_keywords(skills[cat])
            validated["skills"] = skills

        return validated

    # ------------------------------------------------------------------
    # Full upload pipeline
    # ------------------------------------------------------------------

    def upload_and_parse(self, file_bytes: bytes) -> dict:
        """Full pipeline: extract text → parse → validate → store → return.

        Returns the stored document (includes structured, raw_text, and flat fields).
        """
        raw_text = self.extract_text_from_pdf(file_bytes)
        structured = self.parse_to_structured(raw_text)

        # Build flat fields for backward compatibility with /status endpoint
        flat_skills = flatten_skills(structured)
        job_titles = extract_job_titles(structured)
        experience_years = self._estimate_experience_years(structured)
        summary = structured.get("summary", "")

        doc = {
            "structured": structured,
            "raw_text": raw_text[:8000],
            "raw_text_length": len(raw_text),
            "skills": flat_skills,
            "experience_years": experience_years,
            "job_titles": job_titles,
            "summary": summary,
            "education": [
                {
                    "degree": edu.get("degree", ""),
                    "institution": edu.get("institution", ""),
                    "year": edu.get("dates", "").split("–")[-1].strip() if edu.get("dates") else "",
                }
                for edu in structured.get("education", [])
            ],
            "certifications": [],
            "parsed_at": datetime.now(timezone.utc),
        }

        # Single-user: replace existing resume
        self.user_resumes.delete_many({})
        self.user_resumes.insert_one(doc)

        doc.pop("_id", None)
        return doc

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def get_structured_resume(self) -> Optional[Dict[str, Any]]:
        """Retrieve the latest stored structured resume."""
        resume = self.user_resumes.find_one({}, sort=[("parsed_at", -1)])
        if resume:
            resume.pop("_id", None)
        return resume

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _estimate_experience_years(structured: dict) -> int:
        """Estimate total years of experience from experience date ranges."""
        import re
        total_months = 0
        current_year = datetime.now().year

        for exp in structured.get("experience", []):
            dates = exp.get("dates", "")
            if not dates:
                continue

            # Try to extract years from date strings like "Jan 2020 – Present"
            years = re.findall(r"(20\d{2}|19\d{2})", dates)
            if len(years) >= 2:
                try:
                    start_year = int(years[0])
                    end_year = int(years[-1])
                    total_months += (end_year - start_year) * 12
                except ValueError:
                    continue
            elif len(years) == 1:
                # Single year with "Present" or similar
                if "present" in dates.lower() or "current" in dates.lower():
                    try:
                        start_year = int(years[0])
                        total_months += (current_year - start_year) * 12
                    except ValueError:
                        continue

        return max(1, total_months // 12) if total_months > 0 else 0
