"""
Project Generator — generates a single grounded project per invocation.

Called by ContentAugmenter when page fill is below threshold and project
count < 3, regardless of whether the original resume already has projects.
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
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ProjectGenerator:
    """Generates a single grounded project entry per invocation."""

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
        all_skills_lower = {s.lower() for s in all_skills}
        relevant_tech = [
            s for s in (jd_required + jd_keywords)
            if s.lower() in all_skills_lower
            or re.search(r'\b' + re.escape(s.lower()) + r'\b', resume_text_lower)
        ]
        relevant_tech_str = ", ".join(relevant_tech[:10]) if relevant_tech else skills_text[:200]

        prompt = (
            "You are generating a single portfolio project entry for a resume.\n\n"
            "STRICT RULES — violations will be rejected:\n"
            "1. Use ONLY technologies that appear in the candidate's skills or experience below.\n"
            "2. Do NOT invent fake company names, production systems, or client work.\n"
            "3. Do NOT invent metrics, percentages, or numbers.\n"
            "4. The project must be a realistic personal or open-source project that a developer "
            "would actually build and put on GitHub — not a generic label or placeholder.\n"
            "5. dates: return empty string ''.\n"
            "6. tech: comma-separated list of ONLY technologies present in the candidate's profile.\n"
            "7. bullets: exactly 3 bullets, each ~100-150 chars, describing what was built and how. "
            "Each bullet should be specific and technical — mention real patterns, tools, and design decisions.\n"
            "8. The project name MUST sound like a real GitHub project name. Think about what a real "
            "developer would name their project based on what it does.\n"
            "   GOOD NAMES: 'Payment Fraud Detection API', 'Real-Time Log Aggregator', "
            "'E-Commerce Search Engine', 'Cloud Cost Optimizer', 'Distributed Task Queue', "
            "'Sentiment Analysis Pipeline', 'API Rate Limiter Service'.\n"
            "   BAD NAMES (NEVER use these patterns): 'Python FullStack Developer Portfolio Project', "
            "'Software Engineer Project', 'Backend Engineer Side Project', "
            "'Python & AWS Integration Platform', anything with the job title in it.\n"
            "   The name must describe WHAT the project does, not WHO built it or WHAT role it's for.\n\n"
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
            from services.gemini_client import GEMINI_FLASH
            PROJECT_SCHEMA = {
                "name": str,
                "dates": str,
                "bullets": [str],
                "tech": str
            }
            # Use FLASH for speed — project quality is governed by the prompt,
            # and FLASH is ~2-3x faster for structured JSON output.
            result = None
            try:
                result = gemini_json(
                    prompt,
                    max_tokens=4096,
                    temperature=0.3,
                    model=GEMINI_FLASH,
                    schema=PROJECT_SCHEMA
                )
            except Exception as e:
                logger.warning("ProjectGenerator: FLASH call failed: %s", e)

            if not isinstance(result, dict):
                logger.warning("ProjectGenerator: all Gemini models failed — result type: %s", type(result))
                return None

            logger.info("ProjectGenerator: Gemini returned project name='%s', tech='%s'",
                        result.get('name', '?'), result.get('tech', '?'))

        except Exception as e:
            logger.warning("ProjectGenerator: Gemini call failed: %s", e)
            return None

        project = self._validate_and_clean(result, original_resume, jd_analysis)
        if project is None:
            logger.warning("ProjectGenerator: AI project failed validation (name='%s')",
                           result.get('name', '?') if isinstance(result, dict) else '?')
            return None
        return project

    def generate_batch(
        self,
        count: int,
        original_resume: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        existing_projects: list = None,
    ) -> list:
        """Generate multiple projects in a single Gemini call for speed.

        Returns a list of validated project dicts (may be fewer than `count`
        if some fail validation or are duplicates).
        """
        from services.gemini_client import gemini_json, GEMINI_FLASH
        from schemas.resume_schemas import flatten_skills, build_resume_text

        if count <= 0:
            return []

        all_skills = flatten_skills(original_resume)
        resume_text = build_resume_text(original_resume)
        skills_text = ", ".join(all_skills) if all_skills else "general software development"

        jd_title = jd_analysis.get("job_title", "software engineering")
        jd_required = jd_analysis.get("required_skills", [])
        jd_keywords = jd_analysis.get("keywords", [])
        jd_industry = jd_analysis.get("industry", "")

        resume_text_lower = resume_text.lower()
        all_skills_lower = {s.lower() for s in all_skills}
        relevant_tech = [
            s for s in (jd_required + jd_keywords)
            if s.lower() in all_skills_lower
            or re.search(r'\b' + re.escape(s.lower()) + r'\b', resume_text_lower)
        ]
        relevant_tech_str = ", ".join(relevant_tech[:10]) if relevant_tech else skills_text[:200]

        # Build list of existing project names to avoid duplicates
        existing_names = []
        if existing_projects:
            existing_names = [p.get("name", "") for p in existing_projects if p.get("name")]

        avoid_clause = ""
        if existing_names:
            avoid_clause = (
                f"\nAVOID DUPLICATES: The resume already has these projects: "
                f"{', '.join(existing_names)}. Generate DIFFERENT projects.\n"
            )

        prompt = (
            f"You are generating {count} portfolio project entries for a resume.\n\n"
            "STRICT RULES — violations will be rejected:\n"
            "1. Use ONLY technologies that appear in the candidate's skills or experience below.\n"
            "2. Do NOT invent fake company names, production systems, or client work.\n"
            "3. Do NOT invent metrics, percentages, or numbers.\n"
            "4. Each project must be a realistic personal or open-source project that a developer "
            "would actually build and put on GitHub — not a generic label or placeholder.\n"
            "5. dates: return empty string '' for each project.\n"
            "6. tech: comma-separated list of ONLY technologies present in the candidate's profile.\n"
            "7. bullets: exactly 3 bullets per project, each ~100-150 chars, describing what was built and how. "
            "Each bullet should be specific and technical — mention real patterns, tools, and design decisions.\n"
            "8. Each project name MUST sound like a real GitHub project name. Think about what a real "
            "developer would name their project based on what it does.\n"
            "   GOOD NAMES: 'Payment Fraud Detection API', 'Real-Time Log Aggregator', "
            "'E-Commerce Search Engine', 'Cloud Cost Optimizer', 'Distributed Task Queue'.\n"
            "   BAD NAMES (NEVER): 'Python FullStack Developer Portfolio Project', "
            "'Software Engineer Project', anything with the job title in it.\n"
            "   The name must describe WHAT the project does, not WHO built it.\n"
            f"9. Each project must be DISTINCT — different domains, different tech stacks.\n"
            f"{avoid_clause}\n"
            f"Candidate's skills: {skills_text[:300]}\n"
            f"JD domain: {jd_title}" + (f" in {jd_industry}" if jd_industry else "") + "\n"
            f"JD-relevant tech the candidate knows: {relevant_tech_str}\n\n"
            "Return a JSON object with EXACTLY this structure:\n"
            '{"projects": [\n'
            '  {"name": "Project Name", "dates": "", "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"], "tech": "Tech1, Tech2"}\n'
            "]}\n\n"
            f"=== CANDIDATE RESUME CONTEXT ===\n{resume_text[:3000]}"
        )

        BATCH_SCHEMA = {
            "projects": [{
                "name": str,
                "dates": str,
                "bullets": [str],
                "tech": str,
            }]
        }

        try:
            result = gemini_json(
                prompt, max_tokens=4096, temperature=0.3,
                model=GEMINI_FLASH, schema=BATCH_SCHEMA,
            )
        except Exception as e:
            logger.warning("ProjectGenerator: batch generation failed: %s", e)
            return []

        raw_projects = result.get("projects", [])
        if not isinstance(raw_projects, list):
            return []

        validated = []
        for raw in raw_projects:
            if not isinstance(raw, dict):
                continue
            project = self._validate_and_clean(raw, original_resume, jd_analysis)
            if project is None:
                continue
            # Check for duplicates against existing + already-validated
            all_existing = (existing_projects or []) + validated
            from services.content_augmenter import ContentAugmenter
            if ContentAugmenter._is_duplicate_project(project, all_existing):
                logger.info("ProjectGenerator batch: duplicate project '%s' — skipping", project.get("name"))
                continue
            validated.append(project)
            if len(validated) >= count:
                break

        logger.info("ProjectGenerator batch: generated %d/%d valid projects", len(validated), count)
        return validated

    def _validate_and_clean(
        self,
        project: Dict[str, Any],
        original_resume: Dict[str, Any],
        jd_analysis: Dict[str, Any] = None,
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

        # If name contains the job title or "Portfolio", ask Gemini for a better name
        needs_rename = False
        jd_title = ""
        if jd_analysis:
            jd_title = jd_analysis.get("job_title", "").strip()
            if jd_title and jd_title.lower() in name.lower():
                logger.warning("ProjectGenerator: name '%s' contains job title '%s', requesting new name from Gemini", name, jd_title)
                needs_rename = True
        if "portfolio" in name.lower():
            logger.warning("ProjectGenerator: name '%s' contains 'portfolio', requesting new name from Gemini", name)
            needs_rename = True

        if needs_rename:
            new_name = self._generate_project_name(tech_str, jd_title)
            if new_name:
                project["name"] = new_name
                name = new_name
                logger.info("ProjectGenerator: Gemini generated new name: '%s'", new_name)
            else:
                logger.warning("ProjectGenerator: Gemini name retry failed, rejecting project")
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
            t_lower = t.lower()
            if t_lower in all_skills_lower:
                allowed_tech.append(t)
            elif re.search(r'\b' + re.escape(t_lower) + r'\b', resume_text_lower):
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

    @staticmethod
    def _generate_project_name(tech_str: str, jd_title: str) -> Optional[str]:
        """Ask Gemini for just a project name when the initial name was bad.

        Uses FLASH for speed/cost — this is a lightweight one-shot call.
        Returns the name string or None if it fails.
        """
        try:
            from services.gemini_client import gemini_json, GEMINI_FLASH

            prompt = (
                "Generate a single project name for a developer's portfolio project.\n\n"
                "The project uses these technologies: " + tech_str + "\n"
                + (f"The target job domain is: {jd_title}\n" if jd_title else "")
                + "\nRULES:\n"
                "- The name must describe WHAT the project does (e.g. 'Payment Fraud Detection API', "
                "'Real-Time Log Aggregator', 'E-Commerce Search Engine').\n"
                "- Do NOT include any job title, role name, or the word 'Portfolio'.\n"
                "- The name should be 2-5 words, sound like a real GitHub project.\n"
                "- Think about what a developer would actually build with these technologies.\n\n"
                'Return a JSON object: {"name": "Your Project Name"}\n'
            )

            result = gemini_json(
                prompt, max_tokens=100, temperature=0.7, model=GEMINI_FLASH,
                schema={"name": str}
            )
            if isinstance(result, dict) and result.get("name", "").strip():
                name = result["name"].strip()
                # Final safety check: ensure the name doesn't still contain the job title
                if jd_title and jd_title.lower() in name.lower():
                    logger.warning("ProjectGenerator: Gemini name retry still contains job title: '%s'", name)
                    return None
                if "portfolio" in name.lower():
                    logger.warning("ProjectGenerator: Gemini name retry still contains 'portfolio': '%s'", name)
                    return None
                return name
        except Exception as e:
            logger.warning("ProjectGenerator: name generation failed: %s", e)
        return None

