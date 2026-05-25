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

        # Attach the JD job title onto the final tailored dict so downstream
        # renderers can populate PDF metadata (Subject) and the post-tailor
        # keyword audit can compare against the right role.
        target_role = (jd_analysis.get("job_title") or "").strip()

        def _finalize(t: Dict[str, Any]) -> Dict[str, Any]:
            t = self._restore_contact(t, structured_resume)
            if target_role:
                t["target_role"] = target_role
            return t

        prompt = self._build_tailor_prompt(
            keyword_list, gap_context, role_context, resume_payload, jd_json
        )

        # Pass schema so Claude routes through forced tool-use (guaranteed
        # JSON, no markdown fences, no preamble eating output budget). For
        # Gemini path the schema is also passed; _to_openapi_schema handles
        # _dict_of via additionalProperties best-effort.
        result = gemini_json(
            prompt=prompt,
            max_tokens=24000,
            temperature=0.4,
            model=GEMINI_PRO,
            schema=TAILORED_RESUME_SCHEMA,
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

        result = gemini_json(
            prompt=prompt,
            max_tokens=24000,
            temperature=0.4,
            model=GEMINI_PRO,
            schema=TAILORED_RESUME_SCHEMA,
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

        Methodology follows a 2-phase / 8-step approach:
          Phase A — Silent profile extraction (model reads resume into an
                    internal structured profile before tailoring; never
                    fabricates anything not evidenced there).
          Phase B — Tailoring methodology:
            1. Decode the JD (must-haves, nice-to-haves, vocabulary)
            2. Pick the target role family
            3. Rewrite the summary in the JD's vocabulary
            4. Reframe bullets without changing facts (interview-defensible)
            5. Project / portfolio selection (2-3 strongest, drop weak)
            6. Keyword coverage pass (verbatim JD phrasing)
            7. Skills consolidation (honest, evidenced)
            8. Final format + ATS adherence

        Output stays a single JSON object matching TAILORED_RESUME_SCHEMA so
        the frontend renderer doesn't change.
        """
        return (
            "You are a senior resume tailoring agent and ATS optimization specialist. Your job is to "
            "produce a complete, one-page-fillable, ATS-optimized tailored resume as JSON using ONLY "
            "real experience evidenced in the candidate's original resume. Never fabricate facts in "
            "experience, education, or certifications. Target ATS score: 95+ via keyword coverage,\n"
            "JD-verbatim phrasing where evidenced, action-verb diversity, and clean ATS-safe formatting.\n\n"

            "⚠️ ATS-FIRST POLICY — what's flexible vs what's locked\n"
            "The goal is to PASS the ATS. The HARD line is the company name —\n"
            "everything else has some flexibility scoped to ATS keyword matching:\n"
            "\n"
            "  HARD LOCKS (never change):\n"
            "  • Company NAMES — recruiters verify employment history\n"
            "  • Dates of employment + education — also verifiable\n"
            "  • Job titles — keep verbatim; no title inflation (Engineer ≠ Senior Engineer)\n"
            "  • Education degrees, institutions, GPA — verbatim copy\n"
            "  • Certifications array — verbatim copy from original\n"
            "  • Metrics and numbers — never invent new ones; reuse only what's in original bullets\n"
            "\n"
            "  ATS-FLEXIBLE (lean aggressive for keyword coverage):\n"
            "  • Skills section: include JD-required skills whenever the candidate's evidenced\n"
            "    skills are CLOSELY RELATED — same family / common pairings / standard stack.\n"
            "    Examples that are OK to add:\n"
            "      - Knows Docker → add 'Kubernetes', 'containerization', 'container orchestration'\n"
            "      - Knows AWS → add specific AWS services the JD asks for (Lambda, ECS, EKS, etc.)\n"
            "      - Knows Python → add 'FastAPI', 'Flask', 'Django' if any one is evidenced\n"
            "      - Knows Postgres → add 'relational databases', 'SQL'\n"
            "      - Knows CI/CD → add 'GitHub Actions', 'Jenkins', 'AWS CodePipeline' if any one used\n"
            "    Cap: only add skills the candidate could plausibly speak to in a 30-min interview.\n"
            "  • Bullet phrasing: rewrite bullets using the JD's verbatim vocabulary wherever the\n"
            "    original bullet has supporting context. Don't add new technologies into bullets\n"
            "    that the candidate didn't actually use — but DO mirror JD phrasing for things\n"
            "    they did use.\n"
            "  • Summary: heavily JD-aligned. Use the JD's vocabulary for what the candidate\n"
            "    genuinely positions for.\n"
            "  • Projects: leave mostly EMPTY or include only original projects. The BACKEND\n"
            "    pipeline generates additional creative aligned projects AFTER tailoring — those\n"
            "    are portfolio-style projects the candidate could plausibly build. Don't pre-fill\n"
            "    that slot here.\n\n"

            "⚠️ BANNED WORDS — FORBIDDEN in the summary AND every other field. If you use ANY of "
            "them you have failed the task and must rewrite. Verify the summary against this list "
            "before returning:\n"
            "  Versatile, Proficient, Leverages, Leverage, extensive experience, proven track record,\n"
            "  results-driven, passionate, detail-oriented, highly skilled, seasoned, cutting-edge,\n"
            "  innovative, dynamic, self-motivated, Adept, dedicated, committed to excellence,\n"
            "  STRONG FOUNDATION, STRONG RECORD, strong background, strong record of, robust experience,\n"
            "  seeking a challenging, hands-on expertise (use 'hands-on experience' or be specific).\n"
            "Also FORBIDDEN as a summary opening: starting with the JD's job title verbatim "
            "(e.g. 'ADAS ECU Software Developer / DevOps Engineer candidate with...' — BAD). "
            "Lead with what the candidate IS, not with the role's label.\n"
            "Write like a real engineer describing their work — direct, specific, no buzzwords.\n\n"

            "⚠️ SUMMARY LENGTH — exactly 3-4 sentences. NOT 5, NOT 6.\n"
            "OPENING: describe the candidate naturally and reference the target role family LATER\n"
            "in the same sentence. The first 6 words must NOT be the JD's job title verbatim.\n"
            "  GOOD: 'Cloud and DevOps engineer with 4+ years building CI/CD pipelines on AWS, "
            "        ready to apply that to ECU software workflows.'\n"
            "  BAD:  'ADAS ECU Software Developer / DevOps Engineer candidate with...'\n"
            "  BAD:  'I am a DevOps engineer...'\n"
            "  BAD:  'Versatile/Dedicated/Passionate ... engineer...'\n\n"

            "⚠️ YEARS-OF-EXPERIENCE RULE — DO NOT INFLATE\n"
            "Compute the candidate's TOTAL years of professional experience by summing the\n"
            "dates of all experience entries from the original resume (treat overlaps once;\n"
            "ignore unpaid academic projects). Then:\n"
            "  • If the JD requires N+ years AND the candidate's total >= N → you MAY write\n"
            "    a specific years claim like 'N+ years' or the candidate's actual count.\n"
            "    e.g. JD asks '4+ years' and candidate has 4+ → 'Backend engineer with 4+ years…' OK\n"
            "  • If the JD requires N+ years AND the candidate has FEWER → DO NOT mention\n"
            "    any years number in the summary. Write a GENERIC seniority-neutral opener\n"
            "    instead. NEVER inflate: if candidate has 3 years and JD wants 4+, do NOT write\n"
            "    '4+ years' or even '3+ years' framed to imply seniority.\n"
            "    e.g. JD asks '5+ years' but candidate has 3 →\n"
            "        BAD: 'Backend engineer with 5+ years...'  (inflated)\n"
            "        BAD: 'Backend engineer with 3+ years...'  (still highlights the gap)\n"
            "        GOOD: 'Backend engineer focused on Python services on AWS, with hands-on\n"
            "               experience building CI/CD pipelines and containerized microservices.'\n"
            "  • If the JD does NOT mention years at all → either approach is fine; lean on\n"
            "    the candidate's actual count if it's positive signal, otherwise stay generic.\n\n"

            "═══ PHASE A — SILENT PROFILE EXTRACTION ═══\n"
            "Before tailoring, mentally extract the candidate's structured profile from the original "
            "resume JSON below. Do not output this profile — use it as your internal source of truth:\n"
            "  • Identity: name, location, phone, email, links\n"
            "  • Education: degrees, institutions, dates, GPA, coursework\n"
            "  • Work history: per role — company, title (EXACT, immutable), dates, bullets,\n"
            "    technologies named, quantified outcomes (numbers/percentages)\n"
            "  • Projects: per project — name, tech stack, outcomes\n"
            "  • Skills inventory — classify each skill by evidence level:\n"
            "      STRONG   = appears in 2+ work/project bullets with context\n"
            "      MODERATE = appears in 1 bullet, or in skills section with related project\n"
            "      WEAK     = listed in skills only, no work/project evidence\n"
            "  • Quantified impact: every number/percentage in the resume — these are REUSABLE "
            "    assets, never invent new ones\n"
            "  • Career arc: what role family the candidate currently positions for\n\n"

            "═══ PHASE B — TAILORING METHODOLOGY ═══\n\n"

            "STEP 1 — Decode the JD\n"
            "Internally separate the JD into:\n"
            "  • Must-haves: explicit required qualifications, years, hard skills, languages, frameworks\n"
            "  • Nice-to-haves: 'preferred', 'bonus', 'ideally', 'plus' sections\n"
            "  • Domain signals: business problem, industry, customer type, tech-stack maturity\n"
            "  • JD vocabulary: distinctive verbatim phrases an ATS will scan for (e.g. 'microservices', "
            "'idempotency', 'stakeholder management', 'transactional outbox'). Mirror these EXACTLY where "
            "the candidate's experience supports it — verbatim phrasing beats paraphrase for ATS.\n\n"

            "STEP 2 — Pick the target role family\n"
            "Based on the JD and the candidate's career arc, internally pick the single best-fit role "
            "family for this application (backend, DevOps, data engineering, ADAS software, product, "
            "marketing, etc.). Lean the summary + bullet ordering + skills priority toward this family. "
            "If the JD spans two families, pick the dominant one (whichever the JD spends more words on) "
            "and lean lightly toward the secondary in skills only.\n\n"

            "STEP 3 — Rewrite the summary\n"
            "3-4 confident, plain sentences. See the SUMMARY rules at the top of this prompt for how\n"
            "to open. Naturally incorporate the JD's vocabulary where evidence exists. Reference\n"
            "the candidate's strongest evidenced strengths matching the JD's must-haves. NO buzzword\n"
            "stuffing. NO opening with the JD's job title verbatim. Read like a sentence a recruiter\n"
            "would write about a strong candidate.\n\n"

            "STEP 4 — Reframe bullets without changing facts\n"
            "For EACH work-history role and EACH project:\n"
            "  • Keep titles, dates, companies EXACTLY as written (no inflation: 'Engineer' stays "
            "    'Engineer', never 'Senior Engineer')\n"
            "  • Reorder bullets so the first 1-2 hit the target role family's primary keywords\n"
            "  • Rewrite each bullet as: ACTION VERB + technology/method actually used + measurable\n"
            "    outcome (only if the original had one — don't invent metrics)\n"
            "  • Preserve all quantified outcomes from Phase A — these are real, don't drop them\n"
            "  • Drop or de-emphasize bullets that pull attention away from the target role family\n"
            "  • Compress two related bullets into one if it saves space and keeps both points\n"
            "  • DEFENSIBILITY CHECK — for each bullet, internally ask: 'Is this claim defensible in\n"
            "    a 30-minute behavioral interview where the interviewer drills in?' If not, soften.\n\n"

            "STEP 5 — Project selection\n"
            "Include ONLY projects from the ORIGINAL resume — do NOT invent new ones, even if the\n"
            "JD would benefit. Reorder so the projects most relevant to the JD's role family appear\n"
            "first; mildly de-emphasize ones that don't reinforce the role. If the original resume\n"
            "has 0 projects, return an empty projects array []. The backend pipeline generates\n"
            "additional aligned projects AFTER tailoring — do not pre-fill that slot here.\n\n"

            "STEP 6 — Keyword coverage pass\n"
            "Take the JD's distinctive verbatim phrases (from Step 1). For each:\n"
            "  • Already present truthfully in the resume → keep as-is\n"
            "  • Can be honestly woven into an existing bullet → weave it in\n"
            "  • Can be honestly added to skills (with real evidence) → add it\n"
            "  • Cannot be added without fabrication → leave it out\n"
            "Verbatim phrasing matters: 'code reviews' beats 'reviewed code'; 'stakeholder management' "
            "beats 'managed stakeholders'.\n\n"

            "STEP 7 — Skills consolidation\n"
            "Build the skills section by:\n"
            "  • Putting JD-required skills FIRST in each category (where evidenced)\n"
            "  • Including ALL evidenced skills from the original resume\n"
            "  • Grouping into 4-6 honest categories aligned with the target role family\n"
            "  • Adding small, closely-related skills only when the parent skill is evidenced "
            "    (e.g. 'Docker' → 'containerization' OK; 'Python' → 'Kubernetes' NOT OK)\n\n"

            "STEP 8 — Final assembly + ATS adherence\n"
            "Generate the JSON. Follow all FORMAT and INTEGRITY rules below.\n\n"

            "NATURALLY INCORPORATE THESE JD KEYWORDS/SKILLS where the candidate has genuinely related "
            f"experience: {keyword_list}\n\n"
            f"{gap_context}"
            f"{role_context}"

            "═══ IMMUTABLE FIELDS — copy EXACTLY from the original JSON ═══\n"
            "- contact.name, contact.email, contact.phone, contact.linkedin, contact.github\n"
            "- Each experience entry's: company, title, location, dates\n"
            "- Each education entry's: institution, degree, location, dates, gpa\n"
            "Do NOT alter these even to fix typos or formatting.\n\n"

            "═══ ATS OPTIMIZATION RULES ═══\n"
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
            "═══ INTEGRITY HARD RULES (non-negotiable) ═══\n"
            "1. NO FABRICATION. Every skill, technology, role, project, and metric must trace back\n"
            "   to the original resume. If a JD requirement isn't honestly satisfiable, leave it out.\n"
            "2. NO TITLE INFLATION. Keep titles EXACTLY as written. No 'Engineer' → 'Senior Engineer',\n"
            "   no 'Analyst' → 'Manager', no 'Intern' → 'Associate'.\n"
            "3. NO FAKE METRICS. Use only numbers/percentages already in the original bullets. If a\n"
            "   bullet has no metric, leave it without one rather than guessing.\n"
            "4. NO FAKE PROJECTS OR COMPANIES. Include only experience entries and projects that\n"
            "   appear in the original resume.\n"
            "5. SKILLS section is ATS-FLEXIBLE — include JD-required skills whenever evidenced\n"
            "   skills are CLOSELY related (same family, common stack, standard pairing). See the\n"
            "   ATS-FIRST POLICY block above for examples. BULLET content must still describe\n"
            "   technologies the candidate actually used — don't claim Kubernetes in a bullet\n"
            "   when they only knew Docker, even if 'Kubernetes' got added to the skills section.\n"
            "6. NO FAKE CERTIFICATIONS, DEGREES, OR CREDENTIALS. Ever.\n"
            "7. NO DROPPING OR ADDING EXPERIENCE ENTRIES. Output MUST contain exactly the same\n"
            "   number of experience entries as the input — no more, no less.\n"
            "8. CERTIFICATIONS array: COPY EXACTLY from the ORIGINAL — do NOT add, remove, modify,\n"
            "   or reorder. The system enforces this post-AI.\n"
            "9. Every field in the JSON MUST be a non-null string or array — never null.\n"
            "10. Projects: Include ONLY projects from the original resume. Do NOT invent new ones.\n"
            "    Reorder for JD relevance. If the original has 0 projects, return []. The backend\n"
            "    pipeline generates aligned new projects AFTER tailoring — leave that slot open.\n\n"
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
            "⚠️ CRITICAL FIELD TYPES — read carefully before producing output:\n"
            "  • `summary`: a PLAIN STRING (text only). NOT a JSON object. NOT wrapped in braces.\n"
            "      ❌ BAD:  \"summary\": \"{\\\"summary\\\": \\\"Software Engineer with...\\\"}\"\n"
            "      ✅ GOOD: \"summary\": \"Software Engineer with 4+ years building backend systems...\"\n"
            "  • `skills`: an object keyed by category, each value a string ARRAY.\n"
            "      ❌ BAD:  \"skills\": \"Python, AWS, Docker\"  (string instead of object)\n"
            "      ✅ GOOD: \"skills\": {\"Languages\": [\"Python\"], \"Cloud\": [\"AWS\"]}\n"
            "  • `experience[].bullets`: an array of STRINGS (each bullet a plain sentence).\n"
            "  • `certifications`: an array of STRINGS, copied verbatim from the original.\n\n"

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
