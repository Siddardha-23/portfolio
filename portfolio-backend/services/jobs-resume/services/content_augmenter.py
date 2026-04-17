"""
Content Augmenter — fills sparse resumes to ~90% page fill with projects, bullets, and impact.

Pipeline integration: runs AFTER tailor + integrity guard, BEFORE date normalization and complete_job.
Subsumes the old single-project injection logic.

Phases:
  0: Measure fill → early exit if >= 90% (except project generation, which always runs if < 3)
  1: Generate projects (batch: up to 3 total in ONE Gemini call)
  2: Expand experience bullets + baked-in impact metrics
  3: Impact injection on existing no-metric bullets
  4: Overflow protection (trim if > 95%)
  5: ATS hardening (keyword density + summary alignment in PARALLEL, then weak verbs)
  6: Final overflow check after hardening
"""
import copy
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Import METRIC_PATTERN from impact_engine for consistent metric detection
from services.impact_engine import METRIC_PATTERN, WEAK_VERB_PHRASES

# Target fill thresholds
_TARGET_FILL = 0.90
_OVERFLOW_SOFT = 0.95
_MAX_PROJECTS = 3
_MAX_TOTAL_EXP_BULLETS = 20

# Per-role bullet caps by recency (index 0 = most recent)
_ROLE_BULLET_CAPS = [8, 6, 4, 4, 3]  # roles beyond index 4 get cap of 3


class ContentAugmenter:
    """Fills sparse resumes to ~80% page fill with projects, expanded bullets, and impact."""

    def __init__(self, renderer, project_generator):
        self.renderer = renderer
        self.project_generator = project_generator

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def augment(
        self,
        tailored: Dict[str, Any],
        original: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Run all augmentation phases on a tailored resume.

        Args:
            tailored: The tailored resume dict (modified in-place).
            original: The original parsed resume (for grounding).
            jd_analysis: JD analysis dict with required_skills, keywords, etc.

        Returns:
            The augmented tailored resume dict.
        """
        pipeline_start = time.time()

        # Edge case: empty skills → likely parsing issue, skip augmentation
        skills = tailored.get("skills", {})
        if not skills or (isinstance(skills, dict) and not any(skills.values())):
            logger.warning("ContentAugmenter: empty skills section — skipping augmentation")
            return tailored

        # Phase 0: Measure current fill
        fill = self._measure_fill(tailored)
        logger.info("ContentAugmenter Phase 0: initial fill = %.1f%%", fill * 100)

        # Phase 1: ALWAYS try project generation if under cap, regardless of fill.
        # Uses batch generation (single Gemini call for all needed projects).
        projects = tailored.get("projects", [])
        if len(projects) < _MAX_PROJECTS:
            t0 = time.time()
            tailored = self._augment_projects(tailored, original, jd_analysis)
            fill = self._measure_fill(tailored)
            logger.info("ContentAugmenter Phase 1 (projects): fill = %.1f%% [%.1fs]",
                        fill * 100, time.time() - t0)

        # Early exit for remaining phases (bullet expansion, impact) if fill is good
        if fill >= _TARGET_FILL:
            logger.info("ContentAugmenter: fill >= 90%% after project gen — skipping bullet expansion")
            # Still trim overflow if page is already too full
            if fill > _OVERFLOW_SOFT:
                tailored = self._overflow_trim(tailored, fill)
            t0 = time.time()
            tailored = self._ats_harden(tailored, jd_analysis)
            logger.info("ContentAugmenter Phase 5 (ATS harden): [%.1fs]", time.time() - t0)
            logger.info("ContentAugmenter: total pipeline time = %.1fs", time.time() - pipeline_start)
            return tailored

        # Phase 2: Expand experience bullets (FLASH model for speed)
        experience = tailored.get("experience", [])
        if experience:
            t0 = time.time()
            tailored = self._expand_bullets(tailored, original, jd_analysis, fill)
            fill = self._measure_fill(tailored)
            logger.info("ContentAugmenter Phase 2 (bullets): fill = %.1f%% [%.1fs]",
                        fill * 100, time.time() - t0)

        # Phase 3: Impact injection on existing no-metric bullets
        t0 = time.time()
        tailored = self._inject_impact(tailored, jd_analysis)
        fill = self._measure_fill(tailored)
        logger.info("ContentAugmenter Phase 3 (impact): fill = %.1f%% [%.1fs]",
                    fill * 100, time.time() - t0)

        # Phase 4: Overflow protection
        tailored = self._overflow_trim(tailored, fill)

        # Phase 5: ATS hardening (parallel where possible)
        t0 = time.time()
        tailored = self._ats_harden(tailored, jd_analysis)
        logger.info("ContentAugmenter Phase 5 (ATS harden): [%.1fs]", time.time() - t0)

        # Phase 6: Final overflow check after hardening
        fill = self._measure_fill(tailored)
        if fill > _OVERFLOW_SOFT:
            tailored = self._overflow_trim(tailored, fill)

        logger.info("ContentAugmenter: final fill = %.1f%%, total pipeline time = %.1fs",
                    fill * 100, time.time() - pipeline_start)
        return tailored

    # ------------------------------------------------------------------
    # Phase 0: Measurement
    # ------------------------------------------------------------------

    def _measure_fill(self, tailored: Dict[str, Any]) -> float:
        """Return page fill ratio 0.0-1.0 using the same font/line-height as generate_pdf().

        generate_pdf() always renders at body_size=10.0, lh=3.8, lh_s=3.6
        (it sets these before Pass 1 measurement regardless of overflow).
        We must match those values here so fill estimates match the actual PDF.
        """
        _, content_h = self.renderer._render_pdf(
            tailored,
            section_gap=self.renderer._MIN_SECTION_GAP,
            entry_gap=self.renderer._MIN_ENTRY_GAP,
            post_header=self.renderer._MIN_POST_HEADER,
            header_gap=self.renderer._MIN_HEADER_GAP,
            skill_gap=self.renderer._MIN_SKILL_GAP,
            body_size=10.0,  # matches generate_pdf() actual render size
            lh=3.8,          # matches generate_pdf() actual line height
            lh_s=3.6,        # matches generate_pdf() actual skill line height
            measure_only=True,
        )
        return content_h / self.renderer._AVAIL_H

    # ------------------------------------------------------------------
    # Phase 1: Project generation
    # ------------------------------------------------------------------

    def _augment_projects(
        self,
        tailored: Dict[str, Any],
        original: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Generate projects via batch call (single Gemini request for all needed projects)."""
        projects = tailored.get("projects", [])
        tailored.setdefault("projects", projects)

        needed = _MAX_PROJECTS - len(projects)
        if needed <= 0:
            return tailored

        # Check fill before generating — if already full, skip
        if self._measure_fill(tailored) >= _TARGET_FILL:
            logger.info("ContentAugmenter: fill >= 90%% — skipping project generation")
            return tailored

        # Batch generate all needed projects in ONE Gemini call
        generated = self.project_generator.generate_batch(
            count=needed,
            original_resume=original,
            jd_analysis=jd_analysis,
            existing_projects=projects,
        )

        for proj in generated:
            projects.append(proj)
            logger.info(
                "ContentAugmenter: injected project '%s' (%d total)",
                proj.get("name", "?"), len(projects),
            )
            # Stop if we've hit the fill target
            if self._measure_fill(tailored) >= _TARGET_FILL:
                logger.info("ContentAugmenter: fill >= 90%% — stopping project injection")
                break

        tailored["projects"] = projects
        return tailored

    @staticmethod
    def _is_duplicate_project(new_project: dict, existing: List[dict]) -> bool:
        """Check if a project is a duplicate by name similarity or tech overlap."""
        new_name = new_project.get("name", "").lower().strip()
        new_tech = set(t.strip().lower() for t in new_project.get("tech", "").split(",") if t.strip())

        for existing_proj in existing:
            ex_name = existing_proj.get("name", "").lower().strip()
            # Name containment check
            if new_name in ex_name or ex_name in new_name:
                return True
            # Tech overlap > 70%
            ex_tech = set(t.strip().lower() for t in existing_proj.get("tech", "").split(",") if t.strip())
            if new_tech and ex_tech:
                overlap = len(new_tech & ex_tech) / max(len(new_tech), len(ex_tech))
                if overlap > 0.7:
                    return True
        return False

    # ------------------------------------------------------------------
    # Phase 2: Bullet expansion
    # ------------------------------------------------------------------

    def _expand_bullets(
        self,
        tailored: Dict[str, Any],
        original: Dict[str, Any],
        jd_analysis: Dict[str, Any],
        current_fill: float,
    ) -> Dict[str, Any]:
        """Expand experience bullets to fill the page."""
        from services.gemini_client import gemini_json, GEMINI_FLASH
        from schemas.resume_schemas import build_resume_text
        import json

        experience = tailored.get("experience", [])
        if not experience:
            return tailored

        # Calculate total current bullets
        total_current = sum(len(exp.get("bullets", [])) for exp in experience)
        if total_current >= _MAX_TOTAL_EXP_BULLETS:
            return tailored

        # Calculate target bullets per role
        expansion_plan = []
        for i, exp in enumerate(experience):
            current = len(exp.get("bullets", []))
            cap = _ROLE_BULLET_CAPS[i] if i < len(_ROLE_BULLET_CAPS) else 3

            # Short tenure check: cap internships/short roles lower
            title_lower = exp.get("title", "").lower()
            if "intern" in title_lower:
                cap = min(cap, 5)

            needed = max(0, cap - current)
            if needed > 0:
                expansion_plan.append({
                    "index": i,
                    "company": exp.get("company", "Unknown"),
                    "title": exp.get("title", ""),
                    "current_bullets": exp.get("bullets", []),
                    "additional_needed": needed,
                })

        if not expansion_plan:
            return tailored

        # Enforce total cap
        total_additional = sum(p["additional_needed"] for p in expansion_plan)
        budget = _MAX_TOTAL_EXP_BULLETS - total_current
        if total_additional > budget:
            # Scale down proportionally
            scale = budget / total_additional
            for p in expansion_plan:
                p["additional_needed"] = max(1, round(p["additional_needed"] * scale))

        # Build Gemini prompt
        original_text = build_resume_text(original)[:2000]
        required_skills = ", ".join(jd_analysis.get("required_skills", [])[:10])
        keywords = ", ".join(jd_analysis.get("keywords", [])[:10])

        entries_desc = ""
        for p in expansion_plan:
            entries_desc += (
                f"\n- {p['company']} / {p['title']}: "
                f"currently has {len(p['current_bullets'])} bullets, "
                f"generate {p['additional_needed']} more"
            )

        prompt = (
            "You are expanding experience bullets for a resume to fill a one-page PDF.\n\n"
            "STRICT RULES:\n"
            "1. Each bullet MUST be 150-220 characters long (2 full lines on the PDF).\n"
            "2. Each bullet starts with a strong action verb: Built, Developed, Implemented, Designed, "
            "Led, Optimized, Automated, Deployed, Reduced, Integrated, Configured, Streamlined, "
            "Migrated, Established, Refactored, Monitored.\n"
            "3. Each bullet follows: Action Verb + Technology/Context + Measurable Outcome.\n"
            "4. Add REALISTIC approximate metrics to every bullet:\n"
            "   - Use approximations: ~15%, 3x, 50+, 1K+ — never precise numbers\n"
            "   - Scale to context: intern/personal project → small numbers (50+ users, ~200ms)\n"
            "     Small company → medium (1K+ requests, ~20% improvement)\n"
            "     Mid/large company → larger (10K+ users, ~30% reduction)\n"
            "   - Prefer relative improvements (%, Nx) over absolute numbers\n"
            "5. Ground every bullet in the candidate's ACTUAL skills and experience context below.\n"
            "6. Do NOT fabricate companies, clients, or production systems.\n"
            "7. Do NOT duplicate content from existing bullets.\n"
            f"8. Naturally incorporate these JD keywords where relevant: {required_skills}\n"
            f"   Additional keywords: {keywords}\n\n"
            f"Generate additional bullets for these entries:{entries_desc}\n\n"
            f"=== CANDIDATE CONTEXT ===\n{original_text}\n\n"
            "Return a JSON object:\n"
            '{"expanded_experience": [\n'
            '  {"company": "Company Name", "additional_bullets": ["bullet1", "bullet2"]}\n'
            "]}\n"
        )

        EXPANSION_SCHEMA = {
            "expanded_experience": [{
                "company": str,
                "additional_bullets": [str],
            }]
        }

        try:
            result = gemini_json(
                prompt, max_tokens=12000, temperature=0.4,
                model=GEMINI_FLASH, schema=EXPANSION_SCHEMA,
            )
        except Exception as e:
            logger.error("ContentAugmenter: bullet expansion Gemini call failed: %s", e)
            return tailored

        # Merge expanded bullets back
        expanded = result.get("expanded_experience", [])
        exp_by_company = {e.get("company", "").lower().strip(): e for e in expanded}

        for p in expansion_plan:
            company_key = p["company"].lower().strip()
            match = exp_by_company.get(company_key)
            if not match:
                continue

            new_bullets = match.get("additional_bullets", [])
            # Filter: non-empty, non-duplicate, reasonable length
            existing_lower = {b.lower() for b in experience[p["index"]].get("bullets", [])}
            for bullet in new_bullets[:p["additional_needed"]]:
                bullet = str(bullet).strip()
                if not bullet or bullet.lower() in existing_lower:
                    continue
                if len(bullet) < 50:
                    continue
                experience[p["index"]]["bullets"].append(bullet)
                existing_lower.add(bullet.lower())

                # Check total cap
                total = sum(len(e.get("bullets", [])) for e in experience)
                if total >= _MAX_TOTAL_EXP_BULLETS:
                    break

            total = sum(len(e.get("bullets", [])) for e in experience)
            if total >= _MAX_TOTAL_EXP_BULLETS:
                break

        return tailored

    # ------------------------------------------------------------------
    # Phase 3: Impact injection on existing bullets
    # ------------------------------------------------------------------

    def _inject_impact(
        self,
        tailored: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Add realistic quantifiable metrics to bullets that lack them."""
        from services.gemini_client import gemini_json, GEMINI_FLASH

        # Collect bullets without metrics
        candidates = []
        for section_key in ("experience", "projects"):
            for entry_idx, entry in enumerate(tailored.get(section_key, [])):
                for bullet_idx, bullet in enumerate(entry.get("bullets", [])):
                    if not METRIC_PATTERN.search(bullet):
                        candidates.append({
                            "section": section_key,
                            "entry_index": entry_idx,
                            "bullet_index": bullet_idx,
                            "text": bullet,
                            "context": _get_entry_context(entry),
                        })

        if not candidates:
            logger.info("ContentAugmenter Phase 3: all bullets already have metrics")
            return tailored

        if len(candidates) > 15:
            candidates = candidates[:15]  # Limit to avoid huge prompts

        # Build context signals for realistic scaling
        context_signals = self._build_context_signals(tailored)

        bullets_list = "\n".join(
            f"{i+1}. [{c['context']}] {c['text']}"
            for i, c in enumerate(candidates)
        )

        prompt = (
            "You are adding quantifiable impact to resume bullets that currently lack metrics.\n\n"
            "STRICT RULES FOR REALISTIC METRICS:\n"
            "1. Use ONLY approximate, realistic metrics — never precise numbers.\n"
            "   GOOD: ~15%, 3x, 50+, 1K+, ~200ms, ~$10K\n"
            "   BAD: 14.7%, exactly 1,247 users, $47,832\n"
            "2. Scale metrics to the role context:\n"
            f"   Context signals: {context_signals}\n"
            "   - Intern/junior: 50+ users, ~200ms improvement, 3x faster, ~15% reduction\n"
            "   - Mid-level: 1K+ requests/day, ~30% improvement, 5x throughput\n"
            "   - Senior/lead: 10K+ users, ~40% cost reduction, 100K+ records\n"
            "3. Derive metrics from the ACTION described — don't invent unrelated numbers.\n"
            "   'Built REST API' → 'serving 1K+ requests/day' is reasonable\n"
            "   'Optimized queries' → 'reducing latency by ~40%' is reasonable\n"
            "   'Automated testing' → 'covering 200+ test cases' is reasonable\n"
            "4. NEVER add revenue figures or exact dollar amounts.\n"
            "5. Prefer relative improvements (%, Nx, time saved) over absolute numbers.\n"
            "6. Keep the original meaning intact — only ADD a metric clause, don't rewrite.\n"
            "7. Each enhanced bullet must be under 250 characters.\n\n"
            f"Bullets to enhance:\n{bullets_list}\n\n"
            "Return a JSON object:\n"
            '{"enhanced_bullets": [\n'
            '  {"index": 1, "enhanced": "The full enhanced bullet text"}\n'
            "]}\n"
            "Only include bullets you actually changed. Keep the index numbers matching.\n"
        )

        IMPACT_SCHEMA = {
            "enhanced_bullets": [{
                "index": int,
                "enhanced": str,
            }]
        }

        try:
            result = gemini_json(
                prompt, max_tokens=12000, temperature=0.3,
                model=GEMINI_FLASH, schema=IMPACT_SCHEMA,
            )
        except Exception as e:
            logger.error("ContentAugmenter: impact injection Gemini call failed: %s", e)
            return tailored

        # Apply enhanced bullets with validation
        enhanced_map = {}
        for item in result.get("enhanced_bullets", []):
            idx = item.get("index", 0) - 1  # Convert 1-indexed to 0-indexed
            if 0 <= idx < len(candidates):
                enhanced_map[idx] = item.get("enhanced", "")

        applied = 0
        for idx, enhanced_text in enhanced_map.items():
            candidate = candidates[idx]
            original_text = candidate["text"]

            # Validation
            if not enhanced_text or len(enhanced_text) > 250:
                continue
            if len(enhanced_text) < len(original_text) * 0.7:
                continue  # Too much content removed
            if not METRIC_PATTERN.search(enhanced_text):
                continue  # Still no metrics after enhancement

            # Apply
            section = tailored[candidate["section"]]
            entry = section[candidate["entry_index"]]
            entry["bullets"][candidate["bullet_index"]] = enhanced_text
            applied += 1

        logger.info("ContentAugmenter Phase 3: enhanced %d/%d bullets with impact", applied, len(candidates))
        return tailored

    @staticmethod
    def _build_context_signals(tailored: Dict[str, Any]) -> str:
        """Extract seniority/scale context for realistic metric generation."""
        signals = []
        for exp in tailored.get("experience", []):
            title = exp.get("title", "").lower()
            if "intern" in title:
                seniority = "intern"
            elif any(w in title for w in ("junior", "jr", "associate", "entry")):
                seniority = "junior"
            elif any(w in title for w in ("senior", "sr", "lead", "principal", "staff")):
                seniority = "senior"
            elif any(w in title for w in ("manager", "director", "vp", "head")):
                seniority = "leadership"
            else:
                seniority = "mid-level"
            signals.append(f"{exp.get('company', '?')}={seniority}")
        return ", ".join(signals) if signals else "mid-level"

    # ------------------------------------------------------------------
    # Phase 4: Overflow protection
    # ------------------------------------------------------------------

    def _overflow_trim(self, tailored: Dict[str, Any], fill: float) -> Dict[str, Any]:
        """Trim content if page overflows.

        Uses estimated per-bullet fill reduction to avoid calling _measure_fill
        in tight loops. Only re-measures once per strategy to verify.
        """
        if fill <= _OVERFLOW_SOFT:
            return tailored

        logger.warning("ContentAugmenter Phase 4: fill %.1f%% > 95%% — trimming", fill * 100)

        # Estimate: each bullet ≈ 1.5-2% of page fill
        _EST_BULLET_FILL = 0.018

        # Strategy 1: trim bullets from oldest experience entries
        experience = tailored.get("experience", [])
        estimated_fill = fill
        for exp in reversed(experience):
            bullets = exp.get("bullets", [])
            while len(bullets) > 3 and estimated_fill > _OVERFLOW_SOFT:
                bullets.pop()
                estimated_fill -= _EST_BULLET_FILL
                logger.debug("ContentAugmenter: trimmed bullet from %s", exp.get("company", "?"))

        # Re-measure once after strategy 1
        fill = self._measure_fill(tailored)

        # Strategy 2: trim project bullets (3 → 2)
        if fill > _OVERFLOW_SOFT:
            estimated_fill = fill
            for proj in tailored.get("projects", []):
                bullets = proj.get("bullets", [])
                while len(bullets) > 2 and estimated_fill > _OVERFLOW_SOFT:
                    bullets.pop()
                    estimated_fill -= _EST_BULLET_FILL
            fill = self._measure_fill(tailored)

        # Strategy 3: remove last project if still overflowing
        projects = tailored.get("projects", [])
        if fill > _OVERFLOW_SOFT and len(projects) > 1:
            while len(projects) > 1 and self._measure_fill(tailored) > _OVERFLOW_SOFT:
                removed = projects.pop()
                logger.debug("ContentAugmenter: removed project '%s'", removed.get("name", "?"))

        return tailored

    # ------------------------------------------------------------------
    # Phase 5: ATS hardening
    # ------------------------------------------------------------------

    def _ats_harden(
        self,
        tailored: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Ensure the resume passes AI ATS screeners.

        Parallelizes keyword density and summary alignment (they touch
        different resume sections), then runs weak verbs sequentially
        (since it modifies bullets that keyword density may have changed).
        """
        # Step 1: Run keyword density + summary alignment in PARALLEL
        # These are independent: keyword density modifies bullets,
        # summary alignment modifies the summary field.
        keyword_result = {}
        summary_result = {}

        # Deep-copy sections for parallel modification to avoid races
        tailored_for_keywords = copy.deepcopy(tailored)
        tailored_for_summary = copy.deepcopy(tailored)

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_kw = executor.submit(
                self._enforce_keyword_density, tailored_for_keywords, jd_analysis
            )
            future_summary = executor.submit(
                self._verify_summary_alignment, tailored_for_summary, jd_analysis
            )

            # Collect results
            try:
                keyword_result = future_kw.result(timeout=30)
            except Exception as e:
                logger.error("ContentAugmenter ATS: keyword density parallel failed: %s", e)
                keyword_result = tailored

            try:
                summary_result = future_summary.result(timeout=30)
            except Exception as e:
                logger.error("ContentAugmenter ATS: summary alignment parallel failed: %s", e)
                summary_result = tailored

        # Merge: take experience/projects from keyword result, summary from summary result
        tailored["experience"] = keyword_result.get("experience", tailored.get("experience", []))
        tailored["summary"] = summary_result.get("summary", tailored.get("summary", ""))

        # Step 2: Run weak verbs sequentially (depends on keyword density output)
        tailored = self._fix_weak_verbs(tailored)

        # Step 3: Chronological order (pure Python, instant)
        tailored = self._enforce_chronological_order(tailored)
        return tailored

    def _enforce_keyword_density(
        self,
        tailored: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Ensure each required keyword appears >= 2 times in the resume."""
        from services.gemini_client import gemini_json, GEMINI_FLASH
        from schemas.resume_schemas import build_resume_text
        from utils.keyword_normalizer import get_all_forms

        required = jd_analysis.get("required_skills", [])
        if not required:
            return tailored

        resume_text = build_resume_text(tailored).lower()

        under_represented = []
        for skill in required:
            all_forms = get_all_forms(skill)
            total_count = 0
            for form in all_forms:
                if len(form) <= 2:
                    total_count += resume_text.count(form)
                else:
                    pattern = re.compile(r"(?<![a-zA-Z])" + re.escape(form) + r"(?![a-zA-Z])")
                    total_count += len(pattern.findall(resume_text))
            if total_count < 2:
                under_represented.append(skill)

        if not under_represented:
            logger.info("ContentAugmenter ATS: all keywords at sufficient density")
            return tailored

        logger.info(
            "ContentAugmenter ATS: %d under-represented keywords: %s",
            len(under_represented), under_represented[:10],
        )

        # Find the most relevant bullets to weave keywords into
        experience = tailored.get("experience", [])
        bullet_pool = []
        for i, exp in enumerate(experience):
            for j, bullet in enumerate(exp.get("bullets", [])):
                bullet_pool.append({
                    "exp_idx": i,
                    "bullet_idx": j,
                    "text": bullet,
                    "company": exp.get("company", ""),
                })

        if not bullet_pool:
            return tailored

        # Select up to 5 bullets to potentially modify (fewer = smaller output = less truncation risk)
        sample = bullet_pool[:5]
        bullets_text = "\n".join(f"{i+1}. {b['text']}" for i, b in enumerate(sample))

        prompt = (
            "You are integrating missing keywords into existing resume bullets.\n\n"
            "RULES:\n"
            "1. Naturally weave each keyword into a relevant bullet — do NOT just append it.\n"
            "2. Preserve the original meaning and structure of each bullet.\n"
            "3. Keep each bullet under 250 characters.\n"
            "4. Only modify bullets where the keyword fits naturally.\n"
            "5. Each keyword should be added to at least one bullet.\n\n"
            f"Keywords to integrate: {', '.join(under_represented[:10])}\n\n"
            f"Current bullets:\n{bullets_text}\n\n"
            "Return a JSON object:\n"
            '{"modified_bullets": [\n'
            '  {"index": 1, "text": "The modified bullet with keyword integrated"}\n'
            "]}\n"
            "Only include bullets you actually changed.\n"
        )

        KEYWORD_SCHEMA = {"modified_bullets": [{"index": int, "text": str}]}

        try:
            result = gemini_json(
                prompt, max_tokens=24000, temperature=0.3,
                model=GEMINI_FLASH, schema=KEYWORD_SCHEMA,
            )
        except Exception as e:
            logger.error("ContentAugmenter ATS keyword density: Gemini failed: %s", e)
            return tailored

        for item in result.get("modified_bullets", []):
            idx = item.get("index", 0) - 1
            new_text = item.get("text", "")
            if 0 <= idx < len(sample) and new_text and len(new_text) <= 250:
                entry = sample[idx]
                experience[entry["exp_idx"]]["bullets"][entry["bullet_idx"]] = new_text

        return tailored

    def _fix_weak_verbs(self, tailored: Dict[str, Any]) -> Dict[str, Any]:
        """Replace weak opening verbs with strong action verbs."""
        from services.gemini_client import gemini_json, GEMINI_FLASH

        weak_bullets = []
        for section_key in ("experience", "projects"):
            for entry_idx, entry in enumerate(tailored.get(section_key, [])):
                for bullet_idx, bullet in enumerate(entry.get("bullets", [])):
                    bullet_lower = re.sub(r"^[-\u2022*]\s*", "", bullet.lower().strip())
                    for phrase in WEAK_VERB_PHRASES:
                        if bullet_lower.startswith(phrase):
                            weak_bullets.append({
                                "section": section_key,
                                "entry_index": entry_idx,
                                "bullet_index": bullet_idx,
                                "text": bullet,
                                "weak_phrase": phrase,
                            })
                            break

        if not weak_bullets:
            logger.info("ContentAugmenter ATS: no weak verbs found")
            return tailored

        logger.info("ContentAugmenter ATS: %d bullets with weak verbs", len(weak_bullets))

        bullets_text = "\n".join(
            f"{i+1}. {b['text']}" for i, b in enumerate(weak_bullets[:10])
        )

        prompt = (
            "You are replacing weak opening verbs in resume bullets with strong action verbs.\n\n"
            "RULES:\n"
            "1. ONLY change the opening verb/phrase — keep the rest of the bullet identical.\n"
            "2. Use strong verbs: Built, Developed, Implemented, Designed, Led, Optimized, "
            "Automated, Deployed, Reduced, Integrated, Configured, Streamlined, Migrated, "
            "Established, Refactored, Monitored, Engineered, Architected, Spearheaded.\n"
            "3. Choose the verb that best matches the action described.\n"
            "4. Do NOT change the content or meaning of the bullet.\n\n"
            f"Bullets to fix:\n{bullets_text}\n\n"
            "Return a JSON object:\n"
            '{"fixed_bullets": [\n'
            '  {"index": 1, "text": "The bullet with strong opening verb"}\n'
            "]}\n"
        )

        VERB_SCHEMA = {"fixed_bullets": [{"index": int, "text": str}]}

        try:
            result = gemini_json(
                prompt, max_tokens=12000, temperature=0.2,
                model=GEMINI_FLASH, schema=VERB_SCHEMA,
            )
        except Exception as e:
            logger.error("ContentAugmenter ATS weak verbs: Gemini failed: %s", e)
            return tailored

        for item in result.get("fixed_bullets", []):
            idx = item.get("index", 0) - 1
            new_text = item.get("text", "")
            if 0 <= idx < len(weak_bullets) and new_text:
                wb = weak_bullets[idx]
                tailored[wb["section"]][wb["entry_index"]]["bullets"][wb["bullet_index"]] = new_text

        return tailored

    def _verify_summary_alignment(
        self,
        tailored: Dict[str, Any],
        jd_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Ensure summary mentions job title and >= 3 required skills."""
        from services.gemini_client import gemini_json, GEMINI_FLASH

        summary = tailored.get("summary", "")
        if not summary:
            return tailored

        job_title = jd_analysis.get("job_title", "").lower()
        required = [s.lower() for s in jd_analysis.get("required_skills", [])[:5]]

        summary_lower = summary.lower()
        has_title = job_title in summary_lower if job_title else True
        skills_in_summary = sum(1 for s in required if s in summary_lower)

        if has_title and skills_in_summary >= 3:
            logger.info("ContentAugmenter ATS: summary alignment OK")
            return tailored

        logger.info(
            "ContentAugmenter ATS: summary needs alignment (title=%s, skills=%d/3)",
            has_title, skills_in_summary,
        )

        # Get candidate's actual background for grounding
        experience = tailored.get("experience", [])
        exp_context = ", ".join(
            f"{e.get('title', '')} at {e.get('company', '')}" for e in experience[:3]
        )

        prompt = (
            "Rewrite this professional summary to naturally include the target role and key skills.\n\n"
            "RULES:\n"
            "1. Write 3-4 clear, confident sentences.\n"
            "2. Naturally mention the target role title and at least 3 of the required skills.\n"
            "3. Ground the summary in the candidate's actual experience.\n"
            "4. Use plain, professional language.\n"
            "5. BANNED WORDS: 'Versatile', 'Proficient', 'Leverages', 'extensive experience', "
            "'proven track record', 'results-driven', 'passionate', 'detail-oriented', "
            "'highly skilled', 'seasoned', 'cutting-edge', 'innovative', 'dynamic', "
            "'self-motivated', 'Adept', 'dedicated', 'committed to excellence', 'strong foundation'.\n"
            "6. Do NOT start with an adjective.\n\n"
            f"Target role: {jd_analysis.get('job_title', '')}\n"
            f"Required skills: {', '.join(jd_analysis.get('required_skills', [])[:5])}\n"
            f"Candidate background: {exp_context}\n"
            f"Current summary: {summary}\n\n"
            'Return a JSON object: {"summary": "The rewritten summary"}\n'
        )

        try:
            result = gemini_json(
                prompt, max_tokens=6000, temperature=0.3,
                model=GEMINI_FLASH, schema={"summary": str},
            )
            new_summary = result.get("summary", "")
            if new_summary and len(new_summary) > 50:
                tailored["summary"] = new_summary
                logger.info("ContentAugmenter ATS: summary rewritten for alignment")
        except Exception as e:
            logger.error("ContentAugmenter ATS summary alignment: Gemini failed: %s", e)

        return tailored

    @staticmethod
    def _enforce_chronological_order(tailored: Dict[str, Any]) -> Dict[str, Any]:
        """Sort experience entries in reverse-chronological order (most recent first)."""
        from services.resume_parser import _PRESENT_KEYWORDS, _YEAR_PATTERN

        experience = tailored.get("experience", [])
        if len(experience) <= 1:
            return tailored

        def _sort_key(exp: dict) -> tuple:
            dates = exp.get("dates", "").lower()
            # Present/current → sort to top (year 9999)
            if any(kw in dates for kw in _PRESENT_KEYWORDS):
                return (9999, 12)
            years = _YEAR_PATTERN.findall(dates)
            if years:
                end_year = int(years[-1])
                return (end_year, 6)  # Default to mid-year
            return (0, 0)  # No date → sort to bottom

        experience.sort(key=_sort_key, reverse=True)
        tailored["experience"] = experience
        return tailored


# ------------------------------------------------------------------
# Helpers (module-level)
# ------------------------------------------------------------------

def _get_entry_context(entry: dict) -> str:
    """Get a short context string for a resume entry."""
    company = entry.get("company", "")
    title = entry.get("title", "")
    name = entry.get("name", "")
    if company and title:
        return f"{title} at {company}"
    if name:
        return f"Project: {name}"
    return "Unknown"
