"""
Portfolio-knowledge tools — owned by the Curator specialist.
These are pure reads against the in-process corpus.
"""
from __future__ import annotations

from typing import Dict, List

from knowledge_base import (
    CONTACT,
    all_skills,
    evidence_for_skill,
    find_by_title,
    search,
)


def search_my_work(query: str, top_k: int = 4, kind: str = "") -> Dict:
    """Semantic search over Harshith's portfolio corpus.

    Args:
        query: free-text question (e.g. "production kubernetes experience").
        top_k: max results to return (1-8).
        kind: optional filter — project | experience | skill | education | certification.
    """
    top_k = max(1, min(int(top_k or 4), 8))
    kind_norm = (kind or "").strip().lower() or None
    if kind_norm and kind_norm not in {
        "project", "experience", "skill", "education", "certification", "philosophy"
    }:
        kind_norm = None
    results = search(query or "", top_k=top_k, kind=kind_norm)
    return {
        "ok": True,
        "data": {"query": query, "results": results, "count": len(results)},
    }


def explain_project(name: str) -> Dict:
    """Return the full description of a single project / experience by name or id."""
    entry = find_by_title(name or "")
    if not entry:
        return {"ok": False, "error": f"No matching entry for '{name}'."}
    return {"ok": True, "data": entry}


def show_evidence(skill: str) -> Dict:
    """Return concrete evidence (project links + impact) backing a claimed skill."""
    skill_clean = (skill or "").strip()
    if not skill_clean:
        return {"ok": False, "error": "Skill name is required."}
    matches = evidence_for_skill(skill_clean)
    if not matches:
        return {
            "ok": True,
            "data": {
                "skill": skill_clean,
                "matches": [],
                "note": "No direct evidence found in the public portfolio for this skill yet.",
            },
        }
    return {"ok": True, "data": {"skill": skill_clean, "matches": matches}}


def list_skills() -> Dict:
    """Return all skill tags Harshith claims (de-duplicated)."""
    return {"ok": True, "data": {"skills": all_skills()}}


def get_contact() -> Dict:
    """Return primary contact channels."""
    return {"ok": True, "data": CONTACT}
