"""
LinkedIn lookup service - Find LinkedIn profiles and extract organization from names/headlines.

Uses DuckDuckGo Instant Answer API (primary) and optional Google search fallback.
Extracts organization from email domain and from LinkedIn headline text.
"""
import logging
import re
import requests

logger = logging.getLogger(__name__)

# Browser-like User-Agent for search requests
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Personal email domains - no organization inferred
PERSONAL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "aol.com", "protonmail.com", "mail.com",
    "live.com", "msn.com", "ymail.com", "googlemail.com",
}


def extract_organization_from_email(email: str) -> str | None:
    """
    Infer organization name from email domain (e.g. john@acme.com -> Acme).
    Returns None for personal email providers.
    """
    if not email or "@" not in email:
        return None
    try:
        domain = email.strip().split("@")[1].lower()
        if domain in PERSONAL_DOMAINS:
            return None
        # Use first part of domain as company name
        company = domain.split(".")[0]
        return company.title() if company else None
    except Exception:
        return None


def extract_organization_from_headline(headline: str) -> str | None:
    """
    Extract company name from LinkedIn-style headline (e.g. "Engineer at Google" -> Google).
    """
    if not headline or not isinstance(headline, str):
        return None
    headline = headline.strip()
    # "Title at Company" or "Title - Company"
    at_match = re.search(r"\s+at\s+(.+?)(?:\s*[|\-–]|$)", headline, re.IGNORECASE)
    if at_match:
        return at_match.group(1).strip()
    dash_match = re.search(r"\s+[-–]\s+(.+?)$", headline)
    if dash_match:
        return dash_match.group(1).strip()
    return None


def _search_linkedin_duckduckgo(first_name: str, last_name: str) -> dict:
    """DuckDuckGo Instant Answer API - no auth, privacy-respecting."""
    try:
        query = f"{first_name} {last_name} site:linkedin.com/in"
        url = f"https://api.duckduckgo.com/?q={query}&format=json&no_html=1"
        resp = requests.get(url, timeout=5, headers={"User-Agent": USER_AGENT})
        if resp.status_code != 200:
            return {"found": False, "source": "duckduckgo"}
        data = resp.json()
        if data.get("AbstractURL") and "linkedin.com" in (data.get("AbstractURL") or ""):
            headline = (data.get("AbstractText") or "").strip()
            org = extract_organization_from_headline(headline)
            return {
                "found": True,
                "url": data.get("AbstractURL"),
                "headline": headline,
                "organization_from_headline": org,
                "source": "duckduckgo",
            }
        for topic in data.get("RelatedTopics") or []:
            if isinstance(topic, dict) and "FirstURL" in topic:
                url_val = topic.get("FirstURL") or ""
                if "linkedin.com/in" in url_val:
                    headline = (topic.get("Text") or "").strip()
                    org = extract_organization_from_headline(headline)
                    return {
                        "found": True,
                        "url": url_val,
                        "headline": headline,
                        "organization_from_headline": org,
                        "source": "duckduckgo",
                    }
        return {"found": False, "source": "duckduckgo"}
    except Exception as e:
        logger.debug("DuckDuckGo LinkedIn search failed: %s", e)
        return {"found": False, "source": "duckduckgo", "error": str(e)}


def _search_linkedin_google(first_name: str, last_name: str) -> dict:
    """
    Try to find LinkedIn profile via Google search HTML.
    Often blocked or captcha; use as best-effort only.
    """
    try:
        query = f"{first_name} {last_name} site:linkedin.com/in"
        url = "https://www.google.com/search"
        params = {"q": query}
        resp = requests.get(
            url,
            params=params,
            timeout=6,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
        )
        if resp.status_code != 200:
            return {"found": False, "source": "google"}
        html = resp.text
        # Match LinkedIn profile URLs
        pattern = r"https?://(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)"
        matches = re.findall(pattern, html)
        if matches:
            # Prefer first match (likely first result)
            slug = matches[0]
            profile_url = f"https://www.linkedin.com/in/{slug}"
            return {
                "found": True,
                "url": profile_url,
                "headline": "",
                "organization_from_headline": None,
                "source": "google",
            }
        return {"found": False, "source": "google"}
    except Exception as e:
        logger.debug("Google LinkedIn search failed: %s", e)
        return {"found": False, "source": "google", "error": str(e)}


def search_linkedin_profile(first_name: str, last_name: str, email: str | None = None) -> dict:
    """
    Find LinkedIn profile for the given name. Tries DuckDuckGo first, then Google.
    Returns dict with found, url, headline, organization_from_headline, source.
    """
    first_name = (first_name or "").strip()
    last_name = (last_name or "").strip()
    if not first_name and not last_name:
        return {"found": False, "source": "none"}

    result = _search_linkedin_duckduckgo(first_name, last_name)
    if result.get("found"):
        return result
    result = _search_linkedin_google(first_name, last_name)
    return result
