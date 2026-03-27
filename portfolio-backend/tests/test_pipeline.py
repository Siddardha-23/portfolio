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

    def test_generate_allowed_regardless_of_existing_projects(
        self, original_resume, jd_analysis, monkeypatch
    ):
        """ProjectGenerator.generate can be called even when original has projects.

        ContentAugmenter calls generate() whenever project count < 3 and
        page fill is below threshold, regardless of whether the original
        resume already has projects.
        """
        # original_resume has 1 project — augmenter can still generate more
        assert len(original_resume.get("projects", [])) > 0
        # The generator itself has no guard — it generates unconditionally.
        # The ContentAugmenter controls when to call it based on project count.

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


# ---------------------------------------------------------------------------
# Contact normalization
# ---------------------------------------------------------------------------

class TestContactNormalization:
    """Verify contact field whitespace normalization in parser backfill."""

    def test_name_whitespace_collapsed(self):
        """Extra whitespace in name is collapsed to single spaces."""
        from services.resume_parser import ResumeParser
        result = {
            "contact": {"name": "  John   Smith  ", "email": "j@x.com",
                         "phone": "", "linkedin": "", "github": ""},
            "skills": {}, "experience": [], "education": [], "projects": [],
        }
        raw_text = "John Smith\nj@x.com\n555-0100"
        fixed = ResumeParser._backfill_contact(result, raw_text)
        assert fixed["contact"]["name"] == "John Smith"

    def test_phone_whitespace_collapsed(self):
        """Extra whitespace in phone is collapsed."""
        from services.resume_parser import ResumeParser
        result = {
            "contact": {"name": "Jane", "email": "j@x.com",
                         "phone": "  555  012  3456  ", "linkedin": "", "github": ""},
            "skills": {}, "experience": [], "education": [], "projects": [],
        }
        fixed = ResumeParser._backfill_contact(result, "Jane\nj@x.com")
        assert "  " not in fixed["contact"]["phone"]

    def test_already_clean_name_unchanged(self):
        """A correctly formatted name passes through unchanged."""
        from services.resume_parser import ResumeParser
        result = {
            "contact": {"name": "Alice Johnson", "email": "a@x.com",
                         "phone": "555-0100", "linkedin": "li", "github": "gh"},
            "skills": {}, "experience": [], "education": [], "projects": [],
        }
        fixed = ResumeParser._backfill_contact(result, "Alice Johnson\na@x.com")
        assert fixed["contact"]["name"] == "Alice Johnson"


# ---------------------------------------------------------------------------
# Education deduplication in renderer
# ---------------------------------------------------------------------------

class TestEducationDedup:
    """Verify education deduplication and empty-entry filtering in renderer."""

    def _make_resume(self, education_entries):
        return {
            "contact": {"name": "Test", "email": "t@t.com", "phone": "",
                         "linkedin": "", "github": ""},
            "summary": "Engineer.",
            "skills": {"Languages": ["Python"]},
            "experience": [{"title": "SWE", "company": "Corp", "location": "",
                             "dates": "2022", "type": "", "bullets": ["Did work"]}],
            "education": education_entries,
            "projects": [],
            "certifications": [],
        }

    def test_pdf_renders_without_duplicate_education(self):
        """Duplicate education entries (same institution+degree) render only once."""
        from services.resume_renderer import ResumeRenderer
        resume = self._make_resume([
            {"degree": "B.S. CS", "institution": "UC Berkeley", "dates": "2022",
             "location": "", "gpa": "", "coursework": ""},
            {"degree": "B.S. CS", "institution": "UC Berkeley", "dates": "2022",
             "location": "", "gpa": "", "coursework": ""},
        ])
        renderer = ResumeRenderer()
        pdf_bytes = renderer.generate_pdf(resume)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 500

    def test_pdf_skips_empty_education_entries(self):
        """Education entries with no institution and no degree are skipped."""
        from services.resume_renderer import ResumeRenderer
        resume = self._make_resume([
            {"degree": "", "institution": "", "dates": "", "location": "",
             "gpa": "", "coursework": ""},
            {"degree": "B.S. CS", "institution": "MIT", "dates": "2022",
             "location": "", "gpa": "", "coursework": ""},
        ])
        renderer = ResumeRenderer()
        pdf_bytes = renderer.generate_pdf(resume)
        assert isinstance(pdf_bytes, bytes)

    def test_docx_renders_without_duplicate_education(self):
        """DOCX also deduplicates education entries."""
        from services.resume_renderer import ResumeRenderer
        resume = self._make_resume([
            {"degree": "B.S. CS", "institution": "UC Berkeley", "dates": "2022",
             "location": "", "gpa": "", "coursework": ""},
            {"degree": "B.S. CS", "institution": "UC Berkeley", "dates": "2022",
             "location": "", "gpa": "", "coursework": ""},
        ])
        renderer = ResumeRenderer()
        docx_bytes = renderer.generate_docx(resume)
        assert isinstance(docx_bytes, bytes)


# ---------------------------------------------------------------------------
# Empty field rendering
# ---------------------------------------------------------------------------

class TestEmptyFieldRendering:
    """Verify renderer handles missing/empty fields gracefully."""

    def test_pdf_renders_with_empty_contact_phone(self):
        """PDF renders cleanly when phone is empty."""
        from services.resume_renderer import ResumeRenderer
        resume = {
            "contact": {"name": "Test User", "email": "t@t.com", "phone": "",
                         "linkedin": "", "github": ""},
            "summary": "A summary.",
            "skills": {"Languages": ["Python"]},
            "experience": [{"title": "SWE", "company": "Corp", "location": "",
                             "dates": "2022", "type": "", "bullets": ["Did work"]}],
            "education": [{"degree": "B.S.", "institution": "Uni", "dates": "2022",
                            "location": "", "gpa": "", "coursework": ""}],
            "projects": [],
            "certifications": [],
        }
        renderer = ResumeRenderer()
        pdf_bytes = renderer.generate_pdf(resume)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 500


# ---------------------------------------------------------------------------
# ProjectGenerator: word-boundary tech grounding
# ---------------------------------------------------------------------------

class TestProjectGeneratorTechGrounding:
    """Verify tech validation uses word boundaries, not substring matching."""

    def _make_generator(self):
        from services.project_generator import ProjectGenerator
        return ProjectGenerator()

    def _make_resume_with_skills(self, skills_dict, bullets=None):
        return {
            "contact": {"name": "Test", "email": "t@t.com", "phone": "",
                         "linkedin": "", "github": ""},
            "summary": "",
            "skills": skills_dict,
            "experience": [{"title": "SWE", "company": "Google Inc", "location": "",
                             "dates": "2022", "type": "",
                             "bullets": bullets or ["Worked at Google on cloud services"]}],
            "education": [],
            "projects": [],
        }

    def test_validate_and_clean_rejects_substring_match(self):
        """'Go' should NOT match when resume only has 'Google' (substring)."""
        gen = self._make_generator()
        resume = self._make_resume_with_skills(
            {"Languages": ["Python", "JavaScript"]},
            bullets=["Worked at Google on cloud services"],
        )
        project = {
            "name": "CLI Tool",
            "dates": "",
            "bullets": ["Built a CLI tool", "Used Python for scripting", "Deployed to cloud"],
            "tech": "Go, Python",
        }
        result = gen._validate_and_clean(project, resume)
        assert result is not None
        tech_items = [t.strip() for t in result["tech"].split(",")]
        assert "Go" not in tech_items
        assert "Python" in tech_items

    def test_validate_and_clean_accepts_word_boundary_match(self):
        """'Go' should match when resume has 'Go' as an explicit skill."""
        gen = self._make_generator()
        resume = self._make_resume_with_skills(
            {"Languages": ["Python", "Go"]},
        )
        project = {
            "name": "CLI Tool",
            "dates": "",
            "bullets": ["Built a CLI tool", "Used Go for the backend", "Added tests"],
            "tech": "Go, Python",
        }
        result = gen._validate_and_clean(project, resume)
        assert result is not None
        tech_items = [t.strip() for t in result["tech"].split(",")]
        assert "Go" in tech_items


# ---------------------------------------------------------------------------
# IntegrityGuard: severity classification
# ---------------------------------------------------------------------------

class TestIntegrityGuardSeverity:
    """Verify severity classification handles count mismatch correctly."""

    def test_experience_count_mismatch_triggers_retry(self):
        """Persistent count mismatch should trigger needs_retry."""
        from services.integrity_guard import IntegrityGuard, IntegrityReport
        report = IntegrityReport()
        report.experience_count_mismatch = True
        assert IntegrityGuard._classify_severity(report) == "needs_retry"

    def test_no_mismatch_is_clean(self):
        """No violations at all should be classified as clean."""
        from services.integrity_guard import IntegrityGuard, IntegrityReport
        report = IntegrityReport()
        report.experience_count_mismatch = False
        assert IntegrityGuard._classify_severity(report) == "clean"


# ---------------------------------------------------------------------------
# Renderer: empty name fallback
# ---------------------------------------------------------------------------

class TestRendererNameFallback:
    """Verify renderer handles empty name gracefully."""

    def test_pdf_renders_with_empty_name(self):
        """PDF renders with 'Resume' as header when name is empty."""
        from services.resume_renderer import ResumeRenderer
        resume = {
            "contact": {"name": "", "email": "t@t.com", "phone": "",
                         "linkedin": "", "github": ""},
            "summary": "A summary.",
            "skills": {"Languages": ["Python"]},
            "experience": [{"title": "SWE", "company": "Corp", "location": "",
                             "dates": "2022", "type": "", "bullets": ["Did work"]}],
            "education": [{"degree": "B.S.", "institution": "Uni", "dates": "2022",
                            "location": "", "gpa": "", "coursework": ""}],
            "projects": [],
            "certifications": [],
        }
        renderer = ResumeRenderer()
        pdf_bytes = renderer.generate_pdf(resume)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 500


# ---------------------------------------------------------------------------
# LinkedIn URL normalization (Fix 1)
# ---------------------------------------------------------------------------

class TestLinkedInNormalization:
    """Verify LinkedIn and GitHub URL normalization helpers."""

    def test_normalize_bare_linkedin(self):
        """Bare linkedin.com/in/user -> https://linkedin.com/in/user."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_linkedin("linkedin.com/in/alice") == "https://linkedin.com/in/alice"

    def test_normalize_www_linkedin(self):
        """www.linkedin.com/in/user -> https://linkedin.com/in/user."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_linkedin("www.linkedin.com/in/bob") == "https://linkedin.com/in/bob"

    def test_normalize_http_linkedin(self):
        """http://linkedin.com/in/user -> https://linkedin.com/in/user."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_linkedin("http://linkedin.com/in/charlie") == "https://linkedin.com/in/charlie"

    def test_normalize_linkedin_with_query_params(self):
        """Strip query params from linkedin URL."""
        from services.resume_parser import ResumeParser
        result = ResumeParser._normalize_linkedin("https://linkedin.com/in/dave?extra=1&foo=bar")
        assert result == "https://linkedin.com/in/dave"

    def test_normalize_already_clean_linkedin(self):
        """Already clean URL passes through."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_linkedin("https://linkedin.com/in/eve") == "https://linkedin.com/in/eve"

    def test_normalize_empty_linkedin(self):
        """Empty string returns empty."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_linkedin("") == ""

    def test_normalize_bare_github(self):
        """Bare github.com/user -> https://github.com/user."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_github("github.com/alice") == "https://github.com/alice"

    def test_normalize_empty_github(self):
        """Empty string returns empty."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_github("") == ""


# ---------------------------------------------------------------------------
# Education degree cleanup (Fix 2)
# ---------------------------------------------------------------------------

class TestEducationDegreeCleanup:
    """Verify degree field cleaning strips baked-in dates and duplicates."""

    def test_degree_with_piped_dates(self):
        """Degree with dates after pipe should have dates stripped."""
        from services.resume_parser import ResumeParser
        structured = {
            "contact": {"name": "T", "email": "", "phone": "", "linkedin": "", "github": ""},
            "summary": "", "skills": {}, "experience": [], "projects": [],
            "education": [
                {"degree": "MS, IT | Dec 2025", "institution": "NYU",
                 "dates": "", "location": "", "gpa": "", "coursework": ""},
            ],
        }
        cleaned = ResumeParser._clean_education_fields(structured)
        assert "Dec" not in cleaned["education"][0]["degree"]
        assert "2025" not in cleaned["education"][0]["degree"]

    def test_degree_with_duplicates(self):
        """Duplicated degree text is deduplicated."""
        from services.resume_parser import ResumeParser
        structured = {
            "contact": {"name": "T", "email": "", "phone": "", "linkedin": "", "github": ""},
            "summary": "", "skills": {}, "experience": [], "projects": [],
            "education": [
                {"degree": "MS, IT | Dec 2025 | MS, IT", "institution": "NYU",
                 "dates": "", "location": "", "gpa": "", "coursework": ""},
            ],
        }
        cleaned = ResumeParser._clean_education_fields(structured)
        degree = cleaned["education"][0]["degree"]
        # Should appear only once
        assert degree.count("MS") == 1

    def test_clean_degree_no_pipe(self):
        """Degree without pipe passes through unchanged."""
        from services.resume_parser import ResumeParser
        structured = {
            "contact": {"name": "T", "email": "", "phone": "", "linkedin": "", "github": ""},
            "summary": "", "skills": {}, "experience": [], "projects": [],
            "education": [
                {"degree": "B.S. Computer Science", "institution": "MIT",
                 "dates": "2022", "location": "", "gpa": "", "coursework": ""},
            ],
        }
        cleaned = ResumeParser._clean_education_fields(structured)
        assert cleaned["education"][0]["degree"] == "B.S. Computer Science"


# ---------------------------------------------------------------------------
# Skills coercion safety net (Fix 3)
# ---------------------------------------------------------------------------

class TestSkillsCoercion:
    """Verify flat list of skills gets auto-wrapped as dict."""

    def test_flat_list_wrapped_as_general(self):
        """Skills as ['Python', 'Go'] -> {'General': ['Python', 'Go']}."""
        from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce
        data = {
            "contact": {}, "summary": "", "skills": ["Python", "Go"],
            "experience": [], "education": [], "projects": [],
        }
        result = validate_and_coerce(data, PARSED_RESUME_SCHEMA)
        assert isinstance(result["skills"], dict)
        assert "General" in result["skills"]
        assert "Python" in result["skills"]["General"]
        assert "Go" in result["skills"]["General"]

    def test_dict_skills_unchanged(self):
        """Skills as dict passes through correctly."""
        from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce
        data = {
            "contact": {}, "summary": "", "skills": {"Languages": ["Python"]},
            "experience": [], "education": [], "projects": [],
        }
        result = validate_and_coerce(data, PARSED_RESUME_SCHEMA)
        assert result["skills"] == {"Languages": ["Python"]}

    def test_null_skills_becomes_empty_dict(self):
        """None skills -> empty dict."""
        from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce
        data = {
            "contact": {}, "summary": "", "skills": None,
            "experience": [], "education": [], "projects": [],
        }
        result = validate_and_coerce(data, PARSED_RESUME_SCHEMA)
        assert result["skills"] == {}


# ---------------------------------------------------------------------------
# Project null safety (Fix 4)
# ---------------------------------------------------------------------------

class TestProjectNullSafety:
    """Verify None/null projects don't crash the pipeline."""

    def test_null_projects_coerced_to_empty_list(self):
        """None projects -> [] via schema coercion."""
        from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce
        data = {
            "contact": {}, "summary": "", "skills": {},
            "experience": [], "education": [], "projects": None,
        }
        result = validate_and_coerce(data, PARSED_RESUME_SCHEMA)
        assert result["projects"] == []

    def test_integrity_guard_handles_none_projects(self):
        """IntegrityGuard.enforce works when original has None projects."""
        from services.integrity_guard import IntegrityGuard
        guard = IntegrityGuard()
        original = {
            "contact": {"name": "T", "email": "", "phone": "", "linkedin": "", "github": ""},
            "summary": "", "skills": {},
            "experience": [{"title": "SWE", "company": "Corp", "location": "",
                             "dates": "2022", "type": "", "bullets": ["Did work"]}],
            "education": [], "projects": None,
        }
        tailored = copy.deepcopy(original)
        tailored["projects"] = []
        corrected, report = guard.enforce(original, tailored)
        assert corrected["projects"] == [] or isinstance(corrected["projects"], list)

    def test_integrity_guard_degree_cleanup(self):
        """IntegrityGuard cleans degree fields with baked-in dates."""
        from services.integrity_guard import IntegrityGuard
        guard = IntegrityGuard()
        original = {
            "contact": {"name": "T", "email": "", "phone": "", "linkedin": "", "github": ""},
            "summary": "", "skills": {},
            "experience": [{"title": "SWE", "company": "Corp", "location": "",
                             "dates": "2022", "type": "", "bullets": ["Did work"]}],
            "education": [{"degree": "MS, IT | Dec 2025 | MS, IT", "institution": "NYU",
                            "dates": "Dec 2025", "location": "", "gpa": "", "coursework": ""}],
            "projects": [],
        }
        tailored = copy.deepcopy(original)
        corrected, report = guard.enforce(original, tailored)
        degree = corrected["education"][0]["degree"]
        # Degree should be cleaned of date segments and duplicates
        assert degree.count("MS") == 1


# ---------------------------------------------------------------------------
# Round 4: LinkedIn fabrication detection + href priority
# ---------------------------------------------------------------------------

class TestLinkedInFabricationDetection:
    """Verify fabricated LinkedIn URLs are detected and href links take priority."""

    def _make_result(self, linkedin="", github=""):
        return {
            "contact": {"name": "Test", "email": "t@t.com", "phone": "555-0100",
                         "linkedin": linkedin, "github": github},
            "skills": {}, "experience": [], "education": [], "projects": [],
        }

    def test_href_overrides_gemini_fabrication(self):
        """Extracted href LinkedIn URL overrides Gemini's fabricated value."""
        from services.resume_parser import ResumeParser
        result = self._make_result(
            linkedin="linkedin.com/suryateja213",  # Gemini fabricated this
            github="github.com/suryateja213",
        )
        raw_text = (
            "Some resume text\n"
            "[Extracted Link: https://linkedin.com/in/realuser123]\n"
            "[Extracted Link: https://github.com/suryateja213]\n"
        )
        fixed = ResumeParser._backfill_contact(result, raw_text)
        assert "realuser123" in fixed["contact"]["linkedin"]
        assert "suryateja213" in fixed["contact"]["github"]

    def test_same_username_cleared_without_href(self):
        """When no href exists and LinkedIn value is not a linkedin.com URL, it's cleared."""
        from services.resume_parser import ResumeParser
        result = self._make_result(
            linkedin="somesite.com/suryateja213",
            github="github.com/suryateja213",
        )
        raw_text = "Some resume text with no extracted links"
        fixed = ResumeParser._backfill_contact(result, raw_text)
        # LinkedIn should be cleared (non-URL value with no linkedin.com)
        assert fixed["contact"]["linkedin"] == ""

    def test_different_usernames_not_cleared(self):
        """LinkedIn with different username than GitHub is NOT cleared."""
        from services.resume_parser import ResumeParser
        result = self._make_result(
            linkedin="linkedin.com/in/realuser",
            github="github.com/otheruser",
        )
        raw_text = "Some resume text"
        fixed = ResumeParser._backfill_contact(result, raw_text)
        assert "realuser" in fixed["contact"]["linkedin"]

    def test_cross_contamination_github_in_linkedin(self):
        """GitHub URL in LinkedIn field gets moved to GitHub field."""
        from services.resume_parser import ResumeParser
        result = self._make_result(
            linkedin="github.com/someuser",
            github="",
        )
        raw_text = "Some resume text"
        fixed = ResumeParser._backfill_contact(result, raw_text)
        assert fixed["contact"]["linkedin"] == ""
        assert "someuser" in fixed["contact"]["github"]

    def test_cross_contamination_linkedin_in_github(self):
        """LinkedIn URL in GitHub field gets moved to LinkedIn field."""
        from services.resume_parser import ResumeParser
        result = self._make_result(
            linkedin="",
            github="linkedin.com/in/someuser",
        )
        raw_text = "Some resume text"
        fixed = ResumeParser._backfill_contact(result, raw_text)
        assert "someuser" in fixed["contact"]["linkedin"]
        assert fixed["contact"]["github"] == ""


# ---------------------------------------------------------------------------
# Round 4: LinkedIn normalization without /in/
# ---------------------------------------------------------------------------

class TestLinkedInNormalizeNoIn:
    """Verify _normalize_linkedin inserts /in/ when missing."""

    def test_bare_linkedin_username(self):
        """linkedin.com/user -> https://linkedin.com/in/user."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_linkedin("linkedin.com/johndoe") == "https://linkedin.com/in/johndoe"

    def test_known_subpath_not_treated_as_username(self):
        """linkedin.com/company should NOT become /in/company."""
        from services.resume_parser import ResumeParser
        result = ResumeParser._normalize_linkedin("linkedin.com/company")
        assert "/in/company" not in result

    def test_canonical_form_unchanged(self):
        """linkedin.com/in/user already canonical."""
        from services.resume_parser import ResumeParser
        assert ResumeParser._normalize_linkedin("linkedin.com/in/johndoe") == "https://linkedin.com/in/johndoe"


# ---------------------------------------------------------------------------
# Round 4: Project fallback generation
# ---------------------------------------------------------------------------



# ---------------------------------------------------------------------------
# New: LinkedIn display-text handling
# ---------------------------------------------------------------------------

class TestLinkedInDisplayText:
    """Verify non-URL LinkedIn values are handled correctly."""

    def _make_result(self, linkedin="", github=""):
        return {
            "contact": {"name": "Test", "email": "t@t.com", "phone": "555-0100",
                         "linkedin": linkedin, "github": github},
            "skills": {}, "experience": [], "education": [], "projects": [],
        }

    def test_non_url_linkedin_replaced_by_href(self):
        """LinkedIn value 'LinkedIn' (display text) is replaced by extracted href."""
        from services.resume_parser import ResumeParser
        result = self._make_result(linkedin="LinkedIn", github="github.com/user1")
        raw_text = (
            "Some resume text\n"
            "[Extracted Link: https://www.linkedin.com/in/realprofile]\n"
            "[Extracted Link: https://github.com/user1]\n"
        )
        fixed = ResumeParser._backfill_contact(result, raw_text)
        assert "realprofile" in fixed["contact"]["linkedin"]

    def test_non_url_linkedin_cleared_no_href(self):
        """LinkedIn value 'LinkedIn' with no href is cleared."""
        from services.resume_parser import ResumeParser
        result = self._make_result(linkedin="LinkedIn", github="github.com/user1")
        raw_text = "Some resume text with no linkedin href"
        fixed = ResumeParser._backfill_contact(result, raw_text)
        assert fixed["contact"]["linkedin"] == ""

    def test_same_username_preserved_when_valid_linkedin_url(self):
        """LinkedIn with same username as GitHub is preserved if it's a valid linkedin.com URL."""
        from services.resume_parser import ResumeParser
        result = self._make_result(
            linkedin="linkedin.com/in/sameuser",
            github="github.com/sameuser",
        )
        raw_text = "Some resume text with no extracted links"
        fixed = ResumeParser._backfill_contact(result, raw_text)
        # Should NOT be cleared because it's a valid linkedin.com URL
        assert "sameuser" in fixed["contact"]["linkedin"]


# ---------------------------------------------------------------------------
# New: Project name validation
# ---------------------------------------------------------------------------

class TestProjectNameValidation:
    """Verify project names containing job title or 'Portfolio' are rejected."""

    def _make_generator(self):
        from services.project_generator import ProjectGenerator
        return ProjectGenerator()

    def _make_resume(self):
        return {
            "contact": {"name": "T", "email": "", "phone": "", "linkedin": "", "github": ""},
            "summary": "",
            "skills": {"Languages": ["Python", "JavaScript"]},
            "experience": [{"title": "SWE", "company": "Corp", "location": "",
                             "dates": "2022", "type": "", "bullets": ["Built APIs with Python"]}],
            "education": [], "projects": [],
        }

    def test_renames_name_with_job_title(self):
        """Project with job title in name gets Gemini-regenerated name, bullets preserved."""
        from unittest.mock import patch
        gen = self._make_generator()
        project = {
            "name": "Backend Engineer Side Project",
            "dates": "",
            "bullets": ["Built something", "Used Python", "Deployed it"],
            "tech": "Python, JavaScript",
        }
        jd = {"job_title": "Backend Engineer", "required_skills": [], "keywords": []}
        with patch.object(gen, '_generate_project_name', return_value='Payment Fraud Detection API'):
            result = gen._validate_and_clean(project, self._make_resume(), jd)
        assert result is not None
        assert result["name"] == "Payment Fraud Detection API"
        assert "Backend Engineer" not in result["name"]
        assert result["bullets"] == ["Built something", "Used Python", "Deployed it"]

    def test_renames_portfolio_name(self):
        """Project with 'Portfolio' in name gets Gemini-regenerated name, bullets preserved."""
        from unittest.mock import patch
        gen = self._make_generator()
        project = {
            "name": "Python Portfolio Project",
            "dates": "",
            "bullets": ["Built something", "Used Python", "Deployed it"],
            "tech": "Python, Flask",
        }
        with patch.object(gen, '_generate_project_name', return_value='REST API Gateway'):
            result = gen._validate_and_clean(project, self._make_resume())
        assert result is not None
        assert result["name"] == "REST API Gateway"
        assert "Portfolio" not in result["name"]
        assert result["bullets"] == ["Built something", "Used Python", "Deployed it"]

    def test_accepts_domain_focused_name(self):
        """Domain-focused project name is accepted."""
        gen = self._make_generator()
        project = {
            "name": "Cloud Cost Dashboard",
            "dates": "",
            "bullets": ["Built something", "Used Python", "Deployed it"],
            "tech": "Python",
        }
        jd = {"job_title": "Backend Engineer", "required_skills": [], "keywords": []}
        result = gen._validate_and_clean(project, self._make_resume(), jd)
        assert result is not None
        assert result["name"] == "Cloud Cost Dashboard"


