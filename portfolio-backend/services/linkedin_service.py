"""
LinkedIn lookup service - Find LinkedIn profiles and extract organization from names/headlines.

Uses duckduckgo-search library for web search (primary) and optional Google HTML fallback.
Extracts organization from email domain and from LinkedIn headline text.
"""
import logging
import re

import requests
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

# Browser-like User-Agent for Google fallback requests
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

# Institutional/organizational domains (verified organizations - not personal providers)
INSTITUTIONAL_DOMAINS = {
    "asu.edu", "edu", "mit.edu", "stanford.edu", "harvard.edu",
    "yale.edu", "princeton.edu", "berkeley.edu", "caltech.edu",
    "cmu.edu", "cornell.edu", "univ", "ac.uk", "org", "gov",
}

# Common misspellings / typos of personal email domains
PERSONAL_DOMAIN_TYPOS = {
    # Gmail typos
    "gmial.com", "gamil.com", "gmai.com", "gmil.com",
    "gmal.com", "gnail.com", "gmaill.com", "gmali.com", "gimail.com",
    "gamail.com", "gmsil.com", "gmeil.com", "gmaul.com", "gmaol.com",
    "gmailcom", "gail.com", "gemail.com", "gmqil.com", "gmaio.com",
    "gmail.co", "gmail.cm", "gmail.om", "gmail.con", "gmail.cim",
    # Yahoo typos
    "yaho.com", "yahooo.com", "yhoo.com", "yaoo.com", "yhaoo.com",
    "yahoo.co", "yahoo.cm",
    # Hotmail typos
    "hotmial.com", "hotmal.com", "hotmali.com", "hotmaill.com",
    "hotmai.com", "hotamil.com", "hotmail.co",
    # Outlook typos
    "outlok.com", "outllook.com", "outlookk.com", "outloo.com",
    "outlool.com", "outlook.co",
}


def _is_personal_domain(domain: str) -> bool:
    """
    Check if a domain is a personal email provider, including common typos.
    Uses exact match first, then Levenshtein-like similarity for edge cases.
    """
    domain = domain.lower().strip()
    if domain in PERSONAL_DOMAINS or domain in PERSONAL_DOMAIN_TYPOS:
        return True
    
    # Check if it's an institutional domain (whitelist - these are NOT personal)
    if domain in INSTITUTIONAL_DOMAINS or any(domain.endswith(f".{inst}") for inst in INSTITUTIONAL_DOMAINS):
        return False

    # Check if the domain name (without TLD) is very similar to a known personal domain
    domain_name = domain.split(".")[0]
    personal_names = {"gmail", "yahoo", "hotmail", "outlook", "icloud", "aol",
                      "protonmail", "mail", "live", "msn", "ymail", "googlemail"}

    for pn in personal_names:
        # If the domain name is within edit distance of 2 from a known personal name
        if _edit_distance(domain_name, pn) <= 2:
            return True

    return False


def _edit_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return _edit_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


def extract_organization_from_email(email: str) -> str | None:
    """
    Infer organization name from email domain (e.g. john@acme.com -> Acme).
    Returns None for personal email providers and common misspellings.
    """
    if not email or "@" not in email:
        return None
    try:
        domain = email.strip().split("@")[1].lower()
        if _is_personal_domain(domain):
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
    """DuckDuckGo web search via duckduckgo-search library - returns LinkedIn profile URLs."""
    try:
        query = f"{first_name} {last_name} site:linkedin.com/in"
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=10))
        for r in results:
            href = (r.get("href") or "").strip()
            if "linkedin.com/in/" in href:
                title = (r.get("title") or "").strip()
                body = (r.get("body") or "").strip()
                headline = title or body
                org = extract_organization_from_headline(headline)
                return {
                    "found": True,
                    "url": href,
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
