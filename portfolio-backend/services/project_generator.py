"""
Project Generator — generates a single grounded project when the original resume has none.

Called ONLY when len(original_resume["projects"]) == 0.
Output is validated against allowed tech from the resume before being injected.

Rules:
- Ground the project in the candidate's demonstrated skills and experience context
- Match the JD domain (use technologies that align with the JD AND exist in the resume)
- No fake company names, production deployment claims, or invented metrics
- dates field is always empty string
- tech field only contains technologies present in the resume skills or bullets
- bullets: 3 realistic, grounded descriptions — what was built and how
"""
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ProjectGenerator:
    """Generates a single grounded project entry when the original resume has none."""

    def generate(
        self,
        original_resume: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Generate one project grounded in the candidate's skills and the JD domain.

        Returns a project dict {name, dates, bullets, tech} or None if generation
        fails validation or an error occurs.
        """
        from services.gemini_client import gemini_json
        from schemas.resume_schemas import flatten_skills, build_resume_text

        # Build context strings
        all_skills = flatten_skills(original_resume)
        resume_text = build_resume_text(original_resume)
        skills_text = ", ".join(all_skills) if all_skills else "general software development"

        jd_title = jd_analysis.get("job_title", "software engineering")
        jd_required = jd_analysis.get("required_skills", [])
        jd_keywords = jd_analysis.get("keywords", [])
        jd_industry = jd_analysis.get("industry", "")

        # Identify JD-relevant skills that the candidate actually has
        resume_text_lower = resume_text.lower()
        relevant_tech = [
            s for s in (jd_required + jd_keywords)
            if s.lower() in resume_text_lower
        ]
        relevant_tech_str = ", ".join(relevant_tech[:10]) if relevant_tech else skills_text[:200]

        prompt = (
            "You are generating a single portfolio project entry for a resume.\n\n"
            "STRICT RULES — violations will be rejected:\n"
            "1. Use ONLY technologies that appear in the candidate's skills or experience below.\n"
            "2. Do NOT invent fake company names, production systems, or client work.\n"
            "3. Do NOT invent metrics, percentages, or numbers.\n"
            "4. The project must be a realistic personal or open-source project (not a job).\n"
            "5. dates: return empty string ''.\n"
            "6. tech: comma-separated list of ONLY technologies present in the candidate's profile.\n"
            "7. bullets: exactly 3 bullets, each ~100-150 chars, describing what was built and how.\n"
            "8. Name the project after the domain it covers — e.g. 'Cloud Cost Dashboard', "
            "'ML Pipeline Automation', 'REST API Gateway'.\n\n"
            f"Candidate's skills: {skills_text[:300]}\n"
            f"JD domain: {jd_title}" + (f" in {jd_industry}" if jd_industry else "") + "\n"
            f"JD-relevant tech the candidate knows: {relevant_tech_str}\n\n"
            "Return a JSON object with EXACTLY this structure:\n"
            "{\n"
            '  "name": "Project Name",\n'
            '  "dates": "",\n'
            '  "bullets": [\n'
            '    "Bullet 1 (~100-150 chars, action verb + technology + outcome)",\n'
            '    "Bullet 2",\n'
            '    "Bullet 3"\n'
            "  ],\n"
            '  "tech": "Tech1, Tech2, Tech3"\n'
            "}\n\n"
            f"=== CANDIDATE RESUME CONTEXT ===\n{resume_text[:3000]}"
        )

        try:
            result = gemini_json(prompt, max_tokens=1024, temperature=0.3)
        except Exception as e:
            logger.warning("ProjectGenerator: Gemini call failed: %s", e)
            return None

        if not isinstance(result, dict):
            logger.warning("ProjectGenerator: Gemini returned non-dict")
            return None

        project = self._validate_and_clean(result, original_resume)
        return project

    def _validate_and_clean(
        self,
        project: Dict[str, Any],
        original_resume: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Validate generated project against allowed tech and schema.

        Returns cleaned project or None if it fails safety checks.
        """
        from schemas.resume_schemas import flatten_skills, build_resume_text

        name = str(project.get("name", "")).strip()
        bullets = project.get("bullets", [])
        tech_str = str(project.get("tech", "")).strip()

        if not name:
            logger.warning("ProjectGenerator: generated project has no name")
            return None

        if not isinstance(bullets, list) or len(bullets) == 0:
            logger.warning("ProjectGenerator: generated project has no bullets")
            return None

        # Enforce exactly 3 bullets, all strings, non-empty
        clean_bullets = [str(b).strip() for b in bullets if str(b).strip()][:3]
        if not clean_bullets:
            return None

        # Validate tech: only keep items that appear in the resume text or skills
        resume_text_lower = build_resume_text(original_resume).lower()
        all_skills_lower = {s.lower() for s in flatten_skills(original_resume)}

        allowed_tech = []
        for tech_item in tech_str.split(","):
            t = tech_item.strip()
            if not t:
                continue
            if t.lower() in all_skills_lower or t.lower() in resume_text_lower:
                allowed_tech.append(t)
            else:
                logger.debug("ProjectGenerator: dropped unsupported tech '%s'", t)

        if not allowed_tech:
            # Keep up to 3 skills from resume as fallback
            allowed_tech = flatten_skills(original_resume)[:3]

        return {
            "name": name,
            "dates": "",
            "bullets": clean_bullets,
            "tech": ", ".join(allowed_tech),
        }
