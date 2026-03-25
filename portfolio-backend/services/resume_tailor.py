"""
Resume Tailor — transforms a structured resume JSON to align with a job description.

Input:  structured resume JSON (from ResumeParser) + JD analysis JSON
Output: tailored resume JSON conforming to TAILORED_RESUME_SCHEMA

Enhancements over base tailoring:
  - Keyword gap analysis injected into prompt (missing keywords explicitly listed)
  - Bullet structure enforced: Action + Tech + Impact
  - Role alignment: detects title mismatch and instructs summary bridging
  - Weak verb prohibition
  - Required skill frequency rule (each must appear ≥2 times)
  - Post-tailor integrity guard: immutable field enforcement, hallucination detection,
    project generation rules, correction retry loop

Never fabricates experience. Only rewords, reorders, and emphasizes existing content.
"""
import json
import logging
from typing import Any, Dict

from schemas.resume_schemas import (
    TAILORED_RESUME_SCHEMA,
    validate_and_coerce,
    extract_job_titles,
)
from services.integrity_guard import IntegrityGuard

logger = logging.getLogger(__name__)


class ResumeTailor:
    _guard = IntegrityGuard()

    def tailor(self, structured_resume: Dict[str, Any], jd_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Tailor a structured resume against a JD analysis.

        Takes structured JSON input (not raw text) to eliminate re-parsing
        and reduce hallucination risk. Runs keyword gap analysis first to
        provide the AI with explicit missing keyword context.

        Post-AI integrity pipeline:
          1. validate_and_coerce (schema types)
          2. IntegrityGuard.enforce (immutable fields, hallucination, project rules)
          3. If hallucinated experience detected: one correction retry
        """
        from services.gemini_client import gemini_json
        from services.keyword_gap_engine import KeywordGapEngine

        jd_json = json.dumps(jd_analysis, indent=2)
        resume_json = json.dumps(structured_resume, indent=2)

        # --- Keyword gap analysis (deterministic, pre-AI) ---
        gap = KeywordGapEngine().analyze(structured_resume, jd_analysis)
        gap_context = self._build_gap_context(gap)

        # --- Role alignment context ---
        role_context = self._build_role_context(structured_resume, jd_analysis)

        # Build a keyword checklist string the AI must embed
        required = jd_analysis.get("required_skills", [])
        keywords = jd_analysis.get("keywords", [])
        keyword_list = ", ".join(dict.fromkeys(required + keywords))  # deduped, ordered

        # Smart truncation preserves all sections
        resume_payload = self._smart_truncate(resume_json)

        prompt = self._build_tailor_prompt(
            keyword_list, gap_context, role_context, resume_payload, jd_json
        )

        result = gemini_json(prompt, max_tokens=8192, temperature=0.4)
        validated = validate_and_coerce(result, TAILORED_RESUME_SCHEMA)

        # --- Integrity enforcement ---
        corrected, report = self._guard.enforce(structured_resume, validated)

        if report.severity == "clean":
            logger.info("Integrity check: clean — no violations detected")
            return corrected

        if report.severity == "auto_fixed":
            logger.warning(
                "Integrity check: auto-fixed — %d immutable overwrites, "
                "%d hallucinated projects removed, %d missing experience re-injected",
                len(report.immutable_overwrites),
                len(report.hallucinated_projects),
                len(report.missing_experience_reinjected),
            )
            return corrected

        # severity == "needs_retry": hallucinated experience detected
        logger.warning(
            "Integrity check: needs retry — %d hallucinated experience entries: %s",
            len(report.hallucinated_experience),
            [e.get("company", "?") for e in report.hallucinated_experience],
        )
        correction_prompt = self._build_correction_prompt(
            structured_resume, jd_analysis, corrected, report
        )
        retry_result = gemini_json(correction_prompt, max_tokens=8192, temperature=0.3)
        retry_validated = validate_and_coerce(retry_result, TAILORED_RESUME_SCHEMA)

        final, retry_report = self._guard.enforce(structured_resume, retry_validated)

        if retry_report.severity == "needs_retry":
            logger.error(
                "Integrity check: retry still has %d hallucinations — "
                "using auto-corrected version",
                len(retry_report.hallucinated_experience),
            )

        return final

    # ------------------------------------------------------------------
    # Prompt builders
    # ------------------------------------------------------------------

    @staticmethod
    def _build_tailor_prompt(
        keyword_list: str,
        gap_context: str,
        role_context: str,
        resume_payload: str,
        jd_json: str,
    ) -> str:
        """Build the main tailoring prompt."""
        return (
            "You are a top-tier professional resume writer and ATS optimization expert.\n"
            "Given the candidate's ACTUAL resume (as structured JSON) and a structured job description analysis,\n"
            "produce a COMPLETE tailored resume as a JSON object.\n\n"
            "YOUR #1 GOAL: Maximize ATS keyword match AND AI screener relevance score.\n"
            "The resume MUST contain these JD keywords/skills where the candidate has ANY related "
            f"experience: {keyword_list}\n\n"
            f"{gap_context}"
            f"{role_context}"
            "IMMUTABLE FIELDS — copy these EXACTLY from the original JSON, character for character:\n"
            "- contact.name, contact.email, contact.phone, contact.linkedin, contact.github\n"
            "- Each experience entry's: company, title, location, dates\n"
            "- Each education entry's: institution, degree, location, dates, gpa\n"
            "Do NOT alter any of these fields, even to fix typos or formatting.\n\n"
            "ATS OPTIMIZATION RULES:\n"
            "1. Mirror the EXACT terminology from the JD (e.g. if JD says 'microservices', use 'microservices' not 'micro-services').\n"
            "2. Put the most JD-relevant skills FIRST in each category.\n"
            "3. Front-load each bullet with a strong action verb that matches the JD's language.\n"
            "4. Weave required keywords naturally into experience bullets and summary — don't just list them.\n"
            "5. The professional summary MUST mention the target role title and 3-4 top required skills.\n"
            "6. Reorder experience bullets so the most JD-relevant achievements appear first.\n"
            "7. For projects, emphasize aspects that directly relate to the JD requirements.\n"
            "8. Each experience bullet MUST follow the structure: [Strong Action Verb] + [Technology/Method Used] + "
            "[Quantifiable Impact/Outcome]. Example: 'Architected a microservices platform using Go and gRPC, "
            "reducing API latency by 40% and handling 10K+ RPS.'\n"
            "9. Each required_skill from the JD must appear at least TWICE in the resume — once in the skills "
            "section and at least once naturally woven into an experience or project bullet.\n"
            "10. NEVER use weak action verbs: 'Helped', 'Assisted', 'Worked on', 'Was responsible for', "
            "'Participated in', 'Involved in', 'Contributed to', 'Supported'. Always use strong verbs like "
            "'Engineered', 'Architected', 'Deployed', 'Optimized', 'Spearheaded', 'Implemented', 'Developed'.\n\n"
            "INTEGRITY RULES:\n"
            "1. NEVER fabricate, invent, or add experience entries, companies, or job titles NOT in the original.\n"
            "2. Output MUST contain exactly the same number of experience entries as the input — no more, no less.\n"
            "3. NEVER invent metrics, percentages, or numbers not present in the original bullets.\n"
            "4. NEVER add major skills the candidate does not possess.\n"
            "5. You MAY add small, closely related skills (e.g., if they know Docker, you can add 'containerization').\n"
            "6. Projects: Include ONLY the projects present in the original resume. If the original has no projects, return an empty array [].\n"
            "7. certifications: always return an empty array [].\n"
            "8. Every field in the JSON MUST be a non-null string or array — never null.\n\n"
            "CONTENT & FORMAT RULES (the resume MUST physically fill ONE full A4 page with substantive text):\n"
            "1. Summary: 3-4 robust sentences packed with keywords, filling 3-4 lines.\n"
            "2. Experience: You MUST generate enough bullets across all roles to total ~15-20 bullets combined. "
            "Allocate 5-8 bullets for the most recent role, 4-6 for the prior, and 2-4 for older roles. "
            "Each bullet MUST be detailed enough to span 2 full lines (~150-220 chars).\n"
            "3. Skills: 4-6 categories with comprehensive skill lists, most JD-relevant first.\n"
            "4. Education: Institution, degree, and dates.\n"
            "5. Projects: Provide 3-4 detailed bullets per project. If there are no projects, compensate by adding more experience bullets.\n"
            "6. IMPORTANT: Do NOT rely on empty whitespace to fill the page. Generate robust, detailed content for every single bullet and summary sentence to naturally fill the available space.\n\n"
            "Return a JSON object with EXACTLY this structure:\n"
            "{\n"
            '  "contact": {\n'
            '    "name": "Full Name",\n'
            '    "email": "email",\n'
            '    "phone": "phone",\n'
            '    "linkedin": "linkedin url or profile path",\n'
            '    "github": "github url or username"\n'
            "  },\n"
            '  "summary": "2-3 sentence professional summary tailored to the role",\n'
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
            '      "type": "Full-time/Internship",\n'
            '      "bullets": ["Achievement 1...", "Achievement 2..."]\n'
            "    }\n"
            "  ],\n"
            '  "education": [\n'
            "    {\n"
            '      "degree": "Degree Name",\n'
            '      "institution": "University Name",\n'
            '      "location": "City, State",\n'
            '      "dates": "Start - End",\n'
            '      "gpa": "GPA if available",\n'
            '      "coursework": "Relevant coursework"\n'
            "    }\n"
            "  ],\n"
            '  "projects": [\n'
            "    {\n"
            '      "name": "Project Name",\n'
            '      "dates": "Date Range",\n'
            '      "bullets": ["Description 1...", "Description 2..."],\n'
            '      "tech": "Tech1, Tech2, Tech3"\n'
            "    }\n"
            "  ],\n"
            '  "certifications": []\n'
            "}\n\n"
            f"=== ORIGINAL RESUME (STRUCTURED JSON) ===\n{resume_payload}\n\n"
            f"=== JOB DESCRIPTION ANALYSIS ===\n{jd_json}"
        )

    @staticmethod
    def _build_correction_prompt(
        original: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        corrected: Dict[str, Any],
        report,
    ) -> str:
        """Build a targeted correction prompt listing specific violations."""
        violations = []
        for entry in report.hallucinated_experience:
            violations.append(
                f"- You INVENTED experience at '{entry.get('company', '?')}' "
                f"as '{entry.get('title', '?')}' which does NOT exist in the "
                f"original resume. REMOVE IT."
            )

        original_companies = [
            f"  {e.get('company', '?')} — {e.get('title', '?')}"
            for e in original.get("experience", [])
        ]

        corrected_json = json.dumps(corrected, indent=2)[:6000]
        jd_json = json.dumps(jd_analysis, indent=2)[:3000]

        return (
            "Your previous response contained INTEGRITY VIOLATIONS. Fix them.\n\n"
            "VIOLATIONS FOUND:\n" + "\n".join(violations) + "\n\n"
            "The candidate's ACTUAL experience (ONLY these entries are allowed):\n"
            + "\n".join(original_companies) + "\n\n"
            "RULES:\n"
            "- Include ONLY the experience entries listed above. Do NOT invent any others.\n"
            "- Keep all other improvements (summary, skills, bullet rewording).\n"
            "- Return the same JSON structure as before.\n\n"
            f"=== CORRECTED RESUME SO FAR ===\n{corrected_json}\n\n"
            f"=== JOB DESCRIPTION ===\n{jd_json}"
        )

    @staticmethod
    def _smart_truncate(json_str: str, max_chars: int = 8000) -> str:
        """Truncate resume JSON while preserving all top-level sections.

        If the full JSON fits, return it. Otherwise, progressively trim
        bullet counts from experience entries (oldest first) until it fits.
        """
        if len(json_str) <= max_chars:
            return json_str

        data = json.loads(json_str)
        for exp in reversed(data.get("experience", [])):
            bullets = exp.get("bullets", [])
            while len(bullets) > 2 and len(json.dumps(data, indent=2)) > max_chars:
                bullets.pop()
            exp["bullets"] = bullets

        result = json.dumps(data, indent=2)
        return result[:max_chars]  # final safety net

    @staticmethod
    def _build_gap_context(gap: Dict[str, Any]) -> str:
        """Build keyword gap context block for the prompt."""
        coverage = gap.get("coverage_percentage", 0)
        req_missing = gap.get("required_missing", [])
        missing = gap.get("missing_keywords", [])

        if not missing and not req_missing:
            return ""

        parts = [f"KEYWORD GAP ANALYSIS (current resume coverage: {coverage}%):\n"]

        if req_missing:
            parts.append(
                "MISSING REQUIRED SKILLS (MUST add these if candidate has ANY related experience): "
                f"{', '.join(req_missing)}\n"
            )

        # General missing (exclude required already listed)
        req_set = set(r.lower() for r in req_missing)
        general_missing = [kw for kw in missing if kw.lower() not in req_set]
        if general_missing:
            parts.append(
                "MISSING GENERAL KEYWORDS (add where naturally relevant): "
                f"{', '.join(general_missing)}\n"
            )

        parts.append("\n")
        return "".join(parts)

    @staticmethod
    def _build_role_context(
        structured_resume: Dict[str, Any], jd_analysis: Dict[str, Any]
    ) -> str:
        """Build role alignment context if there's a title mismatch."""
        candidate_titles = extract_job_titles(structured_resume)
        jd_title = jd_analysis.get("job_title", "")

        if not candidate_titles or not jd_title:
            return ""

        return (
            "ROLE ALIGNMENT:\n"
            f"Candidate's recent titles: {', '.join(candidate_titles[:3])}\n"
            f"Target role: {jd_title}\n"
            "If there is a mismatch (e.g., candidate is 'Backend Engineer' but target is "
            "'Full-Stack Developer'), adjust the summary to bridge the gap and emphasize "
            "transferable skills and cross-functional experience.\n\n"
        )
