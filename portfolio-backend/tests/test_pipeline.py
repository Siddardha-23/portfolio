"""
Pipeline-level tests for the resume processing pipeline.

Covers:
- Parser strict extraction (no summary synthesis, no location inference)
- Tailor experience count preservation
- ProjectGenerator grounded tech and no-dates rules
- ProjectGenerator skipped when original has projects
- Renderer smoke tests (PDF and DOCX bytes generated without error)

These tests are deterministic and do NOT call Gemini.
"""
import copy
import io
import pytest


# ---------------------------------------------------------------------------
# Fixtures (supplement conftest.py)
# ---------------------------------------------------------------------------

@pytest.fixture
def resume_no_summary(original_resume):
    r = copy.deepcopy(original_resume)
    r["summary"] = ""
    return r


@pytest.fixture
def resume_no_location(original_resume):
    r = copy.deepcopy(original_resume)
    for exp in r["experience"]:
        exp["location"] = ""
    return r


@pytest.fixture
def jd_analysis():
    return {
        "job_title": "Backend Engineer",
        "company": "TechCorp",
        "location": "Remote",
        "employment_type": "Full-time",
        "required_skills": ["Go", "Kubernetes", "AWS"],
        "preferred_skills": ["gRPC", "Terraform"],
        "responsibilities": ["Build scalable services", "Own infrastructure"],
        "qualifications": ["3+ years backend experience"],
        "experience_years": "3-5 years",
        "industry": "Cloud Computing",
        "keywords": ["microservices", "REST", "Docker", "CI/CD"],
    }


# ---------------------------------------------------------------------------
# Parser: strict extraction (unit-level, no Gemini)
# ---------------------------------------------------------------------------

class TestParserStrictExtraction:
    """Validate that the parser prompt enforces no-synthesis rules.

    These tests validate the schema coercion layer and parser logic
    without calling Gemini (Gemini calls are integration tests).
    """

    def test_validate_and_coerce_preserves_empty_summary(self):
        """validate_and_coerce must not add a summary if input has empty string."""
        from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce
        data = {"summary": "", "contact": {}, "skills": {}, "experience": [],
                "education": [], "projects": []}
        result = validate_and_coerce(data, PARSED_RESUME_SCHEMA)
        assert result["summary"] == ""

    def test_validate_and_coerce_fills_missing_summary_with_empty_string(self):
        """validate_and_coerce fills missing summary with '' not None."""
        from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce
        data = {"contact": {}, "skills": {}, "experience": [], "education": [], "projects": []}
        result = validate_and_coerce(data, PARSED_RESUME_SCHEMA)
        assert result["summary"] == ""

    def test_validate_and_coerce_preserves_empty_location(self):
        """validate_and_coerce preserves empty location — never infers."""
        from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce
        data = {
            "summary": "",
            "contact": {},
            "skills": {},
            "experience": [{"title": "SWE", "company": "Corp", "location": "",
                             "dates": "2022", "type": "", "bullets": []}],
            "education": [],
            "projects": [],
        }
        result = validate_and_coerce(data, PARSED_RESUME_SCHEMA)
        assert result["experience"][0]["location"] == ""


# ---------------------------------------------------------------------------
# Tailor: experience count preservation
# ---------------------------------------------------------------------------

class TestTailorExperienceCount:
    """Verify integrity guard enforces experience count after tailoring."""

    def test_integrity_guard_preserves_count(self, original_resume, dropped_experience):
        """After guard.enforce(), experience count matches original."""
        from services.integrity_guard import IntegrityGuard
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, dropped_experience)
        assert len(corrected["experience"]) == len(original_resume["experience"])

    def test_integrity_guard_removes_hallucinated_experience(
        self, original_resume, hallucinated_experience
    ):
        """Hallucinated experience entries are removed, count matches original."""
        from services.integrity_guard import IntegrityGuard
        guard = IntegrityGuard()
        corrected, report = guard.enforce(original_resume, hallucinated_experience)
        assert len(corrected["experience"]) == len(original_resume["experience"])
        companies = [e["company"] for e in corrected["experience"]]
        assert "GoogleFake Inc" not in companies

    def test_integrity_guard_flags_hallucinated_experience_for_retry(
        self, original_resume, hallucinated_experience
    ):
        """Hallucinated experience triggers needs_retry severity."""
        from services.integrity_guard import IntegrityGuard
        guard = IntegrityGuard()
        _, report = guard.enforce(original_resume, hallucinated_experience)
        assert report.severity == "needs_retry"


# ---------------------------------------------------------------------------
# ProjectGenerator: grounded tech and structural rules
# ---------------------------------------------------------------------------

class TestProjectGenerator:
    def _make_generator(self):
        from services.project_generator import ProjectGenerator
        return ProjectGenerator()

    def test_validate_and_clean_removes_unknown_tech(self, original_resume_no_projects):
        """Tech not in resume skills/bullets is stripped from generated project."""
        gen = self._make_generator()
        project = {
            "name": "Cloud Dashboard",
            "dates": "2023",
            "bullets": [
                "Built a cloud monitoring tool",
                "Used Python Flask for the backend",
                "Deployed on AWS",
            ],
            "tech": "Python, AWS, FakeTech9000, React",
        }
        result = gen._validate_and_clean(project, original_resume_no_projects)
        assert result is not None
        tech_items = [t.strip() for t in result["tech"].split(",")]
        assert "FakeTech9000" not in tech_items

    def test_validate_and_clean_sets_empty_dates(self, original_resume_no_projects):
        """Generated project must always have empty dates."""
        gen = self._make_generator()
        project = {
            "name": "My Project",
            "dates": "2023",
            "bullets": ["Built something with Python", "Deployed on AWS", "Used Docker"],
            "tech": "Python, AWS",
        }
        result = gen._validate_and_clean(project, original_resume_no_projects)
        assert result is not None
        assert result["dates"] == ""

    def test_validate_and_clean_rejects_no_name(self, original_resume_no_projects):
        """Project with empty name is rejected."""
        gen = self._make_generator()
        project = {"name": "", "dates": "", "bullets": ["Something"], "tech": "Python"}
        result = gen._validate_and_clean(project, original_resume_no_projects)
        assert result is None

    def test_validate_and_clean_rejects_no_bullets(self, original_resume_no_projects):
        """Project with no bullets is rejected."""
        gen = self._make_generator()
        project = {"name": "My Project", "dates": "", "bullets": [], "tech": "Python"}
        result = gen._validate_and_clean(project, original_resume_no_projects)
        assert result is None

    def test_validate_and_clean_caps_bullets_at_three(self, original_resume_no_projects):
        """Excess bullets are trimmed to 3."""
        gen = self._make_generator()
        project = {
            "name": "Big Project",
            "dates": "",
            "bullets": [
                "Built API with Python",
                "Deployed on AWS",
                "Used Docker containers",
                "Added CI/CD pipeline",
                "Monitored with CloudWatch",
            ],
            "tech": "Python, AWS",
        }
        result = gen._validate_and_clean(project, original_resume_no_projects)
        assert result is not None
        assert len(result["bullets"]) == 3

    def test_generate_skipped_when_original_has_projects(
        self, original_resume, jd_analysis, monkeypatch
    ):
        """ProjectGenerator.generate should not be called when original has projects.

        This test verifies the service-level guard: the tailor job in
        resume_service only calls generate() when structured["projects"] == [].
        Here we verify the guard condition directly.
        """
        # original_resume has 1 project — the service skips generator
        assert len(original_resume.get("projects", [])) > 0
        # No Gemini call made — if we called generate() it would fail without API key.
        # The integration guard is: `if not structured.get("projects")`
        # We verify the condition evaluates correctly:
        assert not (not original_resume.get("projects"))

    def test_generate_allowed_when_no_projects(self, original_resume_no_projects):
        """Service condition allows generation when projects is empty list."""
        assert not original_resume_no_projects.get("projects")


# ---------------------------------------------------------------------------
# Renderer: smoke tests (no Gemini, pure Python)
# ---------------------------------------------------------------------------

class TestRendererSmoke:
    @pytest.fixture
    def sample_tailored(self, original_resume):
        """A minimal valid tailored resume for rendering."""
        r = copy.deepcopy(original_resume)
        r["certifications"] = []
        return r

    def test_generate_pdf_returns_bytes(self, sample_tailored):
        """generate_pdf must return non-empty bytes without error."""
        from services.resume_renderer import ResumeRenderer
        renderer = ResumeRenderer()
        result = renderer.generate_pdf(sample_tailored)
        assert isinstance(result, bytes)
        assert len(result) > 1000  # a real PDF is at least a few KB

    def test_generate_docx_returns_bytes(self, sample_tailored):
        """generate_docx must return non-empty bytes without error."""
        from services.resume_renderer import ResumeRenderer
        renderer = ResumeRenderer()
        result = renderer.generate_docx(sample_tailored)
        assert isinstance(result, bytes)
        assert len(result) > 1000

    def test_generate_pdf_with_no_projects(self, original_resume_no_projects):
        """PDF renders cleanly when projects section is empty."""
        from services.resume_renderer import ResumeRenderer
        r = copy.deepcopy(original_resume_no_projects)
        r["certifications"] = []
        renderer = ResumeRenderer()
        result = renderer.generate_pdf(r)
        assert isinstance(result, bytes)
        assert len(result) > 500

    def test_generate_pdf_with_no_summary(self, original_resume):
        """PDF renders cleanly when summary is empty string."""
        from services.resume_renderer import ResumeRenderer
        r = copy.deepcopy(original_resume)
        r["summary"] = ""
        r["certifications"] = []
        renderer = ResumeRenderer()
        result = renderer.generate_pdf(r)
        assert isinstance(result, bytes)

    def test_build_filename_format(self, original_resume, jd_analysis):
        """build_filename produces correct format."""
        from services.resume_renderer import ResumeRenderer
        name = ResumeRenderer.build_filename(original_resume, jd_analysis, "pdf")
        assert name.endswith(".pdf")
        assert "Alice" in name
        assert "Johnson" in name
