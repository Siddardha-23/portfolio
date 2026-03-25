"""
Resume Scorer — hybrid ATS scoring combining deterministic and AI-based analysis.

Deterministic layer: alias-aware keyword matching, skill overlap, keyword frequency,
                     bullet metrics, section checks, impact analysis.
AI layer: semantic relevance, scanner simulation, suggestions.

Combined output conforms to ATS_SCORES_SCHEMA.
"""
import logging
import re
from typing import Any, Dict, List, Tuple

from schemas.resume_schemas import (
    ATS_SCORES_SCHEMA,
    validate_and_coerce,
    build_resume_text,
)
from utils.keyword_normalizer import (
    normalize_single,
    normalize_keywords,
    get_all_forms,
)

logger = logging.getLogger(__name__)


class ResumeScorer:
    """Hybrid ATS scorer: deterministic ground truth + AI semantic assessment."""

    def score(self, tailored: Dict[str, Any], jd_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Run full hybrid scoring pipeline. Returns validated ATS scores dict."""
        det = self._deterministic_scores(tailored, jd_analysis)
        ai = self._ai_scores(tailored, jd_analysis)
        return self._combine(det, ai)

    # ------------------------------------------------------------------
    # Deterministic scoring (pure Python, no AI)
    # ------------------------------------------------------------------

    def _deterministic_scores(self, tailored: Dict[str, Any], jd_analysis: Dict[str, Any]) -> dict:
        """Compute deterministic ATS metrics."""
        required = normalize_keywords(jd_analysis.get("required_skills", []))
        keywords = normalize_keywords(jd_analysis.get("keywords", []))
        all_kw = list(dict.fromkeys(required + keywords))

        resume_text = build_resume_text(tailored)

        kw_score, found_kw, missing_kw = self._keyword_match_score(resume_text, all_kw)
        kw_freq_score = self._keyword_frequency_score(resume_text, all_kw)
        skills_score = self._skills_alignment_score(tailored.get("skills", {}), required)
        section_score = self._section_completeness_score(tailored)
        impact_score = self._quantifiable_impact_score(tailored)
        format_score = 95  # We control the format — always ATS-friendly

        # Impact engine analysis (deterministic bullet quality)
        from services.impact_engine import ImpactEngine
        impact_analysis = ImpactEngine().analyze(tailored)

        return {
            "keyword_match": kw_score,
            "keyword_frequency": kw_freq_score,
            "skills_alignment": skills_score,
            "section_completeness": section_score,
            "quantifiable_impact": impact_score,
            "format_score": format_score,
            "missing_keywords": missing_kw,
            "found_keywords": found_kw,
            "impact_suggestions": impact_analysis.get("suggestions", []),
            "impact_score_detail": impact_analysis.get("impact_score", 0),
        }

    def _keyword_match_score(
        self, resume_text: str, keywords: List[str]
    ) -> Tuple[int, List[str], List[str]]:
        """Alias-aware keyword matching with word-boundary awareness.

        Uses get_all_forms() to check if ANY known alias of a keyword
        appears in the resume text, so "Postgres" in JD matches
        "PostgreSQL" in resume.

        Returns (score_0_100, found_keywords, missing_keywords).
        """
        if not keywords:
            return 100, [], []

        text_lower = resume_text.lower()
        found: List[str] = []
        missing: List[str] = []

        for kw in keywords:
            canonical = normalize_single(kw)
            all_forms = get_all_forms(kw)

            kw_found = False
            for form in all_forms:
                if self._text_contains(text_lower, form):
                    kw_found = True
                    break

            if kw_found:
                found.append(canonical)
            else:
                missing.append(canonical)

        total = len(found) + len(missing)
        score = round((len(found) / total) * 100) if total > 0 else 100
        return score, found, missing

    def _keyword_frequency_score(self, resume_text: str, keywords: List[str]) -> int:
        """Score based on keyword frequency — keywords appearing 2+ times score higher.

        Ideal: each keyword appears at least twice (once in skills, once in bullets).
        Cap at 3 per keyword to prevent gaming.
        """
        if not keywords:
            return 100

        text_lower = resume_text.lower()
        total_freq = 0

        for kw in keywords:
            all_forms = get_all_forms(kw)
            kw_count = 0
            for form in all_forms:
                kw_count += self._count_occurrences(text_lower, form)
            total_freq += min(kw_count, 3)  # Cap at 3 per keyword

        max_possible = len(keywords) * 2  # 2 per keyword is ideal
        return min(100, round((total_freq / max_possible) * 100)) if max_possible > 0 else 100

    def _skills_alignment_score(self, resume_skills: dict, required_skills: List[str]) -> int:
        """Percentage of required JD skills found in resume skills section.

        Uses normalization so "Postgres" in JD matches "PostgreSQL" in resume skills.
        """
        if not required_skills:
            return 100

        # Flatten and normalize all resume skills
        flat_skills = set()
        if isinstance(resume_skills, dict):
            for skill_list in resume_skills.values():
                if isinstance(skill_list, list):
                    flat_skills.update(normalize_single(s).lower() for s in skill_list)
        elif isinstance(resume_skills, list):
            flat_skills.update(normalize_single(s).lower() for s in resume_skills)

        found = sum(
            1 for skill in required_skills
            if normalize_single(skill).lower() in flat_skills
        )
        return round((found / len(required_skills)) * 100)

    def _section_completeness_score(self, tailored: Dict[str, Any]) -> int:
        """25 points each for non-empty: summary, skills, experience, education."""
        score = 0
        if tailored.get("summary"):
            score += 25
        if tailored.get("skills"):
            score += 25
        if tailored.get("experience"):
            score += 25
        if tailored.get("education"):
            score += 25
        return score

    def _quantifiable_impact_score(self, tailored: Dict[str, Any]) -> int:
        """Count bullets containing numbers/metrics/percentages.

        Score = min(count * 10, 100).
        """
        metric_pattern = re.compile(r"\d+%|\$[\d,]+|\d+\+|\d+x|\b\d{2,}\b")
        count = 0

        for exp in tailored.get("experience", []):
            for b in exp.get("bullets", []):
                if metric_pattern.search(b):
                    count += 1

        for proj in tailored.get("projects", []):
            for b in proj.get("bullets", []):
                if metric_pattern.search(b):
                    count += 1

        return min(count * 10, 100)

    # ------------------------------------------------------------------
    # Text matching helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _text_contains(text_lower: str, keyword_lower: str) -> bool:
        """Word-boundary-aware keyword search in lowercased text."""
        if not keyword_lower:
            return False
        if len(keyword_lower) <= 2:
            return keyword_lower in text_lower
        pattern = re.compile(
            r"(?<![a-zA-Z])" + re.escape(keyword_lower) + r"(?![a-zA-Z])"
        )
        return bool(pattern.search(text_lower))

    @staticmethod
    def _count_occurrences(text_lower: str, keyword_lower: str) -> int:
        """Count occurrences of a keyword in text (word-boundary-aware)."""
        if not keyword_lower:
            return 0
        if len(keyword_lower) <= 2:
            return text_lower.count(keyword_lower)
        pattern = re.compile(
            r"(?<![a-zA-Z])" + re.escape(keyword_lower) + r"(?![a-zA-Z])"
        )
        return len(pattern.findall(text_lower))

    # ------------------------------------------------------------------
    # AI scoring (Gemini)
    # ------------------------------------------------------------------

    def _ai_scores(self, tailored: Dict[str, Any], jd_analysis: Dict[str, Any]) -> dict:
        """Call Gemini for semantic assessment that can't be computed deterministically."""
        import json
        from services.gemini_client import gemini_json

        tailored_json = json.dumps(tailored, indent=2)[:6000]
        jd_json = json.dumps(jd_analysis, indent=2)[:3000]

        prompt = (
            "You are an ATS (Applicant Tracking System) and AI recruitment screener expert.\n"
            "Analyze the tailored resume against the job description.\n\n"
            "You are scoring ONLY the following metrics (other metrics are computed separately):\n\n"
            "1. experience_relevance (0-100): How closely do the candidate's job titles, industries, "
            "and responsibilities match the target role. Consider career trajectory and transferable skills.\n\n"
            "2. scanners — Simulate how different ATS systems would score this resume:\n"
            "   - workday (0-100): Favors exact keyword matches in skills/experience sections\n"
            "   - greenhouse (0-100): Weighs skills sections heavily, structured format\n"
            "   - lever (0-100): Checks experience depth and career progression\n"
            "   - icims (0-100): Strict keyword frequency analysis\n"
            "   - taleo (0-100): Format-sensitive, penalizes non-standard sections\n"
            "   - smartrecruiters (0-100): AI-based semantic matching\n\n"
            "3. ai_screener — Simulate HireVue/Pymetrics-style screening:\n"
            "   - overall (0-100): Overall AI screening pass likelihood\n"
            "   - relevance (0-100): How relevant is the candidate's background\n"
            "   - seniority_fit (0-100): Does experience level match the role\n"
            "   - culture_fit (0-100): Communication style and professional tone\n\n"
            "4. suggestions: List 3-5 specific, actionable improvements the candidate could make.\n\n"
            "5. strengths: List 2-4 strong points of this resume relative to the JD.\n\n"
            "Be REALISTIC. If there are gaps between the candidate and the role, reflect that in scores.\n"
            "All scores MUST be integers 0-100. All arrays MUST be non-empty.\n\n"
            "Return a JSON object with EXACTLY this structure:\n"
            "{\n"
            '  "experience_relevance": integer,\n'
            '  "scanners": { "workday": int, "greenhouse": int, "lever": int, '
            '"icims": int, "taleo": int, "smartrecruiters": int },\n'
            '  "ai_screener": { "overall": int, "relevance": int, '
            '"seniority_fit": int, "culture_fit": int },\n'
            '  "suggestions": ["actionable suggestion 1", "suggestion 2", "suggestion 3"],\n'
            '  "strengths": ["strong point 1", "strong point 2"]\n'
            "}\n\n"
            f"=== TAILORED RESUME ===\n{tailored_json}\n\n"
            f"=== JOB DESCRIPTION ANALYSIS ===\n{jd_json}"
        )

        return gemini_json(prompt, max_tokens=4096, temperature=0.3)

    # ------------------------------------------------------------------
    # Combine deterministic + AI scores
    # ------------------------------------------------------------------

    def _combine(self, det: dict, ai: dict) -> dict:
        """Merge deterministic and AI scores into the full ATS_SCORES_SCHEMA.

        Overall score weights:
          keyword_match (det):       20%
          keyword_frequency (det):    5%
          skills_alignment (det):    20%
          experience_relevance (ai): 20%
          ai_screener.overall (ai):  15%
          quantifiable_impact (det): 10%
          format_score (det):         5%
          section_completeness (det): 5%
        """
        # Extract AI values with safe defaults
        ai_screener = ai.get("ai_screener", {})
        scanners = ai.get("scanners", {})
        experience_relevance = ai.get("experience_relevance", 70)
        ai_overall = ai_screener.get("overall", 70)

        # Compute weighted overall
        overall = round(
            det["keyword_match"] * 0.20
            + det.get("keyword_frequency", 70) * 0.05
            + det["skills_alignment"] * 0.20
            + experience_relevance * 0.20
            + ai_overall * 0.15
            + det["quantifiable_impact"] * 0.10
            + det["format_score"] * 0.05
            + det["section_completeness"] * 0.05
        )

        # Merge suggestions: deterministic impact suggestions first, then AI
        ai_suggestions = ai.get("suggestions", ["No suggestions available"])
        impact_suggestions = det.get("impact_suggestions", [])
        all_suggestions = impact_suggestions + ai_suggestions
        # Deduplicate and cap at 8
        seen: set = set()
        final_suggestions: List[str] = []
        for s in all_suggestions:
            s_lower = s.lower()
            if s_lower not in seen:
                seen.add(s_lower)
                final_suggestions.append(s)
            if len(final_suggestions) >= 8:
                break

        combined = {
            "overall": max(0, min(100, overall)),
            "keyword_match": det["keyword_match"],
            "skills_alignment": det["skills_alignment"],
            "experience_relevance": experience_relevance,
            "quantifiable_impact": det["quantifiable_impact"],
            "format_score": det["format_score"],
            "section_completeness": det["section_completeness"],
            "scanners": scanners,
            "ai_screener": ai_screener,
            "suggestions": final_suggestions,
            "missing_keywords": det["missing_keywords"],
            "strengths": ai.get("strengths", ["Resume submitted for review"]),
        }

        return validate_and_coerce(combined, ATS_SCORES_SCHEMA)
