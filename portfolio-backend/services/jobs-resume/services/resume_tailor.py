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
        from services.gemini_client import gemini_json, GEMINI_PRO, GEMINI_PREVIEW
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

        result = gemini_json(
            prompt=prompt, 
            max_tokens=8192, 
            temperature=0.4, 
            model=GEMINI_PRO
        )
        # Type coercion remains to fill defaults for entirely missing sections
        validated = validate_and_coerce(result, TAILORED_RESUME_SCHEMA)

        # --- Integrity enforcement ---
        corrected, report = self._guard.enforce(structured_resume, validated)

        if report.severity == "clean":
            logger.info("Integrity check: clean — no violations detected")
            return self._restore_contact(corrected, structured_resume)

        if report.severity == "auto_fixed":
            logger.warning(
                "Integrity check: auto-fixed — %d immutable overwrites, "
                "%d hallucinated projects removed, %d missing experience re-injected",
                len(report.immutable_overwrites),
                len(report.hallucinated_projects),
                len(report.missing_experience_reinjected),
            )
            return self._restore_contact(corrected, structured_resume)

        # severity == "needs_retry": hallucinated experience detected
        logger.warning(
            "Integrity check: needs retry — %d hallucinated experience entries: %s",
            len(report.hallucinated_experience),
            [e.get("company", "?") for e in report.hallucinated_experience],
        )
        correction_prompt = self._build_correction_prompt(
            structured_resume, jd_analysis, corrected, report
        )
        # Repair path: use GEMINI_PREVIEW for bounded correction only
        retry_result = gemini_json(
            prompt=correction_prompt, 
            max_tokens=8192, 
            temperature=0.3, 
            model=GEMINI_PREVIEW
        )
        retry_validated = validate_and_coerce(retry_result, TAILORED_RESUME_SCHEMA)

        final, retry_report = self._guard.enforce(structured_resume, retry_validated)

        if retry_report.severity == "needs_retry":
            logger.error(
                "Integrity check: retry still has %d hallucinations — "
                "using auto-corrected version",
                len(retry_report.hallucinated_experience),
            )

        return self._restore_contact(final, structured_resume)

    @staticmethod
    def _restore_contact(
        tailored: Dict[str, Any], original: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Forcefully restore original contact fields onto tailored output.

        Gemini sometimes rewrites contact fields despite being told not to.
        This guarantees the original parsed values (especially LinkedIn/GitHub
        from PDF annotations) are always preserved.
        """
        original_contact = original.get("contact", {})
        if original_contact:
            tailored["contact"] = dict(original_contact)  # full copy
            logger.info("Tailor: restored original contact fields")
        return tailored

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
            "You are a professional resume writer helping a candidate present their experience clearly.\n"
            "Given the candidate's ACTUAL resume (as structured JSON) and a structured job description analysis,\n"
            "produce a COMPLETE tailored resume as a JSON object.\n\n"
            "YOUR #1 GOAL: Produce a clear, professional, human-sounding resume. The content should "
            "naturally align with the job description without sounding like a keyword-stuffed template.\n"
            "The resume should naturally incorporate these JD keywords/skills where the candidate has "
            f"genuinely related experience: {keyword_list}\n\n"
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
            "8. Each experience bullet should start with an action verb and describe what was done with the "
            "technologies actually used. Include impact or outcome where the original bullet had one. "
            "Do NOT add technologies the candidate did not use.\n"
            "9. Include each required_skill from the JD in the skills section. Where the candidate has relevant "
            "experience, naturally reference these skills in bullets — but do not force-fit them.\n"
            "10. Use a diverse mix of action verbs. No single verb may start more than 2 bullets across "
            "the entire resume. Good verbs include: Built, Developed, Implemented, Designed, Led, Managed, "
            "Created, Configured, Optimized, Reduced, Migrated, Integrated, Automated, Deployed, Maintained, "
            "Collaborated, Established, Streamlined, Refactored, Monitored. Avoid overusing 'Spearheaded', "
            "'Architected', 'Engineered', or 'Orchestrated' — these sound robotic when used more than once. "
            "Write as a normal, competent professional would write their own resume.\n\n"
            "INTEGRITY RULES:\n"
            "1. NEVER fabricate, invent, or add experience entries, companies, or job titles NOT in the original.\n"
            "2. Output MUST contain exactly the same number of experience entries as the input — no more, no less.\n"
            "3. NEVER invent metrics, percentages, or numbers not present in the original bullets.\n"
            "4. NEVER add major skills the candidate does not possess.\n"
            "5. You MAY add small, closely related skills (e.g., if they know Docker, you can add 'containerization').\n"
            "6. Projects: Include ONLY projects from the original resume. If none exist, return an empty projects array []. The backend will handle project generation separately.\n"
            "7. certifications: always return an empty array [].\n"
            "8. Every field in the JSON MUST be a non-null string or array — never null.\n\n"
            "FEW-SHOT EXAMPLES (How to Tailor without Hallucinating):\n"
            "Example 1: Aligning to JD without inventing skills\n"
            "JD requires: Kubernetes, CI/CD, Go\n"
            "Original Bullet: 'Built APIs with Python and deployed them on cloud servers.'\n"
            "BAD Rewrite: 'Built APIs with Go and deployed on Kubernetes using CI/CD.' (Hallucination! They didn't use Go or K8s)\n"
            "GOOD Rewrite: 'Built scalable APIs with Python and deployed them to cloud infrastructure, improving deployment reliability.'\n\n"
            "Example 2: Adding Impact without faking metrics\n"
            "Original Bullet: 'Helped the frontend team build the dashboard in React.'\n"
            "BAD Rewrite: 'Spearheaded React dashboard development, increasing revenue by 40%.' (Fake metric!)\n"
            "GOOD Rewrite: 'Worked with the frontend team to build and improve a React dashboard, enhancing data visibility for stakeholders.'\n\n"
            "CONTENT & FORMAT RULES (the resume MUST physically fill ONE full A4 page with substantive text):\n"
            "1. Summary: 3-4 clear, confident sentences that naturally incorporate the target role title and "
            "3-4 top required skills. Use plain, professional language.\n"
            "BANNED WORDS/PHRASES — do NOT use ANY of these in the summary or anywhere else in the resume:\n"
            "'Versatile', 'Proficient', 'Leverages', 'Leverage', 'extensive experience', 'proven track record',\n"
            "'results-driven', 'passionate', 'detail-oriented', 'highly skilled', 'seasoned', 'cutting-edge',\n"
            "'innovative', 'dynamic', 'self-motivated', 'Adept', 'dedicated', 'committed to excellence',\n"
            "'strong foundation', 'seeking a challenging'. Do NOT start the summary with an adjective.\n"
            "BAD example: 'Versatile Python FullStack Developer with extensive experience designing scalable systems'\n"
            "GOOD example: 'Full-stack developer with 4+ years building Python backends and React frontends, "
            "focused on API design, cloud deployment, and CI/CD automation.'\n"
            "Write like a real person describing their work — direct, specific, no buzzwords.\n"
            "2. Experience: You MUST generate enough bullets across all roles to total ~15-20 bullets combined. "
            "Allocate 5-8 bullets for the most recent role, 4-6 for the prior, and 2-4 for older roles. "
            "Each bullet MUST be detailed enough to span 2 full lines (~150-220 chars).\n"
            "3. Skills: 4-6 categories with comprehensive skill lists, most JD-relevant first. "
            "Include ALL skills from the original resume that are relevant to the JD, experience bullets, "
            "or projects — do NOT drop original skills just because they are not explicitly in the JD. "
            "Also include JD-required skills where the candidate has related experience. "
            "Only omit skills that are completely irrelevant to both the JD and the candidate's work.\n"
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
            '      "degree": "ONLY the degree name (e.g. Master of Science, Information Technology). Do NOT include dates, institution, or location in this field.",\n'
            '      "institution": "University Name (MUST be separate from degree)",\n'
            '      "location": "City, State (MUST be separate from institution)",\n'
            '      "dates": "Graduation date or date range (MUST be separate from degree)",\n'
            '      "gpa": "GPA if available",\n'
            '      "coursework": "Relevant coursework if listed"\n'
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
                "MISSING REQUIRED SKILLS (incorporate naturally if candidate has related experience): "
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

        # Skip bridging if titles already match
        candidate_lower = {t.lower() for t in candidate_titles[:3]}
        jd_lower = jd_title.lower()
        if any(jd_lower in t or t in jd_lower for t in candidate_lower):
            return ""

        return (
            "CROSS-ROLE ALIGNMENT (IMPORTANT — the candidate's background differs from the target role):\n"
            f"Candidate's recent titles: {', '.join(candidate_titles[:3])}\n"
            f"Target role: {jd_title}\n\n"
            "Because the candidate is shifting roles, apply ALL of the following strategies:\n"
            "1. SUMMARY: Write a bridge narrative that explicitly connects the candidate's background "
            f"to the {jd_title} role. Highlight how their existing expertise translates — e.g., "
            "'Cloud Engineer with hands-on full-stack development experience' rather than just "
            "'Cloud Engineer'. Reference specific overlapping technologies.\n"
            "2. EXPERIENCE BULLETS: For each role, reframe bullets to emphasize aspects that are "
            "transferable to the target role. Bring forward any bullets involving technologies or "
            "responsibilities that overlap with the JD. For example, if a Cloud Engineer built "
            "internal dashboards or APIs, lead with those bullets and emphasize the development "
            "work, not just the infrastructure aspect.\n"
            "3. SKILL CATEGORIES: Reorder skill categories so the most target-role-relevant category "
            f"appears first. For a {jd_title} role, lead with languages/frameworks, then tools, "
            "then infrastructure. Within each category, put JD-matching skills first.\n"
            "4. TRANSFERABLE FRAMING: Map the candidate's domain expertise to JD requirements — "
            "e.g., 'CI/CD pipeline design' maps to 'DevOps and deployment automation', "
            "'monitoring and observability' maps to 'production reliability', "
            "'API development' maps to 'backend engineering'.\n"
            "5. Do NOT fabricate experience. Only reframe, reorder, and emphasize existing work. "
            "The candidate's actual companies, titles, and dates must remain unchanged.\n\n"
        )
