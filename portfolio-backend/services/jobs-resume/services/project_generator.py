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


def _summarize_experience_bullets(original_resume: Dict[str, Any], max_chars: int = 1800) -> str:
    """Build a compact 'avoid duplicating these' block for project prompts.

    Lists each experience entry's bullets so the generator can see what
    territory the resume already covers. Returns an empty string when the
    candidate has no experience — in that case there's nothing to avoid.
    """
    experience = original_resume.get("experience") or []
    if not experience:
        return ""

    lines = []
    for exp in experience:
        company = (exp.get("company") or "").strip() or "Experience"
        title = (exp.get("title") or "").strip()
        header = f"  • {company} — {title}" if title else f"  • {company}"
        lines.append(header)
        for b in (exp.get("bullets") or []):
            text = str(b).strip()
            if text:
                lines.append(f"    - {text}")

    joined = "\n".join(lines)
    if len(joined) > max_chars:
        joined = joined[:max_chars].rsplit("\n", 1)[0] + "\n    [...]"
    return joined


class ProjectGenerator:
    """Generates a single grounded project entry per invocation."""

    def generate(
        self,
        original_resume: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        bullets_per_project: int = 3,
    ) -> Optional[Dict[str, Any]]:
        """Generate one project grounded in the candidate's skills and the JD domain.

        Args:
            bullets_per_project: how many bullets the generated project should
                have. Default 3 preserves prior behavior; callers with a known
                vertical budget (ContentAugmenter._augment_projects) pass the
                exact count that fits the page.

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
        experience_block = _summarize_experience_bullets(original_resume)

        prompt = (
            "You are generating a single portfolio project entry for a resume.\n\n"
            "COMPLEMENT, DON'T DUPLICATE — this is the most important rule:\n"
            "  You will be shown the candidate's existing experience bullets below. The generated\n"
            "  project must EXPAND THE CANDIDATE'S NARRATIVE by exploring a DIFFERENT domain, tech\n"
            "  facet, or problem space than what the experience already demonstrates. If the\n"
            "  experience already shows RabbitMQ event-driven work, do NOT propose a 'RabbitMQ\n"
            "  decoupling' project — pick a different problem. If the experience already shows a\n"
            "  Grafana observability dashboard, do NOT propose another observability dashboard.\n"
            "  Restating an experience bullet as a project is a failure.\n\n"
            "WORKFLOW — follow these steps IN ORDER (do not start with the name):\n"
            "  STEP 1: Read the EXPERIENCE BULLETS block below and note what's already covered.\n"
            "  STEP 2: Decide the project's PURPOSE — a problem NOT already covered by the\n"
            "          experience. Write one sentence in the 'purpose' field.\n"
            "  STEP 3: Pick a tech stack from the candidate's actual skills that would solve that problem.\n"
            "  STEP 4: Write 3 bullets describing what was built and how, using that tech.\n"
            "  STEP 5: ONLY NOW derive the project NAME from the purpose. The name describes WHAT\n"
            "          it does, never WHO built it.\n\n"
            "STRICT RULES — violations will be rejected:\n"
            "1. Use ONLY technologies that appear in the candidate's skills or experience below.\n"
            "2. Do NOT invent fake company names, production systems, or client work.\n"
            "3. Do NOT invent metrics, percentages, or numbers.\n"
            "4. The project must be a realistic personal or open-source project that a developer "
            "would actually build and put on GitHub — not a generic label or placeholder.\n"
            "5. dates: return empty string ''.\n"
            "6. tech: comma-separated list of ONLY technologies present in the candidate's profile.\n"
            f"7. bullets: exactly {bullets_per_project} bullets, each ~100-150 chars, describing what was built and how. "
            "Each bullet MUST end with a period ('.'). "
            "Each bullet should be specific and technical — mention real patterns, tools, and design decisions.\n"
            "8. PROJECT NAME RULES — the name describes WHAT the project does:\n"
            "   GOOD NAMES: 'Payment Fraud Detection API', 'Real-Time Log Aggregator', "
            "'E-Commerce Search Engine', 'Cloud Cost Optimizer', 'Distributed Task Queue', "
            "'Sentiment Analysis Pipeline', 'API Rate Limiter Service'.\n"
            "   BAD NAMES (auto-rejected — name MUST NOT contain any of these words/patterns):\n"
            "     - The JD's job title (e.g. 'Backend Engineer Project', 'Full Stack Developer ...')\n"
            "     - The candidate's role title\n"
            "     - 'Portfolio', 'Project', 'Demo', 'Application', 'Platform' as filler\n"
            "     - Lists of techs in the name (e.g. 'Python & AWS Integration Platform')\n"
            "     - Anything describing WHO built it or WHAT ROLE it's for\n\n"
            f"Candidate's skills: {skills_text[:300]}\n"
            f"JD domain: {jd_title}" + (f" in {jd_industry}" if jd_industry else "") + "\n"
            f"JD-relevant tech the candidate knows: {relevant_tech_str}\n\n"
            + (
                "=== EXPERIENCE BULLETS (DO NOT DUPLICATE these problems/solutions in your project) ===\n"
                f"{experience_block}\n\n"
                if experience_block else ""
            )
            +
            "Return a JSON object with EXACTLY this structure:\n"
            "{\n"
            '  "purpose": "One sentence: what real problem does this project solve? (must NOT overlap with experience above)",\n'
            '  "name": "Project Name (derived from purpose — NOT starting from the name)",\n'
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
                "purpose": str,
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
                    max_tokens=12000,
                    temperature=0.3,
                    model=GEMINI_FLASH,
                    schema=PROJECT_SCHEMA
                )
            except Exception as e:
                logger.warning("ProjectGenerator: FLASH call failed: %s", e)

            if not isinstance(result, dict):
                logger.warning("ProjectGenerator: all LLM models failed — result type: %s", type(result))
                return None

            logger.info("ProjectGenerator: LLM returned project name='%s', tech='%s'",
                        result.get('name', '?'), result.get('tech', '?'))

        except Exception as e:
            logger.warning("ProjectGenerator: LLM call failed: %s", e)
            return None

        project = self._validate_and_clean(result, original_resume, jd_analysis, bullets_per_project)
        if project is None:
            logger.warning("ProjectGenerator: AI project failed validation (name='%s')",
                           result.get('name', '?') if isinstance(result, dict) else '?')
            return None

        # Reject if it restates an existing experience bullet.
        from services.content_augmenter import ContentAugmenter
        original_experience = original_resume.get("experience") or []
        overlaps, reason = ContentAugmenter._overlaps_experience(project, original_experience)
        if overlaps:
            logger.warning(
                "ProjectGenerator: project '%s' rejected — %s",
                project.get("name"), reason,
            )
            return None

        return project

    def generate_batch(
        self,
        count: int,
        original_resume: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        existing_projects: list = None,
        bullets_per_project: int = 3,
    ) -> list:
        """Generate multiple projects in a single LLM call for speed.

        Args:
            bullets_per_project: how many bullets each generated project should
                have. Default 3 preserves prior behavior; callers with a known
                vertical budget pass the exact count that fits the page.

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

        experience_block = _summarize_experience_bullets(original_resume)

        prompt = (
            f"You are generating {count} portfolio project entries for a resume.\n\n"
            "COMPLEMENT, DON'T DUPLICATE — this is the most important rule:\n"
            "  You will be shown the candidate's existing experience bullets below. Each generated\n"
            "  project must EXPAND THE CANDIDATE'S NARRATIVE by exploring a DIFFERENT domain, tech\n"
            "  facet, or problem space than what the experience already demonstrates. If the\n"
            "  experience already shows RabbitMQ event-driven work, do NOT propose a 'RabbitMQ\n"
            "  decoupling' project. If the experience already shows a Grafana SLI/SLO dashboard,\n"
            "  do NOT propose another observability dashboard. If the experience shows '420ms→95ms'\n"
            "  API optimization, do NOT propose an 'API performance' project. Restating an\n"
            "  experience bullet as a project is a failure.\n\n"
            "WORKFLOW FOR EACH PROJECT — follow these steps IN ORDER (do not start with the name):\n"
            "  STEP 1: Read the EXPERIENCE BULLETS block below and note what's already covered.\n"
            "  STEP 2: Decide the project's PURPOSE — a problem NOT already covered by experience.\n"
            "          Write it in 'purpose'.\n"
            "  STEP 3: Pick a tech stack from the candidate's actual skills that would solve that problem.\n"
            "  STEP 4: Write 3 bullets describing what was built and how.\n"
            "  STEP 5: ONLY NOW derive the project NAME from the purpose. Name = WHAT it does,\n"
            "          never WHO built it.\n\n"
            "STRICT RULES — violations will be rejected:\n"
            "1. Use ONLY technologies that appear in the candidate's skills or experience below.\n"
            "2. Do NOT invent fake company names, production systems, or client work.\n"
            "3. Do NOT invent metrics, percentages, or numbers.\n"
            "4. Each project must be a realistic personal or open-source project that a developer "
            "would actually build and put on GitHub — not a generic label or placeholder.\n"
            "5. dates: return empty string '' for each project.\n"
            "6. tech: comma-separated list of ONLY technologies present in the candidate's profile.\n"
            f"7. bullets: exactly {bullets_per_project} bullets per project, each ~100-150 chars, describing what was built and how. "
            "Each bullet MUST end with a period ('.'). "
            "Each bullet should be specific and technical — mention real patterns, tools, and design decisions.\n"
            "8. PROJECT NAME RULES — the name describes WHAT the project does:\n"
            "   GOOD NAMES: 'Payment Fraud Detection API', 'Real-Time Log Aggregator', "
            "'E-Commerce Search Engine', 'Cloud Cost Optimizer', 'Distributed Task Queue'.\n"
            "   BAD NAMES (auto-rejected — name MUST NOT contain any of these words/patterns):\n"
            "     - The JD's job title or the candidate's role title\n"
            "     - 'Portfolio', 'Project', 'Demo', 'Application', 'Platform' as filler\n"
            "     - Lists of techs in the name ('Python & AWS Integration Platform')\n"
            "     - Anything describing WHO built it or WHAT ROLE it's for\n"
            f"9. Each project must be DISTINCT — different domains, different tech stacks.\n"
            f"{avoid_clause}\n"
            f"Candidate's skills: {skills_text[:300]}\n"
            f"JD domain: {jd_title}" + (f" in {jd_industry}" if jd_industry else "") + "\n"
            f"JD-relevant tech the candidate knows: {relevant_tech_str}\n\n"
            + (
                "=== EXPERIENCE BULLETS (DO NOT DUPLICATE these problems/solutions in any project) ===\n"
                f"{experience_block}\n\n"
                if experience_block else ""
            )
            +
            "Return a JSON object with EXACTLY this structure:\n"
            '{"projects": [\n'
            '  {"purpose": "One sentence: what problem this solves (must NOT overlap with experience above)", '
            '"name": "Project Name (derived from purpose)", '
            '"dates": "", "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"], "tech": "Tech1, Tech2"}\n'
            "]}\n\n"
            f"=== CANDIDATE RESUME CONTEXT ===\n{resume_text[:3000]}"
        )

        BATCH_SCHEMA = {
            "projects": [{
                "purpose": str,
                "name": str,
                "dates": str,
                "bullets": [str],
                "tech": str,
            }]
        }

        try:
            result = gemini_json(
                prompt, max_tokens=12000, temperature=0.3,
                model=GEMINI_FLASH, schema=BATCH_SCHEMA,
            )
        except Exception as e:
            logger.warning("ProjectGenerator: batch generation failed: %s", e)
            return []

        raw_projects = result.get("projects", [])
        if not isinstance(raw_projects, list):
            return []

        validated = []
        original_experience = original_resume.get("experience") or []
        for raw in raw_projects:
            if not isinstance(raw, dict):
                continue
            project = self._validate_and_clean(raw, original_resume, jd_analysis, bullets_per_project)
            if project is None:
                continue
            from services.content_augmenter import ContentAugmenter
            # Check for duplicates against existing + already-validated projects
            all_existing = (existing_projects or []) + validated
            if ContentAugmenter._is_duplicate_project(project, all_existing):
                logger.info("ProjectGenerator batch: duplicate project '%s' — skipping", project.get("name"))
                continue
            # Check for overlap with the candidate's experience bullets — projects
            # that restate experience add no signal and waste resume real estate.
            overlaps, reason = ContentAugmenter._overlaps_experience(project, original_experience)
            if overlaps:
                logger.info(
                    "ProjectGenerator batch: project '%s' rejected — %s",
                    project.get("name"), reason,
                )
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
        bullets_per_project: int = 3,
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

        # Fix slug-style names: "payment-fraud-detection-api" → "Payment Fraud Detection API"
        if "-" in name and name == name.lower():
            name = name.replace("-", " ").title()
            project["name"] = name
            logger.info("ProjectGenerator: converted slug name to title case: '%s'", name)

        # If name contains banned filler words or the JD/role title, ask LLM for a better name.
        # Expanded rejection list — matches the BAD NAMES rule in the prompt.
        BANNED_NAME_TOKENS = ("portfolio", "demo", "project", "application", "platform")
        needs_rename = False
        jd_title = ""
        name_lower = name.lower()
        if jd_analysis:
            jd_title = jd_analysis.get("job_title", "").strip()
            if jd_title and jd_title.lower() in name_lower:
                logger.warning(
                    "ProjectGenerator: name '%s' contains job title '%s', requesting new name from LLM",
                    name, jd_title,
                )
                needs_rename = True
        for token in BANNED_NAME_TOKENS:
            # match as a whole word so e.g. 'Application' as a noun is rejected
            # but 'Web Application Firewall' (rare) would still bounce — that's OK.
            if re.search(r'\b' + token + r'\b', name_lower):
                logger.warning(
                    "ProjectGenerator: name '%s' contains banned token '%s', requesting new name",
                    name, token,
                )
                needs_rename = True
                break

        if needs_rename:
            new_name = self._generate_project_name(tech_str, jd_title)
            if new_name:
                project["name"] = new_name
                name = new_name
                logger.info("ProjectGenerator: LLM generated new name: '%s'", new_name)
            else:
                logger.warning("ProjectGenerator: LLM name retry failed, rejecting project")
                return None

        if not isinstance(bullets, list) or len(bullets) == 0:
            logger.warning("ProjectGenerator: generated project has no bullets")
            return None

        # Enforce exactly 3 bullets, all strings, non-empty
        clean_bullets = [str(b).strip() for b in bullets if str(b).strip()][:bullets_per_project]
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
        """Ask LLM for just a project name when the initial name was bad.

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
                prompt, max_tokens=300, temperature=0.7, model=GEMINI_FLASH,
                schema={"name": str}
            )
            if isinstance(result, dict) and result.get("name", "").strip():
                name = result["name"].strip()
                # Final safety check: ensure the name doesn't still contain the job title
                if jd_title and jd_title.lower() in name.lower():
                    logger.warning("ProjectGenerator: LLM name retry still contains job title: '%s'", name)
                    return None
                if "portfolio" in name.lower():
                    logger.warning("ProjectGenerator: LLM name retry still contains 'portfolio': '%s'", name)
                    return None
                return name
        except Exception as e:
            logger.warning("ProjectGenerator: name generation failed: %s", e)
        return None

