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


_GENERALIST_BASELINE = [
    "Software Engineer", "Software Developer",
    "Software Engineer I", "Software Engineer II",
    "Associate Software Engineer", "Junior Software Engineer",
    "New Grad Software Engineer", "Entry Level Software Engineer",
    "Graduate Software Engineer", "Early Career Software Engineer",
    "Backend Engineer", "Backend Software Engineer",
    "Frontend Engineer", "Frontend Software Engineer",
    "Full Stack Engineer", "Full Stack Software Engineer",
]


def suggest_filters(structured_resume: Dict[str, Any]) -> Dict[str, Any]:
    """Return a JSON suggestion bundle the UI can prefill onto the pipeline form."""
    slim = _resume_summary(structured_resume)
    prompt = (
        "You are a senior tech recruiter helping a candidate craft search filters "
        "for a daily job-hunt pipeline that scrapes LinkedIn (keyword search URLs) "
        "and Workday (titleSearch[]).\n\n"
        f"CANDIDATE PROFILE (JSON):\n{slim}\n\n"
        "IMPORTANT — DO NOT NARROW TOO MUCH. Even if the candidate's primary domain is "
        "(say) Cloud or AI, they will still apply to general SWE / Backend / Full-Stack / "
        "Frontend roles, especially at the entry level. The output must always include a "
        "generalist baseline of these titles plus persona-specific specializations.\n\n"
        "Produce ONE JSON object with these fields:\n"
        '  - "headline": short one-line summary of the candidate persona (e.g., "Cloud-leaning generalist SWE — open to backend/full-stack").\n'
        '  - "rationale": 1-2 sentences justifying the suggested filters and noting the breadth.\n'
        '  - "linkedin_keyword_sets": 5-8 keyword phrases (3-6 words each) for LinkedIn search. '
        "MUST include at least 2 generalist phrases like \"software engineer new grad\" or "
        "\"entry level software engineer\" plus 3-5 persona-specific phrases combining domain "
        "+ stack (e.g., \"Backend Engineer Python AWS\").\n"
        '  - "workday_titles": 25-50 job titles. MUST include the entire generalist baseline '
        f"(these exact titles): {_GENERALIST_BASELINE} — plus persona-specific titles. Each "
        "title must be anchored to a software domain word (Software, Engineer, DevOps, SRE, "
        'Backend, Frontend, AI, ML, etc.) so generic "New Grad" doesn\'t pull non-tech roles. '
        'Include early-career variants ("Junior", "Associate", "New Grad", "I", "II", "Graduate").\n'
        '  - "custom_role_terms": 5-10 single keyword terms (1-2 words each) covering adjacent '
        "specializations the candidate could apply for ('security', 'data engineer', 'mobile', "
        "'distributed systems', etc.).\n"
        '  - "past_days": integer 1-7 — how stale to allow postings. Use 1 for active applicants.\n'
        '  - "preset_tags": 1-3 short labels classifying the candidate '
        '(e.g., ["cloud-devops","ai-ml","backend","frontend","fullstack","data","security"]).\n\n'
        "Return ONLY the JSON object, no commentary."
    )
    raw = gemini_json(prompt=prompt, model=GEMINI_FLASH, temperature=0.35, schema=_SUGGESTION_SCHEMA)
    coerced = _coerce(raw)

    # Belt-and-braces: ensure the generalist baseline is always present, even if
    # the model shaved it off.
    existing = {t.lower() for t in coerced["workday_titles"]}
    for t in _GENERALIST_BASELINE:
        if t.lower() not in existing:
            coerced["workday_titles"].append(t)
            existing.add(t.lower())
    coerced["workday_titles"] = coerced["workday_titles"][:60]
    return coerced


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
