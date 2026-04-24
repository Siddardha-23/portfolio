"""
Single source of truth for tool registration.

Each tool is paired with:
  - the Python callable
  - the specialist that "owns" it (drives the visible multi-agent UX)
  - a Gemini FunctionDeclaration so the orchestrator can natively call it

Specialists:
  curator     — searches the knowledge base, surfaces evidence
  builder     — live activity, GitHub commits, cloud diary
  analyst     — JD fit, skill gap analysis
  concierge   — intros, contact, scheduling
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Tuple

from . import concierge_tools, diary_tools, fit_tools, github_tools, portfolio_tools

logger = logging.getLogger(__name__)


def _decl(name: str, description: str, properties: Dict, required: List[str] = None) -> Dict:
    """Build a Gemini-compatible FunctionDeclaration as a plain dict."""
    return {
        "name": name,
        "description": description,
        "parameters": {
            "type": "OBJECT",
            "properties": properties,
            "required": required or [],
        },
    }


# (callable, specialist_id, declaration)
TOOL_REGISTRY: Dict[str, Tuple[Callable[..., Dict], str, Dict]] = {
    "search_my_work": (
        portfolio_tools.search_my_work,
        "curator",
        _decl(
            name="search_my_work",
            description=(
                "Semantic search over Harshith's portfolio (projects, experience, skills, education). "
                "Use for ANY question about what he has built, used, or learned."
            ),
            properties={
                "query": {"type": "STRING", "description": "Free-text question or keywords."},
                "top_k": {"type": "INTEGER", "description": "Number of results (1-8). Default 4."},
                "kind": {
                    "type": "STRING",
                    "description": "Optional filter: project | experience | skill | education | certification.",
                },
            },
            required=["query"],
        ),
    ),
    "explain_project": (
        portfolio_tools.explain_project,
        "curator",
        _decl(
            name="explain_project",
            description="Return the full body of a single project or experience by name or id.",
            properties={
                "name": {"type": "STRING", "description": "Project / experience name or id."},
            },
            required=["name"],
        ),
    ),
    "show_evidence": (
        portfolio_tools.show_evidence,
        "curator",
        _decl(
            name="show_evidence",
            description=(
                "Return concrete evidence (project links + measurable impact) for a claimed skill. "
                "Use when a recruiter asks 'have you actually done X?' or 'show me proof of Y'."
            ),
            properties={
                "skill": {"type": "STRING", "description": "Skill name (e.g. 'terraform', 'gemini')."},
            },
            required=["skill"],
        ),
    ),
    "list_skills": (
        portfolio_tools.list_skills,
        "curator",
        _decl(
            name="list_skills",
            description="Return the full de-duplicated list of skills Harshith claims.",
            properties={},
        ),
    ),
    "get_contact": (
        portfolio_tools.get_contact,
        "concierge",
        _decl(
            name="get_contact",
            description="Return Harshith's primary contact channels (email, LinkedIn, GitHub).",
            properties={},
        ),
    ),
    "whats_new": (
        github_tools.whats_new,
        "builder",
        _decl(
            name="whats_new",
            description=(
                "Recent public GitHub activity (commits, PRs, releases). "
                "Use for 'what is he working on lately?' or 'is he still active?'"
            ),
            properties={
                "days": {"type": "INTEGER", "description": "Lookback days (1-60). Default 14."},
                "limit": {"type": "INTEGER", "description": "Max events (1-20). Default 8."},
            },
        ),
    ),
    "repo_snapshot": (
        github_tools.repo_snapshot,
        "builder",
        _decl(
            name="repo_snapshot",
            description="Recently-pushed public repos with names, languages, and last-push timestamps.",
            properties={
                "limit": {"type": "INTEGER", "description": "Max repos (1-12). Default 6."},
            },
        ),
    ),
    "get_cloud_diary": (
        diary_tools.get_cloud_diary,
        "builder",
        _decl(
            name="get_cloud_diary",
            description=(
                "Return persisted weekly Cloud Diary entries (auto-generated summaries of what "
                "Harshith shipped). Use for 'what's been built recently' overview questions."
            ),
            properties={
                "limit": {"type": "INTEGER", "description": "Number of entries (1-20). Default 5."},
            },
        ),
    ),
    "am_i_a_fit": (
        fit_tools.am_i_a_fit,
        "analyst",
        _decl(
            name="am_i_a_fit",
            description=(
                "Match a pasted job description to Harshith's portfolio. Returns an honest "
                "score 0-100, matched skills, gap skills, and the strongest evidence to read."
            ),
            properties={
                "jd_text": {"type": "STRING", "description": "Pasted job description text."},
            },
            required=["jd_text"],
        ),
    ),
    "book_chat": (
        concierge_tools.book_chat,
        "concierge",
        _decl(
            name="book_chat",
            description=(
                "Persist a recruiter intro request so Harshith can reply within 24 hours. "
                "Only call after the recruiter explicitly asks to be connected AND has provided "
                "their email."
            ),
            properties={
                "recruiter_email": {"type": "STRING", "description": "Reply-to email."},
                "context": {"type": "STRING", "description": "Brief note about role / company."},
                "preferred_time": {"type": "STRING", "description": "Optional preferred time slot."},
                "company": {"type": "STRING", "description": "Optional company name."},
            },
            required=["recruiter_email", "context"],
        ),
    ),
    "compose_intro": (
        concierge_tools.compose_intro,
        "concierge",
        _decl(
            name="compose_intro",
            description="Draft a short intro email a recruiter can copy/send to Harshith.",
            properties={
                "role": {"type": "STRING", "description": "Role title (e.g., 'Cloud Engineer Intern')."},
                "highlights": {"type": "STRING", "description": "Optional 1-2 things they liked."},
            },
            required=["role"],
        ),
    ),
}


SPECIALIST_META = {
    "curator": {
        "label": "Curator",
        "tagline": "knows the portfolio cold",
        "tone": "amber",
    },
    "builder": {
        "label": "Builder",
        "tagline": "tracks what's shipping right now",
        "tone": "emerald",
    },
    "analyst": {
        "label": "Analyst",
        "tagline": "scores fit honestly",
        "tone": "violet",
    },
    "concierge": {
        "label": "Concierge",
        "tagline": "handles intros and follow-ups",
        "tone": "rose",
    },
}


def gemini_tools() -> List[Dict]:
    """Return the FunctionDeclaration list for the Gemini config.tools[0]."""
    return [{"function_declarations": [d for _, _, d in TOOL_REGISTRY.values()]}]


def dispatch(name: str, args: Dict[str, Any]) -> Dict:
    """Invoke a tool by name. Always returns a dict; never raises."""
    entry = TOOL_REGISTRY.get(name)
    if not entry:
        return {"ok": False, "error": f"Unknown tool '{name}'"}
    fn, _, _ = entry
    try:
        return fn(**(args or {}))
    except TypeError as exc:
        return {"ok": False, "error": f"Bad arguments for {name}: {exc}"}
    except Exception as exc:
        logger.exception("Tool %s failed", name)
        return {"ok": False, "error": f"Tool '{name}' failed: {exc}"}


def get_tool_meta(name: str) -> Dict:
    entry = TOOL_REGISTRY.get(name)
    if not entry:
        return {"specialist": "orchestrator", "label": name}
    _, specialist, decl = entry
    return {
        "specialist": specialist,
        "specialist_label": SPECIALIST_META.get(specialist, {}).get("label", specialist),
        "specialist_tone": SPECIALIST_META.get(specialist, {}).get("tone", "slate"),
        "label": decl.get("name"),
        "description": decl.get("description", ""),
    }
