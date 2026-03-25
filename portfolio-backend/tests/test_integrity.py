"""
Tests for the IntegrityGuard — verifies immutable field protection,
hallucination detection, project generation rules, and severity classification.

All tests are pure unit tests with zero AI calls or network dependencies.
"""
import copy
import sys
import os

# Ensure the backend package root is on the path so imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.integrity_guard import IntegrityGuard


# ======================================================================
# 1. Immutable Field Protection
# ======================================================================

class TestImmutableFieldProtection:

    def test_contact_fields_forced_back(self, original_resume, tampered_contact):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tampered_contact)

        assert corrected["contact"]["name"] == "Alice Johnson"
        assert corrected["contact"]["email"] == "alice@example.com"
        assert corrected["contact"]["phone"] == "555-0100"
        assert corrected["contact"]["linkedin"] == "linkedin.com/in/alicejohnson"
        assert corrected["contact"]["github"] == "github.com/alicejohnson"
        assert len(report.immutable_overwrites) == 3  # name, email, phone

    def test_experience_facts_preserved(self, original_resume, tampered_experience_facts):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tampered_experience_facts)

        # The AI changed company from "Acme Corp" to "Google", but the guard
        # matches by (company, title) tuple. Since ("google", "software engineer")
        # does not match any original, it will be treated as hallucinated and
        # the original entry re-injected. Verify original facts are present.
        companies = [e["company"] for e in corrected["experience"]]
        assert "Acme Corp" in companies
        assert "StartupXYZ" in companies
        assert len(corrected["experience"]) == 2

    def test_experience_immutable_fields_when_match_exists(self, original_resume):
        """When AI keeps same company/title but changes dates/location."""
        tailored = copy.deepcopy(original_resume)
        tailored["experience"][0]["dates"] = "WRONG DATES"
        tailored["experience"][0]["location"] = "WRONG LOCATION"

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        assert corrected["experience"][0]["dates"] == "Jan 2022 – Present"
        assert corrected["experience"][0]["location"] == "San Francisco, CA"
        assert any("dates" in o for o in report.immutable_overwrites)
        assert any("location" in o for o in report.immutable_overwrites)

    def test_education_facts_preserved(self, original_resume, tampered_education):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tampered_education)

        # AI changed institution to MIT and degree to Ph.D — treated as
        # unmatched (hallucinated) since key doesn't match. Original re-injected.
        institutions = [e["institution"] for e in corrected["education"]]
        assert "UC Berkeley" in institutions

    def test_education_immutable_fields_when_match_exists(self, original_resume):
        """When AI keeps same institution/degree but changes gpa."""
        tailored = copy.deepcopy(original_resume)
        tailored["education"][0]["gpa"] = "4.0"

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        assert corrected["education"][0]["gpa"] == "3.8"
        assert any("gpa" in o for o in report.immutable_overwrites)

    def test_clean_resume_no_overwrites(self, original_resume, clean_tailored):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, clean_tailored)

        assert len(report.immutable_overwrites) == 0
        assert report.severity == "clean"

    def test_bullets_are_mutable(self, original_resume, clean_tailored):
        """Bullets can be rewritten — this should NOT trigger overwrites."""
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, clean_tailored)

        # Verify the rewritten bullets are preserved (not overwritten)
        assert "Engineered" in corrected["experience"][0]["bullets"][0]
        assert len(report.immutable_overwrites) == 0


# ======================================================================
# 2. Hallucination Detection
# ======================================================================

class TestHallucinationDetection:

    def test_invented_experience_removed(self, original_resume, hallucinated_experience):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, hallucinated_experience)

        assert len(corrected["experience"]) == 2
        assert len(report.hallucinated_experience) == 1
        assert report.hallucinated_experience[0]["company"] == "GoogleFake Inc"

    def test_dropped_experience_reinjected(self, original_resume, dropped_experience):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, dropped_experience)

        assert len(corrected["experience"]) == 2
        companies = [e["company"] for e in corrected["experience"]]
        assert "StartupXYZ" in companies
        assert len(report.missing_experience_reinjected) == 1

    def test_invented_project_removed_when_original_has_projects(
        self, original_resume, hallucinated_project
    ):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, hallucinated_project)

        assert len(corrected["projects"]) == 1
        assert corrected["projects"][0]["name"] == "CloudDeploy"
        assert len(report.hallucinated_projects) == 1
        assert report.hallucinated_projects[0]["name"] == "FakeProject"

    def test_multiple_hallucinated_experiences(self, original_resume):
        """AI invents two experience entries."""
        tailored = copy.deepcopy(original_resume)
        tailored["experience"].extend([
            {"title": "CTO", "company": "FakeCo1", "location": "", "dates": "", "type": "", "bullets": []},
            {"title": "VP", "company": "FakeCo2", "location": "", "dates": "", "type": "", "bullets": []},
        ])

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        assert len(corrected["experience"]) == 2
        assert len(report.hallucinated_experience) == 2


# ======================================================================
# 3. Project Generation Limits
# ======================================================================

class TestProjectGenerationLimits:

    def test_zero_original_allows_one_generated(self, original_resume_no_projects):
        tailored = copy.deepcopy(original_resume_no_projects)
        tailored["projects"] = [
            {"name": "Generated", "dates": "2023", "bullets": ["Built X"], "tech": "Python"},
        ]

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume_no_projects, tailored)

        assert len(corrected["projects"]) == 1
        assert not report.project_cap_enforced

    def test_zero_original_caps_at_one(self, original_resume_no_projects, excess_generated_projects):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(
            original_resume_no_projects, excess_generated_projects
        )

        assert len(corrected["projects"]) == 1
        assert corrected["projects"][0]["name"] == "GenProject1"
        assert report.project_cap_enforced

    def test_original_projects_preserved_as_subset(self, original_resume, hallucinated_project):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, hallucinated_project)

        assert len(corrected["projects"]) == 1
        assert corrected["projects"][0]["name"] == "CloudDeploy"

    def test_dropped_project_reinjected(self, original_resume):
        """AI drops the only original project."""
        tailored = copy.deepcopy(original_resume)
        tailored["projects"] = []

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        assert len(corrected["projects"]) == 1
        assert corrected["projects"][0]["name"] == "CloudDeploy"

    def test_zero_projects_no_generation_is_fine(self, original_resume_no_projects):
        """If original had no projects and AI generates none, that's OK."""
        tailored = copy.deepcopy(original_resume_no_projects)
        tailored["projects"] = []

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume_no_projects, tailored)

        assert len(corrected["projects"]) == 0
        assert not report.project_cap_enforced


# ======================================================================
# 4. Experience Count Validation
# ======================================================================

class TestExperienceCountValidation:

    def test_count_matches_after_hallucination_removal(
        self, original_resume, hallucinated_experience
    ):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, hallucinated_experience)

        assert len(corrected["experience"]) == len(original_resume["experience"])
        assert not report.experience_count_mismatch

    def test_count_matches_after_reinjection(self, original_resume, dropped_experience):
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, dropped_experience)

        assert len(corrected["experience"]) == len(original_resume["experience"])
        assert not report.experience_count_mismatch


# ======================================================================
# 5. Certifications Enforcement
# ======================================================================

class TestCertificationsEnforcement:

    def test_certifications_always_empty(self, original_resume):
        tailored = copy.deepcopy(original_resume)
        tailored["certifications"] = ["AWS Certified Solutions Architect", "PMP"]

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        assert corrected.get("certifications", []) == []

    def test_missing_certifications_key_defaults_empty(self, original_resume):
        tailored = copy.deepcopy(original_resume)
        # No certifications key at all
        tailored.pop("certifications", None)

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        assert corrected.get("certifications", []) == []


# ======================================================================
# 6. Severity Classification
# ======================================================================

class TestSeverityClassification:

    def test_clean_severity(self, original_resume, clean_tailored):
        guard = IntegrityGuard()
        _, report = guard.enforce(original_resume, clean_tailored)
        assert report.severity == "clean"

    def test_auto_fixed_for_contact_change(self, original_resume, tampered_contact):
        guard = IntegrityGuard()
        _, report = guard.enforce(original_resume, tampered_contact)
        assert report.severity == "auto_fixed"

    def test_auto_fixed_for_hallucinated_project(self, original_resume, hallucinated_project):
        guard = IntegrityGuard()
        _, report = guard.enforce(original_resume, hallucinated_project)
        assert report.severity == "auto_fixed"

    def test_needs_retry_for_hallucinated_experience(
        self, original_resume, hallucinated_experience
    ):
        guard = IntegrityGuard()
        _, report = guard.enforce(original_resume, hallucinated_experience)
        assert report.severity == "needs_retry"

    def test_auto_fixed_for_dropped_experience(self, original_resume, dropped_experience):
        guard = IntegrityGuard()
        _, report = guard.enforce(original_resume, dropped_experience)
        assert report.severity == "auto_fixed"

    def test_auto_fixed_for_project_cap(
        self, original_resume_no_projects, excess_generated_projects
    ):
        guard = IntegrityGuard()
        _, report = guard.enforce(
            original_resume_no_projects, excess_generated_projects
        )
        assert report.severity == "auto_fixed"


# ======================================================================
# 7. Edge Cases
# ======================================================================

class TestEdgeCases:

    def test_empty_original_resume(self):
        """Guard handles an empty original gracefully."""
        original = {
            "contact": {"name": "", "email": "", "phone": "", "linkedin": "", "github": ""},
            "summary": "",
            "skills": {},
            "experience": [],
            "education": [],
            "projects": [],
        }
        tailored = copy.deepcopy(original)

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original, tailored)

        assert report.severity == "clean"
        assert len(corrected["experience"]) == 0

    def test_experience_reordered_by_ai(self, original_resume):
        """AI reorders experience — should still match correctly."""
        tailored = copy.deepcopy(original_resume)
        tailored["experience"] = list(reversed(tailored["experience"]))
        # Rewrite bullets to simulate tailoring
        tailored["experience"][0]["bullets"] = ["Rewritten intern bullet"]
        tailored["experience"][1]["bullets"] = ["Rewritten engineer bullet"]

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        # All immutable fields preserved, bullets allowed to change
        assert len(corrected["experience"]) == 2
        assert len(report.immutable_overwrites) == 0
        assert report.severity == "clean"

    def test_case_insensitive_matching(self, original_resume):
        """AI changes casing of company name — should still match."""
        tailored = copy.deepcopy(original_resume)
        tailored["experience"][0]["company"] = "acme corp"  # lowercase
        tailored["experience"][0]["title"] = "software engineer"  # lowercase

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        # Should match and force back to original casing
        assert corrected["experience"][0]["company"] == "Acme Corp"
        assert corrected["experience"][0]["title"] == "Software Engineer"

    def test_whitespace_in_matching(self, original_resume):
        """AI adds extra whitespace — should still match."""
        tailored = copy.deepcopy(original_resume)
        tailored["experience"][0]["company"] = "  Acme Corp  "
        tailored["experience"][0]["title"] = "  Software Engineer  "

        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, tailored)

        assert corrected["experience"][0]["company"] == "Acme Corp"
        assert len(corrected["experience"]) == 2
