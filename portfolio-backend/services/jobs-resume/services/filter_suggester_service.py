"""
Resume-aware filter suggester for the daily Apify pipeline.

Given a user's structured base resume, returns LinkedIn keyword phrases,
Workday job titles, custom role terms, and a recommended past-days window
that match the candidate's profile. Uses Gemini Flash for cheap fast JSON.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from services.gemini_client import GEMINI_FLASH, gemini_json

logger = logging.getLogger(__name__)

_SUGGESTION_SCHEMA = {
    "headline": str,
    "rationale": str,
    "linkedin_keyword_sets": [str],
    "workday_titles": [str],
    "custom_role_terms": [str],
    "past_days": int,
    "preset_tags": [str],
}


def _resume_summary(structured: Dict[str, Any]) -> Dict[str, Any]:
    """Slim the resume down to just what the model needs to suggest filters."""
    skills = structured.get("skills") or {}
    flat_skills: List[str] = []
    if isinstance(skills, dict):
        for v in skills.values():
            if isinstance(v, list):
                flat_skills.extend(v)
    elif isinstance(skills, list):
        flat_skills = [str(s) for s in skills]

    experiences = []
    for exp in (structured.get("experience") or [])[:6]:
        experiences.append({
            "title": exp.get("title", ""),
            "company": exp.get("company", ""),
            "bullets": (exp.get("bullets") or [])[:3],
        })

    projects = []
    for p in (structured.get("projects") or [])[:5]:
        projects.append({
            "name": p.get("name", ""),
            "tech": p.get("tech", ""),
        })

    education = []
    for ed in (structured.get("education") or [])[:3]:
        education.append({
            "degree": ed.get("degree", ""),
            "institution": ed.get("institution", ""),
        })

    return {
        "summary": (structured.get("summary") or "")[:600],
        "skills": flat_skills[:40],
        "experience": experiences,
        "projects": projects,
        "education": education,
    }


def suggest_filters(structured_resume: Dict[str, Any]) -> Dict[str, Any]:
    """Return a JSON suggestion bundle the UI can prefill onto the pipeline form."""
    slim = _resume_summary(structured_resume)
    prompt = (
        "You are a senior tech recruiter helping a candidate craft search filters "
        "for a daily job-hunt pipeline that scrapes LinkedIn (keyword search URLs) "
        "and Workday (titleSearch[]).\n\n"
        f"CANDIDATE PROFILE (JSON):\n{slim}\n\n"
        "Produce ONE JSON object with these fields:\n"
        '  - "headline": short one-line summary of the candidate persona (e.g., "Cloud + AI new-grad").\n'
        '  - "rationale": 1-2 sentence reasoning that justifies the suggested filters.\n'
        '  - "linkedin_keyword_sets": 4-6 short keyword phrases (3-6 words each) to feed to '
        "LinkedIn's keyword search. Each phrase must be specific enough to surface relevant "
        "roles and is OK to combine domain + seniority (e.g., \"Backend Engineer Python AWS\").\n"
        '  - "workday_titles": 12-30 job titles tailored to the candidate. Always anchor them '
        "to a software domain word (Software, Engineer, DevOps, SRE, Backend, etc.) so generic "
        '"New Grad" doesn\'t pull non-tech roles. Include early-career variants like '
        '"Junior", "Associate", "New Grad", "I", "Graduate" where appropriate.\n'
        '  - "custom_role_terms": 4-8 single keyword terms (1-2 words) that describe the '
        "candidate's adjacent specializations (e.g., 'security', 'data engineer', 'mobile').\n"
        '  - "past_days": integer 1-7 — how stale to allow postings to be. Use 1 for active '
        "applicants, 3-7 for niche roles where daily volume is low.\n"
        '  - "preset_tags": 1-3 short labels classifying the candidate '
        '(e.g., ["cloud-devops","ai-ml","backend","frontend","fullstack","data","security"]).\n\n'
        "Return ONLY the JSON object, no commentary."
    )
    raw = gemini_json(prompt=prompt, model=GEMINI_FLASH, temperature=0.35, schema=_SUGGESTION_SCHEMA)
    return _coerce(raw)


def _coerce(raw: Any) -> Dict[str, Any]:
    """Defensive coercion: clamp counts, dedupe, and bound past_days."""
    if not isinstance(raw, dict):
        raw = {}

    def _str_list(key: str, max_items: int) -> List[str]:
        items = raw.get(key) or []
        if not isinstance(items, list):
            return []
        seen: set = set()
        out: List[str] = []
        for item in items:
            s = str(item).strip()
            if not s or s.lower() in seen:
                continue
            seen.add(s.lower())
            out.append(s)
            if len(out) >= max_items:
                break
        return out

    try:
        past_days = int(raw.get("past_days") or 1)
    except (TypeError, ValueError):
        past_days = 1
    past_days = max(1, min(past_days, 14))

    return {
        "headline": str(raw.get("headline") or "Resume-derived filters")[:120],
        "rationale": str(raw.get("rationale") or "")[:400],
        "linkedin_keyword_sets": _str_list("linkedin_keyword_sets", 8),
        "workday_titles": _str_list("workday_titles", 60),
        "custom_role_terms": _str_list("custom_role_terms", 12),
        "past_days": past_days,
        "preset_tags": _str_list("preset_tags", 5),
    }
