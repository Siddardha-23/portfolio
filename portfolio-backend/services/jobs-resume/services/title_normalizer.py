"""
Title Case Normalizer — normalizes experience titles and project names to Title Case.

Pure Python, no AI calls. Converts ALL CAPS, lowercase, or mixed case to
consistent Title Case while preserving known acronyms (AWS, CI/CD, API, etc.).

Examples:
  "CLOUD DEVOPS ENGINEER"     → "Cloud DevOps Engineer"
  "software developer intern" → "Software Developer Intern"
  "FULL STACK DEVELOPER"      → "Full Stack Developer"
  "senior AWS cloud engineer" → "Senior AWS Cloud Engineer"
  "AWS-INFRASTRUCTURE-AUTOMATION" → "AWS Infrastructure Automation"
"""
import re
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

# Acronyms and special words that should stay uppercase
_ACRONYMS = frozenset({
    "AWS", "GCP", "API", "APIs", "REST", "SQL", "NoSQL", "CI", "CD", "CI/CD",
    "HTML", "CSS", "JS", "UI", "UX", "AI", "ML", "NLP", "ETL", "SRE", "SDE",
    "DevOps", "MLOps", "AIOps", "QA", "PM", "VP", "CTO", "CEO", "CFO", "CIO",
    "ECS", "EKS", "EC2", "S3", "RDS", "IAM", "VPC", "SQS", "SNS", "DynamoDB",
    "CloudFormation", "CloudWatch", "CloudFront", "CloudTrail",
    "IaC", "IoT", "SaaS", "PaaS", "IaaS", "SDK", "CLI", "SSH", "TCP", "HTTP",
    "HTTPS", "DNS", "CDN", "LLM", "GPU", "CPU", "RAM", "OS", "IT", "IP",
    "PhD", "MSc", "BSc", "MBA", "LLC", "Inc", "FAANG", "MAANG",
    "React", "TypeScript", "JavaScript", "Python", "Golang", "Node.js",
    "MongoDB", "PostgreSQL", "MySQL", "Redis", "Kafka",
    "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub",
    "Linux", "Windows", "macOS", "iOS", "Android",
    "II", "III", "IV", "Jr", "Sr",
})

# Build a lookup: lowercase → correct form
_ACRONYM_MAP = {a.lower(): a for a in _ACRONYMS}

# Words that should stay lowercase in titles (unless first word)
_LOWERCASE_WORDS = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "into", "via",
})


def _title_case_word(word: str, is_first: bool = False) -> str:
    """Convert a single word to proper title case, preserving acronyms."""
    lower = word.lower()

    # Check acronym map first
    if lower in _ACRONYM_MAP:
        return _ACRONYM_MAP[lower]

    # Handle hyphenated words: "full-stack" → "Full-Stack"
    if "-" in word and not word.startswith("-"):
        parts = word.split("-")
        return "-".join(_title_case_word(p, i == 0) for i, p in enumerate(parts))

    # Handle slash-separated: "CI/CD" already caught, but "frontend/backend" → "Frontend/Backend"
    if "/" in word and word not in _ACRONYM_MAP:
        parts = word.split("/")
        return "/".join(_title_case_word(p, True) for p in parts)

    # Lowercase articles/prepositions (unless first word)
    if lower in _LOWERCASE_WORDS and not is_first:
        return lower

    # Default: capitalize first letter
    if word:
        return word[0].upper() + word[1:].lower() if len(word) > 1 else word.upper()
    return word


def _normalize_title(text: str) -> str:
    """Normalize a title string to Title Case."""
    if not text or not text.strip():
        return text

    # If already mixed case (not all upper, not all lower), it's likely intentional
    stripped = text.strip()
    is_all_upper = stripped == stripped.upper() and any(c.isalpha() for c in stripped)
    is_all_lower = stripped == stripped.lower() and any(c.isalpha() for c in stripped)

    if not is_all_upper and not is_all_lower:
        # Mixed case — only fix obvious issues (words that should be acronyms)
        words = stripped.split()
        result = []
        for w in words:
            lower = w.lower().rstrip(".,;:")
            suffix = w[len(lower):]
            if lower in _ACRONYM_MAP:
                result.append(_ACRONYM_MAP[lower] + suffix)
            else:
                result.append(w)
        return " ".join(result)

    # All upper or all lower — apply full title case
    words = stripped.split()
    return " ".join(_title_case_word(w, i == 0) for i, w in enumerate(words))


def normalize_titles(resume: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize titles and names in a resume dict to consistent Title Case.

    Applies to:
      - experience[].title
      - projects[].name
    """
    # Experience titles
    for exp in resume.get("experience", []):
        if exp.get("title"):
            original = exp["title"]
            normalized = _normalize_title(original)
            if original != normalized:
                logger.info("Title normalized: '%s' → '%s'", original, normalized)
                exp["title"] = normalized

    # Project names
    for proj in resume.get("projects", []):
        if proj.get("name"):
            original = proj["name"]
            normalized = _normalize_title(original)
            if original != normalized:
                logger.info("Project name normalized: '%s' → '%s'", original, normalized)
                proj["name"] = normalized

    return resume
