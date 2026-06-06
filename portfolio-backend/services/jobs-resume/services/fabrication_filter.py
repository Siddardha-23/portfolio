"""
Fabrication filter — deterministic guard for the ONE truly binary fabrication:
a certification the candidate does not hold.

Design principle: deterministic code handles only claims that need NO judgment.
A certification is exactly that — you either passed the exam or you didn't; there
is no "core concepts transfer" defense for a certificate. Everything else
(adjacent languages like C# for a Python dev, complementary tools for an analyst
or marketer, role-baseline skills) is a JUDGMENT call about defensibility, and
that judgment belongs to the tailoring model (the prompt's Defensibility test)
and the match-gap reporter — NOT to a regex or a hand-maintained word list. An
earlier version of this module tried to classify languages/products/baseline
skills deterministically and wrongly blocked defensible additions (e.g. C#); that
logic has been removed.

Used by:
  * resume_tailor._ensure_jd_skills_coverage — never auto-inject a JD-listed
    certification the candidate doesn't hold.
  * IntegrityGuard — strip a certification the model placed in the skills section
    (the back door around the certifications field).

Pure functions, no LLM calls.
"""
import re
from typing import Any, Dict, List, Set

from schemas.resume_schemas import build_resume_text
from utils.keyword_normalizer import get_all_forms, normalize_single

# A term is a certification claim if it self-identifies as one. Kept tight so
# generic phrasing doesn't over-trigger, but broad enough for the real patterns
# ("AWS Certified Solutions Architect", "Implementation Specialist
# Certification", "PMP Certification", "micro-certification").
_CERT_RE = re.compile(
    r"\b(?:certified|certification|certificate)\b"
    r"|\bimplementation specialist\b"
    r"|\bmicro[- ]?cert(?:ified|ification)?\b",
    re.IGNORECASE,
)


def is_certification_claim(term: str) -> bool:
    """True if the term reads as a named certification rather than a skill."""
    if not term:
        return False
    return bool(_CERT_RE.search(term))


def _word_bounded(text_lower: str, form: str) -> bool:
    """Word-boundary-aware match (mirrors keyword_gap_engine._text_contains)."""
    if not form:
        return False
    if len(form) <= 2:
        return form in text_lower
    return re.search(
        r"(?<![a-zA-Z])" + re.escape(form) + r"(?![a-zA-Z])", text_lower
    ) is not None


def is_grounded(term: str, original_resume: Dict[str, Any]) -> bool:
    """True if any alias of `term` already appears in the base resume text.

    The base resume is the source of truth for what the candidate actually has.
    """
    if not term:
        return False
    haystack = build_resume_text(original_resume).lower()
    return any(_word_bounded(haystack, f) for f in get_all_forms(term))


def _cert_in_base(term: str, original_resume: Dict[str, Any]) -> bool:
    """True if `term` matches a certification listed in the base resume.

    Checks the structured `certifications` list directly (build_resume_text does
    NOT include it) with a tolerant word-overlap match, then falls back to
    general resume-text grounding for certs mentioned elsewhere.
    """
    term_l = term.lower().strip()
    base_certs = original_resume.get("certifications") or []
    for c in base_certs:
        if not isinstance(c, str):
            continue
        cl = c.lower().strip()
        if cl == term_l or cl in term_l or term_l in cl:
            return True
    return is_grounded(term, original_resume)


def is_fabricated_certification(term: str, original_resume: Dict[str, Any]) -> bool:
    """True iff `term` is a certification claim NOT present in the base resume.

    This is the only fabrication we block deterministically — it requires no
    judgment. Defensibility of skills/tools is left to the model.
    """
    if not term or not term.strip():
        return False
    return is_certification_claim(term) and not _cert_in_base(term, original_resume)


# ---------------------------------------------------------------------------
# Ungrounded-JD-skill detection (the keyword-stuffing fabrication)
# ---------------------------------------------------------------------------

# Broad, commodity DISCIPLINE terms anyone in the relevant role can defend.
# Used ONLY to PROTECT (never to block): even if a JD lists these and the base
# resume doesn't spell them out, they are safe to keep. Cross-profession and
# deliberately small. Matching is normalized + substring-tolerant.
GENERIC_DISCIPLINE: Set[str] = {
    # engineering
    "microservices", "rest apis", "rest api", "restful apis", "ci/cd",
    "object-oriented design", "object-oriented programming", "oop", "ood",
    "sdlc", "software development lifecycle", "full software development lifecycle",
    "agile", "scrum", "kanban", "version control", "unit testing",
    "distributed systems", "data structures", "algorithms", "debugging",
    "code review", "code reviews",
    # data / analytics
    "data analysis", "data visualization", "reporting", "dashboards",
    "requirements gathering", "documentation",
    # business / cross-functional
    "stakeholder management", "project management", "communication",
    "cross-functional collaboration", "process improvement",
}


def _normalize_tokens(text: str) -> Set[str]:
    """Lowercased alphanumeric token set for tolerant phrase comparison."""
    return set(re.findall(r"[a-z0-9+#]+", (text or "").lower()))


def _phrase_matches_jd(term: str, jd_required: List[str]) -> bool:
    """True if `term` matches a JD required-skill near-verbatim.

    Two ways to match, both alias-aware:
      1. Normalized canonical equality / alias overlap (handles "Postgres" ==
         "PostgreSQL", "K8s" == "Kubernetes").
      2. Token-subset: every significant token of the shorter phrase appears in
         the other (handles "Medical Device Software Development" ~ the JD's
         "medical device development" / "Medical Device Software Development").
    """
    term_forms = get_all_forms(term)
    term_tokens = _normalize_tokens(term)
    if not term_tokens:
        return False
    for req in jd_required:
        if not isinstance(req, str) or not req.strip():
            continue
        # 1. alias-aware equality
        if term_forms & get_all_forms(req):
            return True
        if normalize_single(term).lower() == normalize_single(req).lower():
            return True
        # 2. token-subset (ignore tiny filler tokens)
        req_tokens = _normalize_tokens(req)
        if not req_tokens:
            continue
        small, big = (
            (term_tokens, req_tokens)
            if len(term_tokens) <= len(req_tokens)
            else (req_tokens, term_tokens)
        )
        meaningful = {t for t in small if len(t) > 2}
        if meaningful and meaningful <= big:
            return True
    return False


def _is_generic_discipline(term: str) -> bool:
    """True only if the term *is* a generic discipline — not merely contains a
    generic word. 'Algorithms' is generic; 'Computational Geometry Algorithms'
    is a specific fabricated capability and must NOT be protected.
    """
    canon = normalize_single(term).lower().strip()
    if canon in GENERIC_DISCIPLINE:
        return True
    toks = _normalize_tokens(term)
    if not toks:
        return False
    # The term's FULL token set (including short, distinctive tokens like "qt",
    # "c++", "go") must be covered by a generic phrase. This protects variants
    # like "Object-Oriented Design (OOD)" while NOT protecting a specific phrase
    # such as "Qt Programming" whose distinctive "qt" token no generic covers.
    for g in GENERIC_DISCIPLINE:
        gtoks = _normalize_tokens(g)
        if gtoks and toks <= gtoks:
            return True
    return False


def is_ungrounded_jd_skill(
    term: str, original_resume: Dict[str, Any], jd_analysis: Dict[str, Any]
) -> bool:
    """True iff `term` is a JD required-skill phrase the candidate can't support.

    Fabrication signature (profession-agnostic): the skill is BOTH
      (a) absent from the base resume (not grounded), AND
      (b) a near-verbatim JD required-skill phrase,
    and is NOT a broad generic discipline anyone in the role can defend.

    This catches keyword-stuffing — the JD's requirement list pasted into the
    skills section ("CUDA", "Medical Device Software Development", "Salesforce",
    "Six Sigma") — for any field, without classifying the term's "type".
    """
    if not term or not term.strip():
        return False
    if _is_generic_discipline(term):
        return False
    if is_grounded(term, original_resume):
        return False
    jd_required = list((jd_analysis or {}).get("required_skills") or [])
    if not jd_required:
        return False
    return _phrase_matches_jd(term, jd_required)


# ---------------------------------------------------------------------------
# Non-skill detection (job titles / bare domains masquerading as skills)
# ---------------------------------------------------------------------------

# A skills-section entry that is really a JOB TITLE, not a skill. Trailing role
# nouns are the tell ("C++ Developer", "Software Engineer", "Data Analyst",
# "Solutions Architect", "Project Manager", "Implementation Specialist").
_JOB_TITLE_TAIL = re.compile(
    r"\b(developer|engineer|analyst|architect|manager|administrator|consultant|"
    r"specialist|scientist|designer|lead|director|intern|technician)s?\s*$",
    re.IGNORECASE,
)

# Bare DOMAIN / process phrases that describe an area of work, not a concrete
# skill ("Medical Device Software Development", "Full Software Development
# Lifecycle"). These end in a generic activity noun and contain a domain word.
_DOMAIN_TAIL = re.compile(
    r"\b(development|lifecycle|engineering|operations|management|administration)\s*"
    r"(\([^)]*\))?\s*$",
    re.IGNORECASE,
)
# Domain phrases are only stripped when they're long descriptive phrases (3+
# words) — short ones like "Software Development" or "Data Engineering" are
# legitimate skill-ish category fillers and are left alone.
_DOMAIN_MIN_WORDS = 3


def is_non_skill(term: str) -> bool:
    """True if `term` is a job title or bare domain phrase, not a real skill.

    Conservative — only fires on clear patterns so genuine skills are never
    dropped. Used by IntegrityGuard to clean items the model wrongly listed in
    the skills section (e.g. 'C++ Developer', 'Medical Device Software
    Development'). Generic disciplines (SDLC, OOD) are explicitly protected.
    """
    if not term or not term.strip():
        return False
    t = term.strip()
    if _is_generic_discipline(t):
        return False
    if _JOB_TITLE_TAIL.search(t):
        return True
    words = re.findall(r"[A-Za-z0-9+#]+", t)
    if len(words) >= _DOMAIN_MIN_WORDS and _DOMAIN_TAIL.search(t):
        return True
    return False
