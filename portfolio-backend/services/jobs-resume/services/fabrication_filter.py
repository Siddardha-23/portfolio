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
from typing import Any, Dict

from schemas.resume_schemas import build_resume_text
from utils.keyword_normalizer import get_all_forms

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
