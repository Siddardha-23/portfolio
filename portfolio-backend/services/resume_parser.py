"""
Resume Parser — Multi-modal PDF extraction + Gemini structured parsing.

Architecture:
  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
  │ PDF file │───>│ Text + Links │───>│ Gemini Flash │───>│ Validated│
  │ (bytes)  │    │  extraction  │    │  (structured │    │  JSON    │
  │          │    │  (PyPDF2)    │    │   parsing)   │    │  + store │
  └──────────┘    └──────────────┘    └──────────────┘    └──────────┘
         │                                    ▲
         │  (pdf_base64)                      │
         └──────── Multi-modal path ──────────┘
            Direct PDF → Gemini Vision
            (skips text extraction)

Model routing:
  - Gemini 2.5 Flash: fast, factual extraction — no hallucination, no rewriting.
  - Multi-modal mode: sends raw PDF bytes to Gemini for visual document understanding.
    This is superior for complex layouts (columns, tables, sidebars) where PyPDF2
    text extraction may lose structure.

Output conforms to PARSED_RESUME_SCHEMA so downstream consumers
(ResumeTailor, ResumeScorer, ProjectGenerator) receive consistent JSON.

Key design decisions:
  1. Strict extraction prompt — prevents the model from inventing or embellishing.
  2. No native schema= enforcement — PARSED_RESUME_SCHEMA uses _dict_of for skills
     (Record<string, string[]>) which Gemini's response_schema API cannot handle.
     Instead, we rely on prompt instructions + post-call validate_and_coerce().
  3. Keyword normalization — standardizes skill names ("JS" → "JavaScript") for
     accurate downstream matching in scoring and gap analysis.
  4. Single-user storage — resumes are replaced (not versioned) in MongoDB.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from schemas.resume_schemas import (
    PARSED_RESUME_SCHEMA,
    validate_and_coerce,
    flatten_skills,
    extract_job_titles,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Maximum characters of raw text sent to the LLM (prevents token overflow)
_MAX_TEXT_CHARS = 8000

# Minimum text length to consider a PDF extraction valid
_MIN_VALID_TEXT_LENGTH = 50

# Month abbreviation → number mapping for date parsing
_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Regex patterns compiled once at module level for performance
_YEAR_PATTERN = re.compile(r"(20\d{2}|19\d{2})")
_MONTH_PATTERN = re.compile(r"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*")

# Words that indicate a date range extends to the current date
_PRESENT_KEYWORDS = frozenset({"present", "current", "now", "ongoing", "today"})

# ---------------------------------------------------------------------------
# Extraction prompt template
# ---------------------------------------------------------------------------

_EXTRACTION_PROMPT = (
    "You are a strict resume parser. Your ONLY job is to extract information that is "
    "explicitly present in the resume. NEVER infer, synthesize, or invent anything.\n\n"

    "CRITICAL MANDATORY FIELDS — you MUST extract these if they exist anywhere in the resume:\n"
    "1. CONTACT: The person's full name, email address, phone number, LinkedIn URL, and GitHub URL.\n"
    "   - The name is almost ALWAYS the very first line or the largest text at the top of the resume.\n"
    "   - Look for email patterns like user@domain.com\n"
    "   - Look for phone patterns like (123) 456-7890 or +1-234-567-8901\n"
    "   - Look for linkedin.com/in/... URLs (may be hyperlinked, not visible as text)\n"
    "   - Look for github.com/... URLs (may be hyperlinked, not visible as text)\n"
    "   - If the resume has '[Extracted Link: ...]' markers, use those URLs for linkedin/github.\n"
    "2. EDUCATION: You MUST extract the institution/university name for every education entry.\n"
    "   - The institution name (e.g., 'Arizona State University', 'MIT') is NEVER optional.\n"
    "   - Also extract: degree, location, dates, GPA, and relevant coursework.\n\n"

    "STRICT EXTRACTION RULES:\n"
    "1. Extract ONLY information explicitly present in the resume. NEVER fabricate or invent.\n"
    "2. Summary: If no summary/objective section exists, return empty string. DO NOT write one.\n"
    "3. Location: If not stated for a job or education entry, use empty string. DO NOT guess.\n"
    "4. Employment type: If not explicitly stated (Full-time, Internship, Contract), use empty string.\n"
    "5. Bullet points: Copy the original bullet text verbatim. Do NOT rewrite or condense.\n"
    "6. If a section is not present in the resume, use an empty string or empty array.\n"
    "7. Every field must be a non-null string or array — never null.\n"
    "8. Extract skills from ALL sections — not just the 'Skills' heading.\n"
    "   Example: 'Built microservices using Go and gRPC' → extract 'Go', 'gRPC', 'microservices'.\n"
    "9. Include technologies mentioned in infrastructure context.\n"
    "   Example: 'Deployed on AWS ECS' → 'AWS' and 'ECS' are Cloud & DevOps skills.\n"
    "10. Categorize skills into logical groups (Languages, Frameworks, Cloud & DevOps, etc.).\n\n"

    "Return a JSON object with EXACTLY this structure (ALL top-level keys are REQUIRED):\n"
    "{\n"
    '  "contact": {\n'
    '    "name": "Full Name from resume header",\n'
    '    "email": "email@example.com",\n'
    '    "phone": "(123) 456-7890",\n'
    '    "linkedin": "linkedin.com/in/profile",\n'
    '    "github": "github.com/username"\n'
    "  },\n"
    '  "summary": "Professional summary if present, otherwise empty string",\n'
    '  "skills": {\n'
    '    "Category Name": ["Skill1", "Skill2"]\n'
    "  },\n"
    '  "experience": [\n'
    "    {\n"
    '      "title": "Job Title",\n'
    '      "company": "Company Name",\n'
    '      "location": "City, State",\n'
    '      "dates": "Start Date - End Date",\n'
    '      "type": "Full-time",\n'
    '      "bullets": ["Original bullet text..."]\n'
    "    }\n"
    "  ],\n"
    '  "education": [\n'
    "    {\n"
    '      "degree": "Degree Name",\n'
    '      "institution": "University Name (NEVER leave empty)",\n'
    '      "location": "City, State",\n'
    '      "dates": "Date range",\n'
    '      "gpa": "GPA if listed",\n'
    '      "coursework": "Relevant coursework if listed"\n'
    "    }\n"
    "  ],\n"
    '  "projects": [\n'
    "    {\n"
    '      "name": "Project Name",\n'
    '      "dates": "Date range",\n'
    '      "bullets": ["Description..."],\n'
    '      "tech": "Tech1, Tech2"\n'
    "    }\n"
    "  ]\n"
    "}\n\n"
)


class ResumeParser:
    """Handles PDF → structured JSON parsing and MongoDB storage.

    Provides two parsing paths:
      1. Text-only: PyPDF2 extracts text → Gemini Flash parses the text.
      2. Multi-modal: Raw PDF bytes are sent directly to Gemini Flash for
         visual document understanding (superior for complex layouts).

    Usage:
        parser = ResumeParser(db)
        doc = parser.upload_and_parse(pdf_bytes)  # full sync pipeline
        # -- or --
        structured = parser.parse_to_structured(raw_text, pdf_base64)
        doc = parser.save_parsed_resume(structured, raw_text)  # async path
    """

    def __init__(self, db):
        """Initialize with a MongoDB database instance.

        Args:
            db: pymongo Database object. The parser uses the 'user_resumes' collection.
        """
        self.user_resumes = db.user_resumes

    # ======================================================================
    # 1. PDF TEXT EXTRACTION
    # ======================================================================

    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> str:
        """Extract text content from a PDF file, including embedded hyperlinks.

        Uses PyPDF2 to extract visible text from each page, then inspects
        link annotations to capture clickable URLs that may not appear in
        the visible text (e.g., hyperlinked LinkedIn/GitHub profile names).

        Args:
            file_bytes: Raw PDF file content as bytes.

        Returns:
            Extracted text string concatenated from all pages.

        Raises:
            ValueError: If the PDF is invalid, corrupted, or contains no
                        extractable text (e.g., scanned image PDFs).
        """
        from PyPDF2 import PdfReader
        import io

        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text_parts: List[str] = []

            for page in reader.pages:
                # Extract visible text from the page
                page_text = page.extract_text() or ""
                text_parts.append(page_text)

                # Extract clickable URLs from PDF annotations
                # (captures hidden links behind display text like "LinkedIn")
                if "/Annots" in page:
                    for annot_ref in page["/Annots"]:
                        try:
                            annot = annot_ref.get_object()
                            if annot.get("/Subtype") == "/Link":
                                action = annot.get("/A")
                                if action and action.get("/S") == "/URI":
                                    uri = action.get("/URI")
                                    if uri:
                                        text_parts.append(f"[Extracted Link: {uri}]")
                        except Exception:
                            # Skip malformed annotations silently
                            pass

            text = "\n".join(text_parts).strip()
            if len(text) < _MIN_VALID_TEXT_LENGTH:
                raise ValueError(
                    "Could not extract meaningful text from PDF. "
                    "The file may be a scanned image — please use a text-based PDF."
                )
            return text

        except ValueError:
            raise  # Re-raise our own validation errors
        except Exception as e:
            raise ValueError(f"Invalid or corrupted PDF file: {e}")

    # ======================================================================
    # 2. GEMINI STRUCTURED PARSING
    # ======================================================================

    def parse_to_structured(self, raw_text: str, pdf_base64: str = None) -> dict:
        """Parse resume content into structured JSON using Gemini Flash.

        Supports two input modes:
          - Text-only: Uses pre-extracted raw text (from PyPDF2).
          - Multi-modal: Sends the original PDF bytes directly to Gemini
            for visual document understanding. This produces superior results
            for resumes with complex layouts (columns, tables, sidebars).

        When pdf_base64 is provided, both the PDF and the extraction prompt
        are sent as multi-modal parts. The text-only path is used as fallback
        when PDF bytes aren't available (e.g., legacy uploads).

        Args:
            raw_text: Plain text extracted from the resume PDF.
            pdf_base64: Optional base64-encoded PDF bytes for multi-modal parsing.

        Returns:
            Structured resume dict conforming to PARSED_RESUME_SCHEMA
            with normalized skill keywords.

        Note:
            We do NOT use Gemini's native response_schema here because
            PARSED_RESUME_SCHEMA uses _dict_of for skills (Record<string, string[]>)
            which the Gemini API cannot enforce via additionalProperties.
            Structure is enforced via prompt instructions + validate_and_coerce().
        """
        from services.gemini_client import gemini_json, GEMINI_FLASH
        import base64
        from google.genai import types

        # Build multi-modal or text-only parts for the API call
        parts = self._build_extraction_parts(raw_text, pdf_base64, types, base64)

        # Call Gemini Flash for fast, factual extraction
        result = gemini_json(
            prompt=None,       # Prompt is embedded in the parts
            parts=parts,
            max_tokens=8192,
            temperature=0.2,   # Low temp for factual extraction
            model=GEMINI_FLASH,
        )

        # Normalize skill keywords to canonical forms
        # ("JS" → "JavaScript", "k8s" → "Kubernetes", etc.)
        result = self._normalize_skills(result)

        # Backfill contact info from raw text if Gemini failed to extract it
        # (common when schema= enforcement is off for _dict_of compatibility)
        result = self._backfill_contact(result, raw_text)

        # Backfill education institution from raw text if missing
        result = self._backfill_education(result, raw_text)

        # Clean education fields: strip dates baked into degree, deduplicate segments
        result = self._clean_education_fields(result)

        # Log warnings for any remaining missing critical fields
        self._validate_critical_fields(result)

        # Schema validation: ensure all required keys exist with correct types
        from schemas.resume_schemas import PARSED_RESUME_SCHEMA, validate_and_coerce
        result = validate_and_coerce(result, PARSED_RESUME_SCHEMA)

        return result

    @staticmethod
    def _build_extraction_parts(raw_text, pdf_base64, types, base64) -> list:
        """Build the Gemini API parts list based on available input.

        Multi-modal path (preferred): sends raw PDF + extraction prompt.
        When raw_text contains [Extracted Link: ...] markers (from PyPDF2
        annotation extraction), those are appended to the prompt so Gemini
        can see hyperlinked URLs even when reading the PDF visually.

        Text-only path (fallback): sends raw text appended to prompt.

        Args:
            raw_text: Plain text from the resume.
            pdf_base64: Optional base64-encoded PDF for multi-modal input.
            types: google.genai.types module (passed to avoid circular import).
            base64: base64 module (passed to avoid re-import).

        Returns:
            List of types.Part objects for the Gemini API call.
        """
        if pdf_base64:
            # Multi-modal: send the original PDF for visual understanding
            pdf_bytes = base64.b64decode(pdf_base64)

            # Extract [Extracted Link: ...] markers from raw_text so Gemini
            # can see hyperlinked URLs that aren't visible in the PDF text
            link_markers = re.findall(r'\[Extracted Link: [^\]]+\]', raw_text or "")
            link_context = ""
            if link_markers:
                link_context = (
                    "\n\nThe following URLs were found as hidden hyperlinks in the PDF. "
                    "Use these for the contact fields (linkedin, github, email) if they "
                    "match those services:\n" + "\n".join(link_markers) + "\n"
                )

            return [
                types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                types.Part.from_text(
                    text=_EXTRACTION_PROMPT + link_context
                    + "Extract from the attached PDF document."
                ),
            ]
        else:
            # Text-only fallback: embed raw text in the prompt
            prompt = _EXTRACTION_PROMPT + f"=== RESUME TEXT ===\n{raw_text[:_MAX_TEXT_CHARS]}"
            return [types.Part.from_text(text=prompt)]

    @staticmethod
    def _normalize_skills(result: dict) -> dict:
        """Normalize extracted skill names to canonical forms.

        Applies the project's keyword normalizer to standardize abbreviations
        and aliases (e.g., "JS" → "JavaScript", "k8s" → "Kubernetes").
        This ensures accurate downstream matching in scoring and gap analysis.

        Args:
            result: Parsed resume dict with a 'skills' key.

        Returns:
            The same dict with normalized skill values.
        """
        from utils.keyword_normalizer import normalize_keywords

        skills = result.get("skills", {})
        if isinstance(skills, dict):
            for category in list(skills.keys()):
                if isinstance(skills[category], list):
                    skills[category] = normalize_keywords(skills[category])
            result["skills"] = skills
        return result

    @staticmethod
    def _backfill_contact(result: dict, raw_text: str) -> dict:
        """Backfill empty contact fields from raw text using regex patterns.

        When Gemini omits or partially extracts contact fields, this method
        fills in the gaps using regex patterns for email, phone, LinkedIn,
        GitHub, and a name heuristic (first non-URL/email line).
        """
        contact = result.get("contact", {})
        if not isinstance(contact, dict):
            contact = {}

        # Count how many fields need backfill
        fields_to_fill = [f for f in ("name", "email", "phone", "linkedin", "github")
                          if not contact.get(f, "").strip()]
        if not fields_to_fill:
            # Even if all fields are populated, still run href override + fabrication check
            pass
        else:
            logger.info("Contact backfill: filling missing fields %s from raw text", fields_to_fill)

        # --- Extract [Extracted Link: ...] markers from PDF annotations ---
        # These are actual href URLs from the PDF, more reliable than Gemini's extraction.
        extracted_links = re.findall(r'\[Extracted Link:\s*([^\]]+)\]', raw_text)
        linkedin_href = ""
        github_href = ""
        for link in extracted_links:
            link = link.strip()
            if "linkedin.com" in link.lower() and not linkedin_href:
                linkedin_href = link
                logger.info("Contact backfill: found LinkedIn PDF href: %s", link)
            elif "github.com" in link.lower() and not github_href:
                github_href = link
                logger.info("Contact backfill: found GitHub PDF href: %s", link)

        # Override GitHub immediately from href (authoritative)
        if github_href:
            contact["github"] = github_href

        # For LinkedIn: if Gemini returned a non-URL value (e.g. display text "LinkedIn"),
        # clear it now so regex backfill can try, but the href will override at the end.
        linkedin_val = contact.get("linkedin", "").strip()
        if linkedin_val and "linkedin.com" not in linkedin_val.lower() and "github.com" not in linkedin_val.lower():
            contact["linkedin"] = ""
            logger.warning("Contact: cleared non-URL linkedin value '%s'", linkedin_val)

        # --- Email ---
        if not contact.get("email", "").strip():
            email_match = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', raw_text)
            if email_match:
                contact["email"] = email_match.group(0)

        # --- Phone (multiple patterns for international formats) ---
        if not contact.get("phone", "").strip():
            phone_patterns = [
                # US format: (123) 456-7890 or 123-456-7890 or +1 234 567 8901
                r'(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
                # International format: +91 12345 67890 or +44 7911 123456
                r'\+\d{1,3}[-.\s]?\d{4,5}[-.\s]?\d{4,6}',
                # General: any sequence of 10+ digits with separators
                r'(?:\+?\d{1,3}[-.\s]?)?\d[\d\s.-]{8,}\d',
            ]
            for pattern in phone_patterns:
                phone_match = re.search(pattern, raw_text)
                if phone_match:
                    phone = phone_match.group(0).strip()
                    # Validate: must have at least 10 digits
                    digits = re.sub(r'\D', '', phone)
                    if len(digits) >= 10:
                        contact["phone"] = phone
                        break

        # --- LinkedIn ---
        if not contact.get("linkedin", "").strip():
            linkedin_match = re.search(
                r'(?:https?://)?(?:www\.)?linkedin\.com/(?:in/)?[\w-]+/?',
                raw_text, re.IGNORECASE
            )
            if linkedin_match:
                contact["linkedin"] = linkedin_match.group(0)

        # --- GitHub ---
        if not contact.get("github", "").strip():
            github_match = re.search(
                r'(?:https?://)?(?:www\.)?github\.com/[\w-]+/?',
                raw_text, re.IGNORECASE
            )
            if github_match:
                contact["github"] = github_match.group(0)

        # --- Name (heuristic: first non-empty line that isn't a URL/email/phone) ---
        if not contact.get("name", "").strip():
            for line in raw_text.split("\n"):
                line = line.strip()
                if (
                    line
                    and len(line) < 60
                    and "@" not in line
                    and "http" not in line.lower()
                    and not line.startswith("[")
                    and not re.match(r'^[\d(+]', line)
                    and "linkedin" not in line.lower()
                    and "github" not in line.lower()
                ):
                    contact["name"] = line
                    break

        # Normalize whitespace in name and phone (collapse multiple spaces, strip edges)
        if contact.get("name"):
            contact["name"] = " ".join(contact["name"].split())
        if contact.get("phone"):
            contact["phone"] = " ".join(contact["phone"].split())

        # --- Cross-contamination guard: swap if fields contain the wrong domain ---
        linkedin_val = contact.get("linkedin", "")
        github_val = contact.get("github", "")
        if linkedin_val and "github.com" in linkedin_val.lower():
            if not github_val:
                contact["github"] = linkedin_val
            contact["linkedin"] = ""
            logger.warning("Contact cross-contamination: moved github.com URL from linkedin to github field")
        if github_val and "linkedin.com" in github_val.lower():
            if not linkedin_val:
                contact["linkedin"] = github_val
            contact["github"] = ""
            logger.warning("Contact cross-contamination: moved linkedin.com URL from github to linkedin field")

        # --- FINAL: LinkedIn href is authoritative — override everything ---
        # This runs AFTER all other processing (fabrication, cross-contamination, regex).
        # The PDF annotation URL is the single source of truth for LinkedIn.
        if linkedin_href:
            contact["linkedin"] = linkedin_href
            logger.info("Contact backfill: LinkedIn FINAL override from PDF href: %s", linkedin_href)

        # Normalize LinkedIn and GitHub URLs to canonical forms
        if contact.get("linkedin"):
            contact["linkedin"] = ResumeParser._normalize_linkedin(contact["linkedin"])
        if contact.get("github"):
            contact["github"] = ResumeParser._normalize_github(contact["github"])

        result["contact"] = contact
        return result

    @staticmethod
    def _normalize_linkedin(url: str) -> str:
        """Normalize a LinkedIn URL to https://linkedin.com/in/username format.

        Handles common malformations:
          - Missing protocol: linkedin.com/in/user → https://linkedin.com/in/user
          - Missing /in/: linkedin.com/user → https://linkedin.com/in/user
          - www prefix: www.linkedin.com/in/user → https://linkedin.com/in/user
          - Trailing slashes, query params, fragments
        """
        url = url.strip()
        if not url:
            return ""
        # Match canonical /in/username form
        match = re.search(r'linkedin\.com/in/([\w-]+)', url, re.IGNORECASE)
        if match:
            return f"https://linkedin.com/in/{match.group(1)}"
        # Match linkedin.com/username (missing /in/) — insert /in/
        match = re.search(r'linkedin\.com/([\w-]+)', url, re.IGNORECASE)
        if match:
            username = match.group(1)
            # Exclude known LinkedIn subpaths that aren't usernames
            if username.lower() not in (
                "pub", "company", "school", "jobs", "feed",
                "messaging", "in", "notifications", "mynetwork",
            ):
                return f"https://linkedin.com/in/{username}"
        # Fallback: if it contains linkedin.com, just normalize protocol
        if "linkedin.com" in url.lower():
            url = re.sub(r'^(https?://)?(www\.)?', 'https://', url)
            return url.rstrip("/")
        return url

    @staticmethod
    def _normalize_github(url: str) -> str:
        """Normalize a GitHub URL to https://github.com/username format.

        Handles missing protocol, www prefix, trailing slashes.
        """
        url = url.strip()
        if not url:
            return ""
        match = re.search(r'github\.com/([\w-]+)', url, re.IGNORECASE)
        if match:
            username = match.group(1)
            return f"https://github.com/{username}"
        if "github.com" in url.lower():
            url = re.sub(r'^(https?://)?(www\.)?', 'https://', url)
            return url.rstrip("/")
        return url

    @staticmethod
    def _backfill_education(result: dict, raw_text: str) -> dict:
        """Backfill empty education institution names from raw text.

        Gemini sometimes extracts the degree and dates but omits the
        institution name. This method searches the raw text for common
        university name patterns near the degree text.

        Args:
            result: Parsed resume dict with possibly empty education institutions.
            raw_text: Original raw text extracted from the PDF.

        Returns:
            The same dict with education institutions backfilled where empty.
        """
        education = result.get("education", [])
        if not education:
            return result

        # Common university name patterns
        uni_pattern = re.compile(
            r'(?:University|Institute|College|School|Academy)'
            r'(?:\s+of\s+[\w\s]+)?',
            re.IGNORECASE
        )

        for edu_entry in education:
            if not isinstance(edu_entry, dict):
                continue
            if edu_entry.get("institution", "").strip():
                continue  # Already has an institution

            # Strategy 1: Search near the degree text in raw_text
            degree = edu_entry.get("degree", "")
            if degree:
                # Look for university names within ~200 chars of the degree text
                degree_idx = raw_text.lower().find(degree.lower()[:30])
                if degree_idx >= 0:
                    search_window = raw_text[max(0, degree_idx - 200):degree_idx + 200]
                    # Look for lines that look like university names
                    for line in search_window.split("\n"):
                        line = line.strip()
                        if uni_pattern.search(line) and len(line) < 100:
                            # Clean up the line — take just the institution part
                            edu_entry["institution"] = line
                            logger.info(
                                "Education backfill: found institution '%s' near degree '%s'",
                                line, degree
                            )
                            break

            # Strategy 2: If still empty, search for university name patterns globally
            if not edu_entry.get("institution", "").strip():
                for line in raw_text.split("\n"):
                    line = line.strip()
                    if (
                        uni_pattern.search(line)
                        and len(line) < 100
                        and not line.startswith("[")
                    ):
                        edu_entry["institution"] = line
                        logger.info(
                            "Education backfill: found institution '%s' via global search",
                            line
                        )
                        break

        return result

    @staticmethod
    def _clean_education_fields(result: dict) -> dict:
        """Strip date patterns and duplicate segments from education degree fields.

        Gemini sometimes returns degree fields with dates baked in, e.g.:
          degree: "Master of Science, Information Technology | Dec 2025"
        or even:
          degree: "Master of Science, IT | Dec 2025 | Master of Science, IT"

        This method:
          1. Detects and removes date patterns from degree fields
          2. Removes pipe-separated duplicate segments within degree
          3. Extracts dates into the dates field if dates was empty
        """
        _DATE_RE = re.compile(
            r'\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|'
            r'Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|'
            r'Dec(?:ember)?)\s+\d{4}\b'
            r'|\b(?:Spring|Fall|Summer|Winter)\s+\d{4}\b',
            re.IGNORECASE,
        )

        education = result.get("education", [])
        for edu in education:
            if not isinstance(edu, dict):
                continue

            degree = edu.get("degree", "").strip()
            if not degree:
                continue

            # Step 1: If degree contains pipe characters, split and deduplicate
            if "|" in degree:
                segments = [s.strip() for s in degree.split("|") if s.strip()]
                date_segments = []
                non_date_segments = []
                seen = set()
                for seg in segments:
                    seg_stripped = _DATE_RE.sub("", seg).strip()
                    if not seg_stripped:
                        date_segments.append(seg)
                    else:
                        key = seg_stripped.lower()
                        if key not in seen:
                            seen.add(key)
                            non_date_segments.append(seg_stripped)

                if non_date_segments:
                    degree = non_date_segments[0]
                if not edu.get("dates", "").strip() and date_segments:
                    edu["dates"] = " - ".join(date_segments)

            # Step 2: Even without pipes, strip inline date patterns from degree
            cleaned = _DATE_RE.sub("", degree).strip()
            cleaned = re.sub(r'^[\s|,\-]+|[\s|,\-]+$', '', cleaned)
            if cleaned:
                edu["degree"] = cleaned

        return result

    @staticmethod
    def _validate_critical_fields(result: dict):
        """Log warnings for any missing critical fields after all backfills.

        This is a diagnostic method — it doesn't modify the result, just
        logs clear warnings so that issues are visible in the server logs
        and can be debugged easily.

        Critical fields checked:
          - contact: name, email
          - education: institution (for each entry)
          - experience: company, title (for each entry)
        """
        # Check contact
        contact = result.get("contact", {})
        missing_contact = []
        if not contact.get("name", "").strip():
            missing_contact.append("name")
        if not contact.get("email", "").strip():
            missing_contact.append("email")
        if not contact.get("phone", "").strip():
            logger.info(
                "PARSE VALIDATION: Phone number missing — raw text may not contain one, "
                "or regex backfill did not match."
            )
        if missing_contact:
            logger.warning(
                "PARSE VALIDATION: Missing critical contact fields: %s",
                ", ".join(missing_contact)
            )

        # Check education
        for i, edu in enumerate(result.get("education", [])):
            if not edu.get("institution", "").strip():
                logger.warning(
                    "PARSE VALIDATION: Education[%d] has empty institution "
                    "(degree: '%s', location: '%s')",
                    i, edu.get("degree", "?"), edu.get("location", "?")
                )

        # Check experience
        for i, exp in enumerate(result.get("experience", [])):
            if not exp.get("company", "").strip():
                logger.warning(
                    "PARSE VALIDATION: Experience[%d] has empty company", i
                )
            if not exp.get("title", "").strip():
                logger.warning(
                    "PARSE VALIDATION: Experience[%d] has empty title", i
                )

    # ======================================================================
    # 3. FULL UPLOAD PIPELINE
    # ======================================================================

    def upload_and_parse(self, file_bytes: bytes) -> dict:
        """Full synchronous pipeline: extract → parse → validate → store.

        This is the legacy synchronous path. The async path (used by the
        /upload endpoint) calls parse_to_structured() and save_parsed_resume()
        separately via the background job worker.

        Args:
            file_bytes: Raw PDF file content as bytes.

        Returns:
            The stored document dict (includes structured JSON, raw_text,
            flat skill list, experience_years, and job_titles).
        """
        raw_text = self.extract_text_from_pdf(file_bytes)
        structured = self.parse_to_structured(raw_text)
        return self.save_parsed_resume(structured, raw_text)

    def save_parsed_resume(self, structured: dict, raw_text: str) -> dict:
        """Build flat status fields, persist to MongoDB, and return the document.

        This method is separated from upload_and_parse so the async job worker
        can call it independently after Gemini parsing completes.

        Flat fields (skills, experience_years, job_titles, summary) are stored
        alongside the full structured JSON for backward compatibility with
        the GET /api/resume/status endpoint.

        Storage model: single-user — the previous resume is fully replaced.

        Args:
            structured: Validated structured resume JSON.
            raw_text: Original extracted text (stored for fallback and repair).

        Returns:
            The stored document dict with _id removed.
        """
        # Derive flat status fields from the structured data
        flat_skills = flatten_skills(structured)
        job_titles = extract_job_titles(structured)
        experience_years = self._estimate_experience_years(structured)
        summary = structured.get("summary", "")

        doc = {
            "structured": structured,
            "raw_text": raw_text[:_MAX_TEXT_CHARS],
            "raw_text_length": len(raw_text),
            "skills": flat_skills,
            "experience_years": experience_years,
            "job_titles": job_titles,
            "summary": summary,
            "education": [
                {
                    "degree": edu.get("degree", ""),
                    "institution": edu.get("institution", ""),
                    "year": (
                        edu.get("dates", "").split("–")[-1].strip()
                        if edu.get("dates")
                        else ""
                    ),
                }
                for edu in structured.get("education", [])
            ],
            "certifications": [],
            "parsed_at": datetime.now(timezone.utc),
        }

        # Single-user storage: replace any existing resume
        self.user_resumes.delete_many({})
        self.user_resumes.insert_one(doc)

        doc.pop("_id", None)
        return doc

    # ======================================================================
    # 4. RETRIEVAL
    # ======================================================================

    def get_structured_resume(self) -> Optional[Dict[str, Any]]:
        """Retrieve the latest stored structured resume from MongoDB.

        Returns:
            The resume document dict with _id removed, or None if no resume
            has been uploaded yet.
        """
        resume = self.user_resumes.find_one({}, sort=[("parsed_at", -1)])
        if resume:
            resume.pop("_id", None)
        return resume

    # ======================================================================
    # 5. HELPERS
    # ======================================================================

    @staticmethod
    def _estimate_experience_years(structured: dict) -> int:
        """Estimate total years of professional experience from date ranges.

        Parses experience entry dates (e.g., "May 2021 – Present") to calculate
        month-level duration. Handles various formats:
          - "Jan 2020 – Dec 2022"  → 36 months → 3 years
          - "May 2021 – Present"   → months until now
          - "2019 – 2021"          → 24 months → 2 years
          - "Aug 2025 - Current"   → months until now

        Falls back to year-only calculation if month abbreviations aren't found.

        Args:
            structured: Parsed resume dict with 'experience' entries.

        Returns:
            Estimated total years of experience (minimum 1 if any work found,
            0 if no parseable dates exist).
        """
        total_months = 0
        now = datetime.now()
        current_year = now.year
        current_month = now.month

        for exp in structured.get("experience", []):
            dates = exp.get("dates", "")
            if not dates:
                continue

            # Extract 4-digit years (e.g., 2020, 2023)
            years = _YEAR_PATTERN.findall(dates)

            # Extract month abbreviations (e.g., "Jan", "May", "December")
            months = [
                m.group(0).lower()[:3]
                for m in _MONTH_PATTERN.finditer(dates)
            ]

            if len(years) >= 2:
                # Date range with start and end years
                try:
                    start_year = int(years[0])
                    end_year = int(years[-1])
                    start_m = _MONTH_MAP.get(months[0], 1) if months else 1
                    end_m = (
                        _MONTH_MAP.get(months[-1] if len(months) >= 2 else "", 12)
                        if months
                        else 12
                    )
                    total_months += (end_year - start_year) * 12 + (end_m - start_m)
                except (ValueError, IndexError):
                    # Fallback: year-only calculation
                    total_months += (int(years[-1]) - int(years[0])) * 12

            elif len(years) == 1:
                # Single year — check if it extends to "Present"
                dates_lower = dates.lower()
                if any(kw in dates_lower for kw in _PRESENT_KEYWORDS):
                    try:
                        start_year = int(years[0])
                        start_m = _MONTH_MAP.get(months[0], 1) if months else 1
                        total_months += (
                            (current_year - start_year) * 12
                            + (current_month - start_m)
                        )
                    except (ValueError, IndexError):
                        total_months += (current_year - int(years[0])) * 12

        return max(1, total_months // 12) if total_months > 0 else 0
