"""
Integrity Guard — deterministic post-tailor validation and correction.

Runs AFTER Gemini returns a tailored resume and AFTER schema validation.
Compares the tailored output against the original parsed resume to enforce:

  1. Immutable fields (contact, experience facts, education facts) are unchanged
  2. No hallucinated experience or project entries
  3. Project generation rules (max 1 if original had none)
  4. Experience count matches original

Pure Python, zero AI calls, stateless.
"""
import copy
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Immutable field definitions
# ---------------------------------------------------------------------------

IMMUTABLE_CONTACT_FIELDS = ("name", "email", "phone", "linkedin", "github")
IMMUTABLE_EXPERIENCE_FIELDS = ("company", "title", "dates", "location")
IMMUTABLE_EDUCATION_FIELDS = ("degree", "institution", "dates", "location", "gpa", "coursework")


# ---------------------------------------------------------------------------
# Report dataclass
# ---------------------------------------------------------------------------

@dataclass
class IntegrityReport:
    """Captures everything detected and fixed by the integrity guard."""
    immutable_overwrites: List[str] = field(default_factory=list)
    hallucinated_experience: List[Dict] = field(default_factory=list)
    hallucinated_projects: List[Dict] = field(default_factory=list)
    missing_experience_reinjected: List[Dict] = field(default_factory=list)
    experience_count_mismatch: bool = False
    project_cap_enforced: bool = False
    original_experience_count: int = 0
    tailored_experience_count: int = 0
    severity: str = "clean"  # "clean", "auto_fixed", "needs_retry"


# ---------------------------------------------------------------------------
# Matching helpers
# ---------------------------------------------------------------------------

def _exp_key(entry: Dict[str, Any]) -> Tuple[str, str]:
    """Build a matching key from an experience entry: (company, title) lowered."""
    return (
        entry.get("company", "").lower().strip(),
        entry.get("title", "").lower().strip(),
    )


def _edu_key(entry: Dict[str, Any]) -> Tuple[str, str]:
    """Build a matching key from an education entry: (institution, degree) lowered."""
    return (
        entry.get("institution", "").lower().strip(),
        entry.get("degree", "").lower().strip(),
    )


def _proj_key(entry: Dict[str, Any]) -> str:
    """Build a matching key from a project entry: name lowered."""
    return entry.get("name", "").lower().strip()


def _match_entries(
    original_list: List[Dict],
    tailored_list: List[Dict],
    key_fn,
) -> Tuple[List[Tuple[Dict, Dict]], List[Dict], List[Dict]]:
    """Match tailored entries to original entries by a key function.

    Returns:
        matched: list of (original_entry, tailored_entry) pairs
        unmatched_tailored: tailored entries with no original match (hallucinated)
        missing_original: original entries not found in tailored (dropped by AI)
    """
    # Build a map from key -> list of original entries (handles duplicates)
    orig_map: Dict[Any, List[Dict]] = {}
    for entry in original_list:
        k = key_fn(entry)
        orig_map.setdefault(k, []).append(entry)

    matched: List[Tuple[Dict, Dict]] = []
    unmatched_tailored: List[Dict] = []

    for t_entry in tailored_list:
        k = key_fn(t_entry)
        if k in orig_map and orig_map[k]:
            o_entry = orig_map[k].pop(0)
            matched.append((o_entry, t_entry))
        else:
            unmatched_tailored.append(t_entry)

    # Remaining original entries that were never matched
    missing_original = [e for entries in orig_map.values() for e in entries]
    return matched, unmatched_tailored, missing_original


# ---------------------------------------------------------------------------
# IntegrityGuard
# ---------------------------------------------------------------------------

class IntegrityGuard:
    """Post-tailor deterministic integrity enforcement.

    All methods are pure — no Gemini calls, no side effects beyond the
    returned corrected dict and report.
    """

    def enforce(
        self,
        original: Dict[str, Any],
        tailored: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], IntegrityReport]:
        """Full integrity pipeline.

        Returns (corrected_tailored, report).
        The corrected dict is safe to render/score/return to the client.
        """
        tailored = copy.deepcopy(tailored)
        report = IntegrityReport()

        report.original_experience_count = len(original.get("experience", []))
        report.tailored_experience_count = len(tailored.get("experience", []))

        logger.warning(
            "IntegrityGuard.enforce ENTRY: original_projects=%d %s, tailored_projects=%d %s",
            len(original.get("projects", [])),
            [p.get("name", "?") for p in original.get("projects", [])],
            len(tailored.get("projects", [])),
            [p.get("name", "?") for p in tailored.get("projects", [])],
        )

        # Step 1: Force immutable fields
        tailored, overwrites = self.force_immutable_fields(original, tailored)
        report.immutable_overwrites = overwrites

        # Step 2: Detect and remove hallucinated entries
        tailored, hall_exp, hall_proj, reinjected = self.detect_hallucinations(
            original, tailored
        )
        report.hallucinated_experience = hall_exp
        report.hallucinated_projects = hall_proj
        report.missing_experience_reinjected = reinjected

        # Step 3: Enforce project generation rules
        tailored, cap_enforced = self.enforce_project_rules(original, tailored)
        report.project_cap_enforced = cap_enforced

        # Step 4: Force certifications to mirror the ORIGINAL parsed resume.
        # The parser is the single source of truth for certifications (its
        # prompt forbids fabrication). The tailor must NEITHER drop nor
        # invent certs — preserve them verbatim from the source.
        original_certs = original.get("certifications") or []
        tailored["certifications"] = [
            c for c in original_certs if isinstance(c, str) and c.strip()
        ]

        # Step 5: Check experience count
        report.experience_count_mismatch = (
            len(tailored.get("experience", []))
            != len(original.get("experience", []))
        )

        # Determine severity
        report.severity = self._classify_severity(report)

        logger.warning(
            "IntegrityGuard.enforce EXIT: severity=%s, final_tailored_projects=%d %s, hallucinated_proj=%d",
            report.severity,
            len(tailored.get("projects", [])),
            [p.get("name", "?") for p in tailored.get("projects", [])],
            len(report.hallucinated_projects),
        )

        if report.severity != "clean":
            logger.warning(
                "IntegrityGuard report: severity=%s overwrites=%d "
                "hallucinated_exp=%d hallucinated_proj=%d reinjected=%d cap=%s",
                report.severity,
                len(report.immutable_overwrites),
                len(report.hallucinated_experience),
                len(report.hallucinated_projects),
                len(report.missing_experience_reinjected),
                report.project_cap_enforced,
            )

        return tailored, report

    # ------------------------------------------------------------------
    # 1. Immutable field enforcement
    # ------------------------------------------------------------------

    def force_immutable_fields(
        self,
        original: Dict[str, Any],
        tailored: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], List[str]]:
        """Overwrite immutable fields in tailored with original values.

        Returns (tailored, list_of_overwritten_field_paths).
        """
        overwrites: List[str] = []

        # --- Contact ---
        orig_contact = original.get("contact", {})
        tail_contact = tailored.get("contact", {})
        for f in IMMUTABLE_CONTACT_FIELDS:
            orig_val = orig_contact.get(f, "")
            tail_val = tail_contact.get(f, "")
            if tail_val != orig_val:
                overwrites.append(f"contact.{f}")
                tail_contact[f] = orig_val
        tailored["contact"] = tail_contact

        # --- Experience (matched by company+title tuple) ---
        orig_exp = original.get("experience", [])
        tail_exp = tailored.get("experience", [])
        matched, _, _ = _match_entries(orig_exp, tail_exp, _exp_key)
        for o_entry, t_entry in matched:
            for f in IMMUTABLE_EXPERIENCE_FIELDS:
                orig_val = o_entry.get(f, "")
                tail_val = t_entry.get(f, "")
                if tail_val != orig_val:
                    overwrites.append(
                        f"experience[{o_entry.get('company', '')}].{f}"
                    )
                    t_entry[f] = orig_val

        # --- Education (matched by institution+degree tuple) ---
        orig_edu = original.get("education", [])
        tail_edu = tailored.get("education", [])
        matched_edu, unmatched_edu, missing_edu = _match_entries(
            orig_edu, tail_edu, _edu_key
        )
        for o_entry, t_entry in matched_edu:
            for f in IMMUTABLE_EDUCATION_FIELDS:
                orig_val = o_entry.get(f, "")
                tail_val = t_entry.get(f, "")
                if tail_val != orig_val:
                    overwrites.append(
                        f"education[{o_entry.get('institution', '')}].{f}"
                    )
                    t_entry[f] = orig_val

        # If AI dropped education entries, re-inject from original
        if missing_edu:
            for edu in missing_edu:
                tailored.setdefault("education", []).append(edu)

        # If AI invented education entries, remove them
        if unmatched_edu:
            valid_keys = {_edu_key(e) for e in orig_edu}
            tailored["education"] = [
                e for e in tailored.get("education", [])
                if _edu_key(e) in valid_keys
            ]

        # Clean degree fields: strip baked-in dates and duplicates
        for edu in tailored.get("education", []):
            degree = edu.get("degree", "")
            if degree and "|" in degree:
                segments = [s.strip() for s in degree.split("|")]
                cleaned = [
                    s for s in segments
                    if not re.match(
                        r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4}|\d{1,2}/\d{4})',
                        s, re.IGNORECASE,
                    )
                ]
                # Deduplicate
                seen = set()
                unique = []
                for s in cleaned:
                    if s.lower() not in seen:
                        seen.add(s.lower())
                        unique.append(s)
                edu["degree"] = " | ".join(unique) if unique else degree

        return tailored, overwrites

    # ------------------------------------------------------------------
    # 2. Hallucination detection
    # ------------------------------------------------------------------

    def detect_hallucinations(
        self,
        original: Dict[str, Any],
        tailored: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], List[Dict], List[Dict], List[Dict]]:
        """Detect and remove hallucinated experience and project entries.

        Returns (tailored, hallucinated_exp, hallucinated_proj, reinjected_exp).
        """
        # --- Experience ---
        orig_exp = original.get("experience", [])
        tail_exp = tailored.get("experience", [])

        matched, hallucinated_exp, missing_exp = _match_entries(
            orig_exp, tail_exp, _exp_key
        )

        # Rebuild experience list: matched entries (tailored version) + re-injected missing
        rebuilt_exp = [t_entry for _, t_entry in matched]
        for missing in missing_exp:
            rebuilt_exp.append(copy.deepcopy(missing))

        tailored["experience"] = rebuilt_exp

        # --- Projects: ALWAYS strip projects whose name doesn't match a name
        # in the ORIGINAL resume. Previously this was gated on
        # `if orig_projects:` — meaning candidates with zero parsed projects
        # got ZERO stripping, and Claude's invented projects (3 per call)
        # survived into ContentAugmenter, which then saw `len(projects)=3`
        # and skipped Phase 1 project generation entirely. The downstream
        # _overflow_trim removed 2 of the 3 invented projects to fit the
        # page, leaving the user with 1 random invented project and zero
        # backend-generated aligned ones.
        # ContentAugmenter adds its generated projects AFTER this guard
        # runs (guard runs inside ResumeTailor.tailor(), augmenter runs
        # after), so augmenter-generated projects are never stripped here.
        hallucinated_proj: List[Dict] = []
        orig_projects = original.get("projects", [])
        orig_proj_keys = {_proj_key(p) for p in orig_projects}  # may be empty set
        tail_projects = tailored.get("projects", [])
        valid_projects = []
        for p in tail_projects:
            if _proj_key(p) in orig_proj_keys:
                valid_projects.append(p)
            else:
                hallucinated_proj.append(p)
        tailored["projects"] = valid_projects

        return tailored, hallucinated_exp, hallucinated_proj, missing_exp

    # ------------------------------------------------------------------
    # 3. Project generation rules
    # ------------------------------------------------------------------

    def enforce_project_rules(
        self,
        original: Dict[str, Any],
        tailored: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], bool]:
        """Enforce project generation limits.

        - If original has projects: re-inject any dropped originals.
        - Universal cap: max 3 total projects (original + generated).
          When trimming, originals are kept first, generated are trimmed.

        Returns (tailored, cap_enforced).
        """
        orig_projects = original.get("projects", [])
        tail_projects = tailored.get("projects", [])
        cap_enforced = False

        if orig_projects:
            # Re-inject any original projects that were dropped
            tail_proj_keys = {_proj_key(p) for p in tail_projects}
            for op in orig_projects:
                if _proj_key(op) not in tail_proj_keys:
                    tail_projects.append(copy.deepcopy(op))

        # Universal cap: max 3 total projects (original + generated)
        if len(tail_projects) > 3:
            if orig_projects:
                # Keep originals first, trim generated
                orig_keys = {_proj_key(p) for p in orig_projects}
                originals = [p for p in tail_projects if _proj_key(p) in orig_keys]
                generated = [p for p in tail_projects if _proj_key(p) not in orig_keys]
                tail_projects = originals + generated[:max(0, 3 - len(originals))]
            else:
                tail_projects = tail_projects[:3]
            cap_enforced = True

        tailored["projects"] = tail_projects
        return tailored, cap_enforced

    # ------------------------------------------------------------------
    # Severity classification
    # ------------------------------------------------------------------

    @staticmethod
    def _classify_severity(report: IntegrityReport) -> str:
        """Classify the overall severity of violations found."""
        if report.hallucinated_experience:
            return "needs_retry"

        # Persistent count mismatch after re-injection means data was lost
        if report.experience_count_mismatch:
            return "needs_retry"

        has_any_fix = (
            report.immutable_overwrites
            or report.hallucinated_projects
            or report.missing_experience_reinjected
            or report.project_cap_enforced
        )

        if has_any_fix:
            return "auto_fixed"

        return "clean"
