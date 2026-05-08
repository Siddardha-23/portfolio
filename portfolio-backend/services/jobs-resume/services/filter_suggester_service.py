"""
Resume-aware filter suggester for the daily Apify pipeline.

Given a user's structured base resume, returns LinkedIn keyword phrases,
Workday job titles, custom role terms, and a recommended past-days window
that match the candidate's profile.

Intent-aware behavior:
  - We first run a deterministic resume profiler (resume_profiler.py) to
    detect the candidate's primary career intent (e.g. ai_ml, cloud_devops,
    backend) and a secondary intent for hybrid profiles (e.g. ML + Cloud).
  - The intent's curated title list seeds the suggestion — so an ML-focused
    candidate gets ML titles first, not generic SWE.
  - The generic SWE safety net is only added for early-career or generalist
    profiles, NOT for senior specialists where it would dilute results.
  - Gemini Flash then refines the seed and adds tail variants. The deterministic
    seed is authoritative — anything Gemini drops is restored.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from services.gemini_client import GEMINI_FLASH, gemini_json
from services.resume_profiler import GENERIC_SWE_TITLES, INTENTS, build_profile

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
    """Slim the resume down to just what the model needs to refine filters."""
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


def _preset_tag_for_intent(intent_key: str) -> str:
    """Map our internal intent keys to the short UI preset tags."""
    return {
        "ai_ml": "ai-ml",
        "data_science": "data",
        "data_eng": "data",
        "cloud_devops": "cloud-devops",
        "backend": "backend",
        "frontend": "frontend",
        "fullstack": "fullstack",
        "security": "security",
        "mobile": "mobile",
    }.get(intent_key, "backend")


def suggest_filters(structured_resume: Dict[str, Any]) -> Dict[str, Any]:
    """Return a JSON suggestion bundle the UI can prefill onto the pipeline form."""
    profile = build_profile(structured_resume)
    primary = profile["primary_intent"]
    secondary = profile.get("secondary_intent")
    is_generalist = profile.get("is_generalist", False)
    confidence = profile.get("intent_confidence", 0.0)

    # Authoritative seed from the intent taxonomy. Gemini may extend but
    # cannot remove these — we restore them after the LLM call.
    seed_titles: List[str] = list(profile["target_titles"])
    seed_phrases: List[str] = list(profile["keyword_phrases"])

    # Generic SWE safety net only for early-career / generalist profiles.
    add_generalist = is_generalist or profile.get("experience_years", 0) <= 2

    primary_label = INTENTS[primary]["label"]
    secondary_label = INTENTS[secondary]["label"] if secondary else None

    persona_hint = primary_label
    if secondary_label:
        persona_hint = f"{primary_label} (with secondary focus on {secondary_label})"

    slim = _resume_summary(structured_resume)
    prompt = (
        "You are a senior tech recruiter helping a candidate craft search filters "
        "for a daily job-hunt pipeline that scrapes LinkedIn (keyword search URLs) "
        "and Workday (titleSearch[]).\n\n"
        f"DETECTED PRIMARY INTENT: {primary_label} (confidence {confidence})\n"
        + (f"DETECTED SECONDARY INTENT: {secondary_label}\n" if secondary_label else "")
        + f"CANDIDATE PROFILE (JSON):\n{slim}\n\n"
        f"SEED TITLES (you MUST keep all of these and may add more):\n{seed_titles}\n"
        f"SEED KEYWORD PHRASES:\n{seed_phrases}\n\n"
        "Filter generation rules:\n"
        f"  1. The candidate's primary domain is {primary_label}. Filters MUST prioritise "
        "titles for that domain. Do NOT replace them with generic SWE titles.\n"
        + (
            "  2. Early-career / generalist candidate — also include the generic SWE "
            "safety net (Software Engineer, New Grad SWE, etc.) at the END so the "
            "specialist titles still rank first.\n"
            if add_generalist
            else "  2. This is a specialist candidate — DO NOT add generic SWE titles. "
            "They will dilute the daily feed with low-relevance roles.\n"
        )
        + (
            f"  3. Hybrid candidate — also include 5-10 titles for the secondary domain ({secondary_label}).\n"
            if secondary_label
            else "  3. Single-focus candidate — keep all titles inside the primary domain.\n"
        )
        + "  4. Each title MUST be anchored to a software/engineering domain word so a "
        'generic "New Grad" search doesn\'t pull non-tech roles.\n'
        '  5. Include early-career variants ("Junior", "Associate", "New Grad", "I", "II", "Graduate") '
        "where appropriate.\n\n"
        "Produce ONE JSON object with these fields:\n"
        '  - "headline": short one-line candidate persona summary.\n'
        '  - "rationale": 1-2 sentences justifying the suggested filters.\n'
        '  - "linkedin_keyword_sets": 5-8 keyword phrases (3-6 words each) — must START '
        "with the SEED KEYWORD PHRASES, then add 2-4 tail variants.\n"
        '  - "workday_titles": 25-50 job titles — must INCLUDE every SEED TITLE plus '
        "additional persona-specific variants.\n"
        '  - "custom_role_terms": 5-10 single keyword terms (1-2 words each) covering '
        "adjacent specializations the candidate could realistically apply for.\n"
        '  - "past_days": integer 1-7 — how stale to allow postings. Use 1 for active applicants.\n'
        '  - "preset_tags": 1-3 short labels classifying the candidate '
        '(e.g., ["cloud-devops","ai-ml","backend","frontend","fullstack","data","security","mobile"]).\n\n'
        "Return ONLY the JSON object, no commentary."
    )
    raw = gemini_json(prompt=prompt, model=GEMINI_FLASH, temperature=0.35, schema=_SUGGESTION_SCHEMA)
    coerced = _coerce(raw)

    # Belt-and-braces: ensure the deterministic seed is always present, even if
    # the model shaved it off. Seed wins on order — specialist titles first.
    coerced["workday_titles"] = _merge_preserving_order(seed_titles, coerced["workday_titles"])
    coerced["linkedin_keyword_sets"] = _merge_preserving_order(
        seed_phrases, coerced["linkedin_keyword_sets"]
    )

    # Append the SWE safety net at the END (lowest priority) for early-career
    # / generalist profiles. For specialists this list stays untouched.
    if add_generalist:
        coerced["workday_titles"] = _merge_preserving_order(
            coerced["workday_titles"], GENERIC_SWE_TITLES
        )

    coerced["workday_titles"] = coerced["workday_titles"][:60]
    coerced["linkedin_keyword_sets"] = coerced["linkedin_keyword_sets"][:8]

    # Always emit the detected intent in preset_tags so the UI can highlight it.
    primary_tag = _preset_tag_for_intent(primary)
    if primary_tag not in coerced["preset_tags"]:
        coerced["preset_tags"] = [primary_tag] + coerced["preset_tags"]
    if secondary:
        sec_tag = _preset_tag_for_intent(secondary)
        if sec_tag not in coerced["preset_tags"]:
            coerced["preset_tags"].append(sec_tag)
    coerced["preset_tags"] = coerced["preset_tags"][:5]

    # Echo the resolved profile so the UI / client can show "we detected: X" and
    # so downstream callers (run_pipeline) can avoid re-deriving it.
    coerced["intent"] = {
        "primary": primary,
        "primary_label": primary_label,
        "secondary": secondary,
        "secondary_label": secondary_label,
        "confidence": confidence,
        "is_generalist": is_generalist,
    }
    return coerced


def _merge_preserving_order(first: List[str], second: List[str]) -> List[str]:
    """Concatenate two string lists, dedup case-insensitively, keep first's order."""
    seen: set = set()
    out: List[str] = []
    for item in list(first) + list(second):
        s = (item or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


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
