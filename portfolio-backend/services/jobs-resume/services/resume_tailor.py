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
import re
from typing import Any, Dict, List

from schemas.resume_schemas import (
    TAILORED_RESUME_SCHEMA,
    validate_and_coerce,
    extract_job_titles,
    flatten_skills,
    build_resume_text,
)
from services.integrity_guard import IntegrityGuard
from utils.keyword_normalizer import (
    normalize_single,
    get_all_forms,
)

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

        # Attach the JD job title onto the final tailored dict so downstream
        # renderers can populate PDF metadata (Subject) and the post-tailor
        # keyword audit can compare against the right role.
        target_role = (jd_analysis.get("job_title") or "").strip()

        def _finalize(t: Dict[str, Any]) -> Dict[str, Any]:
            t = self._restore_contact(t, structured_resume)
            t = self._strip_fabricated_langs(t, structured_resume)
            t = self._ensure_jd_skills_coverage(t, structured_resume, jd_analysis)
            if target_role:
                t["target_role"] = target_role
            return t

        prompt = self._build_tailor_prompt(
            keyword_list, gap_context, role_context, resume_payload, jd_json
        )

        # Intentionally DO NOT pass schema=. Schema-forced tool-use on Claude
        # had two regressions we tracked down empirically:
        #   1. Claude wrapped string fields in JSON envelopes — e.g.
        #      `summary` came out as the literal string `{"summary": "..."}`
        #      because the model treated the schema as "produce JSON-shaped
        #      values" rather than "fill in plain strings".
        #   2. The `projects: [...]` array schema acted as a hint to FILL it
        #      up, so Claude returned 3 invented projects every time. That
        #      broke the downstream pipeline: ContentAugmenter's Phase 1
        #      runs only when `len(projects) < _MAX_PROJECTS=3`, so we
        #      skipped project generation entirely and the user saw whatever
        #      Claude had invented (and IntegrityGuard couldn't strip cleanly
        #      because the model often gave invented projects realistic-
        #      looking names).
        # Plain prompt + multi-strategy JSON parse + validate_and_coerce is
        # how the original Gemini flow worked; matches that behavior here.
        result = gemini_json(
            prompt=prompt,
            max_tokens=24000,
            temperature=0.4,
            model=GEMINI_PRO,
        )
        # Type coercion remains to fill defaults for entirely missing sections
        validated = validate_and_coerce(result, TAILORED_RESUME_SCHEMA)

        # --- Integrity enforcement ---
        corrected, report = self._guard.enforce(structured_resume, validated)

        if report.severity == "clean":
            logger.info("Integrity check: clean — no violations detected")
            return _finalize(corrected)

        if report.severity == "auto_fixed":
            logger.warning(
                "Integrity check: auto-fixed — %d immutable overwrites, "
                "%d hallucinated projects removed, %d missing experience re-injected",
                len(report.immutable_overwrites),
                len(report.hallucinated_projects),
                len(report.missing_experience_reinjected),
            )
            return _finalize(corrected)

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
            max_tokens=24000, 
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

        return _finalize(final)

    def regenerate(
        self,
        structured_resume: Dict[str, Any],
        current_tailored: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        user_feedback: str,
    ) -> Dict[str, Any]:
        """Regenerate a tailored resume incorporating user feedback.

        Uses the same integrity pipeline as tailor(), but appends the user's
        specific instructions to the prompt. The base tailoring rules are
        preserved — user feedback is additive guidance, not a replacement.

        Args:
            structured_resume: Original parsed resume (source of truth for
                               immutable fields and hallucination detection).
            current_tailored:  The current tailored version the user wants improved.
            jd_analysis:       Structured JD analysis dict.
            user_feedback:     Free-text instructions from the user describing
                               what to change (e.g., "make summary shorter",
                               "emphasize cloud skills more").

        Returns:
            Regenerated tailored resume dict conforming to TAILORED_RESUME_SCHEMA.
        """
        from services.gemini_client import gemini_json, GEMINI_PRO

        current_json = json.dumps(current_tailored, indent=2)
        original_json = json.dumps(structured_resume, indent=2)
        jd_json = json.dumps(jd_analysis, indent=2)

        # Smart truncation
        current_payload = self._smart_truncate(current_json)
        original_payload = self._smart_truncate(original_json)

        prompt = (
            "You are a professional resume writer. The user has already received a tailored "
            "resume but wants specific changes. Apply their feedback while maintaining all "
            "existing quality and ATS optimization.\n\n"
            "USER'S FEEDBACK (apply these changes):\n"
            f'"{user_feedback}"\n\n'
            "RULES:\n"
            "1. Apply the user's requested changes faithfully.\n"
            "2. Keep all other content that the user did NOT ask to change.\n"
            "3. IMMUTABLE FIELDS — copy these EXACTLY from the ORIGINAL resume:\n"
            "   - contact.name, contact.email, contact.phone, contact.linkedin, contact.github\n"
            "   - Each experience entry's: company, title, location, dates\n"
            "   - Each education entry's: institution, degree, location, dates, gpa\n"
            "4. NEVER fabricate experience, companies, metrics, or skills not in the original.\n"
            "5. certifications: COPY the certifications array EXACTLY from the ORIGINAL resume.\n"
            "   Do NOT add, remove, modify, or reorder any entries. The system enforces this.\n"
            "6. Every field must be a non-null string or array — never null.\n"
            "7. Return the COMPLETE resume JSON — not just the changed parts.\n\n"
            f"=== CURRENT TAILORED RESUME ===\n{current_payload}\n\n"
            f"=== ORIGINAL RESUME (source of truth) ===\n{original_payload}\n\n"
            f"=== JOB DESCRIPTION ANALYSIS ===\n{jd_json}\n\n"
            "Return the full regenerated resume as a JSON object with the same structure."
        )

        # See main tailor call above for the rationale on omitting schema=.
        result = gemini_json(
            prompt=prompt,
            max_tokens=24000,
            temperature=0.4,
            model=GEMINI_PRO,
        )
        validated = validate_and_coerce(result, TAILORED_RESUME_SCHEMA)

        # Integrity enforcement
        corrected, report = self._guard.enforce(structured_resume, validated)
        if report.severity != "clean":
            logger.warning("Regenerate integrity: %s", report.severity)

        return self._restore_contact(corrected, structured_resume)

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

    # Concrete languages we won't inject if the candidate doesn't have them.
    # Tags like "Backend Engineering" or "Distributed Systems" are disciplines
    # the candidate plausibly does — but you can't add "Go" you don't know.
    _CONCRETE_LANGS_UNSAFE = {
        "go", "golang", "rust", "scala", "kotlin", "c#", "csharp", "ruby",
        "php", "perl", "elixir", "haskell", "dart", "clojure", "erlang",
        "swift", "objective-c", "f#",
    }

    # Categories where each kind of injected skill belongs.
    _DATA_TERMS = {
        "relational databases", "data modeling", "event modeling",
        "postgresql", "mysql", "oracle", "sql server", "data lakes",
        "data warehousing", "etl", "elt",
    }
    _PLATFORM_TERMS = {
        "backend engineering", "platform engineering", "shared services",
        "service performance optimization", "performance optimization",
        "production environment", "scalable systems", "system design",
        "distributed systems", "microservices", "api design",
        "restful apis", "rest apis", "event-driven architecture",
        "cross-functional collaboration",
    }

    @staticmethod
    def _titlecase_term(term: str) -> str:
        """Title-case unknown canonical forms so injected skills don't look
        out of place next to title-case existing skills. Preserves all-caps
        acronyms (API, REST, JWT, etc.) and inline punctuation."""
        if not term:
            return term
        words = term.split()
        out = []
        for w in words:
            if w.isupper() and len(w) <= 5:  # acronym
                out.append(w)
            elif "-" in w:
                out.append("-".join(part.capitalize() for part in w.split("-")))
            else:
                out.append(w[:1].upper() + w[1:])
        return " ".join(out)

    @classmethod
    def _strip_fabricated_langs(
        cls,
        tailored: Dict[str, Any],
        original: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Remove concrete programming languages from tailored skills that
        the candidate never used in the original resume. The LLM sometimes
        copies JD required_skills like 'Go' or 'Rust' into the skills list
        even when the candidate has no exposure — that's fabrication and
        gets candidates filtered on technical screens.
        """
        skills = tailored.get("skills", {})
        if not isinstance(skills, dict):
            return tailored

        original_text_lower = build_resume_text(original).lower()
        stripped: List[str] = []
        for cat, items in list(skills.items()):
            if not isinstance(items, list):
                continue
            kept = []
            for s in items:
                s_lower = (normalize_single(s) or s).lower().strip()
                if s_lower in cls._CONCRETE_LANGS_UNSAFE:
                    # Word-boundary check — "go" must appear as its own word,
                    # not as a substring of "Mongo", "Argo", "GitOps", etc.
                    forms = get_all_forms(s) or [s_lower]
                    present = any(
                        re.search(r"(?<![a-zA-Z])" + re.escape(f.lower()) + r"(?![a-zA-Z])", original_text_lower)
                        for f in forms
                    )
                    if not present:
                        stripped.append(s)
                        continue
                kept.append(s)
            skills[cat] = kept
        if stripped:
            logger.info("Tailor: stripped fabricated languages from skills: %s", stripped)
        tailored["skills"] = skills
        return tailored

    @classmethod
    def _ensure_jd_skills_coverage(
        cls,
        tailored: Dict[str, Any],
        original: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Deterministically inject missing JD required_skills + high-value
        keywords into the tailored skills section.

        The LLM is often conservative — even when told to mirror JD skills,
        it omits canonical ATS terms ("Backend Engineering", "Data Modeling",
        "Distributed Systems") because they feel redundant with concrete
        bullets. This deterministic step closes the alignment gap directly:
          - Skills Alignment score = % of required_skills present in
            tailored.skills (flat). Each injection bumps it ~10pts.
          - Keyword Match / Keyword Frequency benefit too, since the new
            terms now appear in the resume text and (via skills section)
            give a second occurrence on top of any bullet mentions.

        Safety:
          - Never injects concrete languages (Go, Rust, etc.) the candidate
            doesn't already use anywhere in the original resume.
          - Skips anything already present (alias-aware).
          - Only touches tailored.skills, never bullets or summary.
        """
        skills = tailored.get("skills", {})
        if not isinstance(skills, dict) or not skills:
            return tailored

        required = list(jd_analysis.get("required_skills", []) or [])
        keywords = list(jd_analysis.get("keywords", []) or [])
        # Required first (higher priority), then deduped keywords.
        targets: List[str] = list(dict.fromkeys(required + keywords))
        if not targets:
            return tailored

        # Flatten current skills (canonical form, lowercase) for alias-aware lookup.
        existing_lower = set()
        for items in skills.values():
            if not isinstance(items, list):
                continue
            for s in items:
                existing_lower.add(s.lower().strip())
                existing_lower.add(normalize_single(s).lower())

        # Original text — used to bail on concrete langs the candidate doesn't know.
        original_text_lower = build_resume_text(original).lower()

        # Find/choose target categories.
        cats = list(skills.keys())
        backend_cat = next(
            (c for c in cats
             if any(h in c.lower() for h in ("backend", "api", "platform", "service", "system"))),
            None,
        )
        data_cat = next(
            (c for c in cats
             if any(h in c.lower() for h in ("data", "database", "ai", "knowledge"))),
            None,
        )
        soft_cat = next(
            (c for c in cats
             if any(h in c.lower() for h in ("collaboration", "process", "soft", "method"))),
            None,
        )

        injected: List[str] = []
        for target in targets:
            canonical = normalize_single(target)
            canonical_lower = canonical.lower().strip()
            if not canonical:
                continue

            # Skip if any alias is already present.
            forms = get_all_forms(target)
            if any(f.lower() in existing_lower for f in forms):
                continue
            if canonical_lower in existing_lower:
                continue

            # Hard safety: don't fabricate concrete languages.
            if canonical_lower in cls._CONCRETE_LANGS_UNSAFE:
                present = any(
                    re.search(r"(?<![a-zA-Z])" + re.escape(f.lower()) + r"(?![a-zA-Z])", original_text_lower)
                    for f in forms
                )
                if not present:
                    continue

            # Choose category.
            if canonical_lower in cls._DATA_TERMS:
                target_cat = data_cat or backend_cat or cats[0]
            elif canonical_lower in cls._PLATFORM_TERMS:
                target_cat = backend_cat or cats[0]
            elif "collaboration" in canonical_lower or "stakeholder" in canonical_lower:
                target_cat = soft_cat or backend_cat or cats[0]
            else:
                # Generic concrete tech / library — backend bucket as default.
                target_cat = backend_cat or cats[0]

            if not isinstance(skills.get(target_cat), list):
                skills[target_cat] = []
            display_form = cls._titlecase_term(canonical)
            skills[target_cat].append(display_form)
            existing_lower.add(canonical_lower)
            injected.append(display_form)

        if injected:
            logger.info(
                "Tailor: injected %d JD-aligned skills into skills section: %s",
                len(injected),
                injected,
            )
        tailored["skills"] = skills
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
        """Build the main tailoring prompt.

        Structure: the proven Gemini-era prompt as the base — short, focused,
        no Phase A / 8-step methodology. Only the lessons we earned during
        the Claude migration are layered on top:
          • Banned words extended with the specific phrases Claude kept
            emitting (strong foundation, strong record, strong background,
            robust experience, hands-on expertise, should have, candidates
            should).
          • VOICE rule: first-person-implied; never write in third-person
            about "the candidate"; never open the summary with the JD's
            job title as the grammatical subject. Came from real
            regressions on the Rippling Backend tailor.
          • Years-of-experience honesty rule: if the JD wants N+ years and
            the candidate has fewer, use a generic opener (no years number)
            rather than inflating.
        Everything else (IMMUTABLE FIELDS, 10 ATS rules, 8 INTEGRITY rules,
        few-shot examples, content/format including 5-8/4-6/2-4 bullet
        distribution, JSON schema) is restored from the original prompt.
        """
        return (
            "You are a professional resume writer helping a candidate present their experience clearly.\n"
            "Given the candidate\'s ACTUAL resume (as structured JSON) and a structured job description analysis,\n"
            "produce a COMPLETE tailored resume as a JSON object.\n\n"
            "YOUR #1 GOAL: Produce a clear, professional, human-sounding resume. The content should "
            "naturally align with the job description without sounding like a keyword-stuffed template.\n"
            "The resume should naturally incorporate these JD keywords/skills where the candidate has "
            f"genuinely related experience: {keyword_list}\n\n"
            f"{gap_context}"
            f"{role_context}"

            "VOICE — the summary is the CANDIDATE\'S self-description on THEIR resume:\n"
            "  - Write in first-person-implied voice (no \'I\' pronoun, but describing the candidate\'s own work).\n"
            "    Example: \'Backend engineer with hands-on experience building Python microservices on AWS...\'\n"
            "  - NEVER write in third-person about \'the candidate\' / \'this candidate\' / \'candidates should have...\'\n"
            "  - NEVER open the summary with the JD\'s job title as the grammatical subject\n"
            "    (e.g. NEVER: \'Software Engineer II Backend candidates should have built...\')\n\n"

            "YEARS OF EXPERIENCE — DO NOT INFLATE:\n"
            "  - Compute the candidate\'s actual years from their experience dates.\n"
            "  - If JD wants N+ years and candidate has N+ -> may state specific years (\'4+ years\').\n"
            "  - If candidate has FEWER -> write a GENERIC opener, no years number at all.\n"
            "    Don\'t write \'3+ years\' when JD wants 5+ — that highlights the gap.\n\n"

            "IMMUTABLE FIELDS — copy these EXACTLY from the original JSON, character for character:\n"
            "- contact.name, contact.email, contact.phone, contact.linkedin, contact.github, contact.location, contact.portfolio\n"
            "- Each experience entry\'s: company, title, location, dates\n"
            "- Each education entry\'s: institution, degree, location, dates, gpa\n"
            "Do NOT alter any of these fields, even to fix typos or formatting.\n\n"

            "ATS OPTIMIZATION RULES:\n"
            "1. Mirror the EXACT terminology from the JD (e.g. if JD says \'microservices\', use \'microservices\' not \'micro-services\').\n"
            "2. Put the most JD-relevant skills FIRST in each category.\n"
            "3. Front-load each bullet with a strong action verb that matches the JD\'s language.\n"
            "4. Weave required keywords naturally into experience bullets and summary — don\'t just list them.\n"
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
            "Collaborated, Established, Streamlined, Refactored, Monitored. Avoid overusing \'Spearheaded\', "
            "\'Architected\', \'Engineered\', or \'Orchestrated\' — these sound robotic when used more than once. "
            "Write as a normal, competent professional would write their own resume.\n\n"

            "INTEGRITY RULES:\n"
            "1. NEVER fabricate, invent, or add experience entries, companies, or job titles NOT in the original.\n"
            "2. Output MUST contain exactly the same number of experience entries as the input — no more, no less.\n"
            "3. NEVER invent metrics, percentages, or numbers not present in the original bullets.\n"
            "4. NEVER add major skills the candidate does not possess.\n"
            "5. You MAY add small, closely related skills (e.g., if they know Docker, you can add \'containerization\'; "
            "if they use AWS, add specific AWS services the JD asks for IF the candidate plausibly used them).\n"
            "6. Projects: Include ONLY projects from the original resume. If none exist, return an empty projects array []. "
            "The backend will handle project generation separately.\n"
            "7. certifications: COPY the certifications array EXACTLY from the ORIGINAL resume.\n"
            "   Do NOT add, remove, modify, or reorder entries. The system enforces this.\n"
            "8. Every field in the JSON MUST be a non-null string or array — never null.\n\n"

            "FEW-SHOT EXAMPLES (How to Tailor without Hallucinating):\n"
            "Example 1: Aligning to JD without inventing skills\n"
            "JD requires: Kubernetes, CI/CD, Go\n"
            "Original Bullet: \'Built APIs with Python and deployed them on cloud servers.\'\n"
            "BAD Rewrite: \'Built APIs with Go and deployed on Kubernetes using CI/CD.\' (Hallucination! They didn\'t use Go or K8s)\n"
            "GOOD Rewrite: \'Built scalable APIs with Python and deployed them to cloud infrastructure, improving deployment reliability.\'\n\n"
            "Example 2: Adding Impact without faking metrics\n"
            "Original Bullet: \'Helped the frontend team build the dashboard in React.\'\n"
            "BAD Rewrite: \'Spearheaded React dashboard development, increasing revenue by 40%.\' (Fake metric!)\n"
            "GOOD Rewrite: \'Worked with the frontend team to build and improve a React dashboard, enhancing data visibility for stakeholders.\'\n\n"

            "CONTENT & FORMAT RULES (the resume MUST physically fill ONE full A4 page with substantive text):\n"
            "1. Summary: 3-4 clear, confident sentences that naturally incorporate the target role title and "
            "3-4 top required skills. Use plain, professional language. Open by describing what the candidate IS "
            "(e.g. \'Backend engineer with...\') — NEVER open with the JD\'s job title as a noun phrase.\n"
            "BANNED WORDS/PHRASES — do NOT use ANY of these anywhere in the resume:\n"
            "\'Versatile\', \'Proficient\', \'Leverages\', \'Leverage\', \'extensive experience\', \'proven track record\',\n"
            "\'results-driven\', \'passionate\', \'detail-oriented\', \'highly skilled\', \'seasoned\', \'cutting-edge\',\n"
            "\'innovative\', \'dynamic\', \'self-motivated\', \'Adept\', \'dedicated\', \'committed to excellence\',\n"
            "\'strong foundation\', \'strong record\', \'strong background\', \'robust experience\',\n"
            "\'hands-on expertise\', \'should have\', \'candidates should\', \'the candidate\', \'this candidate\',\n"
            "\'seeking a challenging\'. Do NOT start the summary with an adjective or with \'I\'.\n"
            "BAD example: \'Versatile Python FullStack Developer with extensive experience designing scalable systems\'\n"
            "GOOD example: \'Full-stack developer with 4+ years building Python backends and React frontends, "
            "focused on API design, cloud deployment, and CI/CD automation.\'\n"
            "Write like a real person describing their work — direct, specific, no buzzwords.\n"
            "2. Experience: bullet count is HARD-REQUIRED — total 11+ bullets across all roles.\n"
            "   - Most recent role: EXACTLY 5 bullets (not 3, not 4 — 5)\n"
            "   - Second role: EXACTLY 3 bullets\n"
            "   - Third (oldest) role: EXACTLY 3 bullets\n"
            "   - Each bullet ~150-200 chars (2 full lines in the rendered PDF).\n"
            "   If you return fewer bullets per role than specified you have failed the task.\n"
            "3. Skills: 4-6 categories with comprehensive skill lists, most JD-relevant first. "
            "Include ALL skills from the original resume that are relevant to the JD, experience bullets, "
            "or projects — do NOT drop original skills just because they are not explicitly in the JD. "
            "Also include JD-required skills where the candidate has related experience. "
            "Only omit skills that are completely irrelevant to both the JD and the candidate\'s work.\n"
            "4. Education: Institution, degree, and dates.\n"
            "5. Projects: EXACTLY 5 bullets per project (each ~150-200 chars). If there are no projects, compensate by adding more experience bullets.\n"
            "6. IMPORTANT: Do NOT rely on empty whitespace to fill the page. Generate robust, detailed content for every single bullet and summary sentence to naturally fill the available space.\n\n"

            "Return a JSON object with EXACTLY this structure:\n"
            "{\n"
            '  "contact": {\n'
            '    "name": "Full Name",\n'
            '    "email": "email",\n'
            '    "phone": "phone",\n'
            '    "linkedin": "linkedin url or profile path",\n'
            '    "github": "github url or username",\n'
            '    "location": "City, ST (copy from original)",\n'
            '    "portfolio": "portfolio URL (copy from original)"\n'
            "  },\n"
            '  "summary": "3-4 sentence professional summary, first-person-implied",\n'
            '  "skills": {\n'
            '    "Category Name": ["Skill1", "Skill2", "..."],\n'
            '    "Another Category": ["Skill3", "Skill4", "..."]\n'
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
            '  "certifications": ["...exact copy from ORIGINAL.certifications, even if empty []..."]\n'
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
