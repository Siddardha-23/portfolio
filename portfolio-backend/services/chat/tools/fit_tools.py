"""
Fit-analysis tools — owned by the Analyst specialist.

`am_i_a_fit(jd_text)` matches a pasted job description against Harshith's
declared skill graph and returns an honest score, matched skills, gaps, and
the strongest project evidence the recruiter should look at.
"""
from __future__ import annotations

import re
from typing import Dict, List

from knowledge_base import all_skills, evidence_for_skill, search


def _normalize(s: str) -> str:
    # Keep '/', '.', '-' and '+' so multi-token skills (ci/cd, node.js, c++) survive.
    return re.sub(r"[^a-z0-9 /\.\-\+]+", " ", (s or "").lower()).strip()


def _extract_terms(jd: str) -> List[str]:
    """Pull skill-like phrases from the JD by intersecting with the known skill set."""
    jd_low = _normalize(jd)
    matched = []
    for skill in all_skills():
        s_low = skill.lower()
        # Word-boundary match — avoids matching "go" inside "google"
        if re.search(rf"(?<![a-z0-9]){re.escape(s_low)}(?![a-z0-9])", jd_low):
            matched.append(skill)
    return matched


# Common asks whose absence is signal even if the literal word doesn't appear
_GAP_INDICATORS = [
    ("kubernetes", ["k8s", "kubernetes", "eks", "gke", "aks"]),
    ("kafka", ["kafka", "msk"]),
    ("snowflake", ["snowflake"]),
    ("databricks", ["databricks"]),
    ("graphql", ["graphql"]),
    ("go", [r"\bgolang\b", r"\bgo language\b"]),
    ("rust", [r"\brust\b"]),
]


def _detect_gaps(jd: str, matched: List[str]) -> List[str]:
    jd_low = _normalize(jd)
    matched_low = {m.lower() for m in matched}
    gaps = []
    for label, patterns in _GAP_INDICATORS:
        if label in matched_low:
            continue
        if any(re.search(p, jd_low) for p in patterns):
            gaps.append(label)
    return gaps


def am_i_a_fit(jd_text: str) -> Dict:
    """Honest fit analysis between a job description and Harshith's portfolio.

    Args:
        jd_text: full job description text (paste from the listing).

    Returns:
        score (0-100), matched_skills, gap_skills, top_evidence (3 entries).
    """
    if not jd_text or len(jd_text.strip()) < 20:
        return {
            "ok": False,
            "error": "Paste at least a couple sentences from the job description.",
        }

    matched = _extract_terms(jd_text)
    gaps = _detect_gaps(jd_text, matched)

    # Evidence: top 3 portfolio entries that match the JD as a whole
    top_evidence = []
    for hit in search(jd_text, top_k=3):
        top_evidence.append({
            "id": hit["id"],
            "title": hit["title"],
            "summary": hit["snippet"],
            "score": hit["score"],
            "skills": hit["skills"][:8],
            "evidence": hit.get("evidence") or [],
            "impact": hit.get("impact"),
        })

    # Score: matched / (matched + gaps), capped, weighted by evidence quality
    base = len(matched) / max(1, (len(matched) + len(gaps) * 1.5))
    evidence_boost = min(0.15, 0.05 * len(top_evidence))
    score = round(min(0.98, base + evidence_boost) * 100)

    if score >= 75:
        verdict = "Strong fit — most asks are covered with shipped evidence."
    elif score >= 55:
        verdict = "Solid fit on the core; a couple of stretch areas worth flagging."
    elif score >= 35:
        verdict = "Partial fit — some real overlap, but meaningful gaps to address honestly."
    else:
        verdict = "Adjacent fit — the role leans on tech outside the current portfolio."

    return {
        "ok": True,
        "data": {
            "score": score,
            "verdict": verdict,
            "matched_skills": matched,
            "gap_skills": gaps,
            "top_evidence": top_evidence,
        },
    }
