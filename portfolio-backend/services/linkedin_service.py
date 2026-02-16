"""
LinkedIn lookup service - Find LinkedIn profiles and extract organization from names/headlines.

Uses multi-strategy search with result scoring to accurately identify profiles.
Priority: user-provided URL > name+org search > name-only search > Google fallback.
All name parts (first, middle, last) and email domain are used to narrow results.
"""
import logging
import re
from urllib.parse import unquote

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


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

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


def _get_org_hint(email: str) -> str:
    """Extract organization hint from a non-personal email domain."""
    if not email or "@" not in email:
        return ""
    try:
        domain = email.strip().split("@")[1].lower()
        if _is_personal_domain(domain):
            return ""
        return domain.split(".")[0]  # e.g. "google" from "user@google.com"
    except Exception:
        return ""


def _normalize_name(name: str) -> str:
    """Lowercase and strip a name part for comparison."""
    return (name or "").strip().lower()


def _extract_linkedin_slug(url: str) -> str:
    """Extract the slug from a LinkedIn profile URL."""
    match = re.search(r"linkedin\.com/in/([a-zA-Z0-9_%-]+)", url)
    if match:
        return unquote(match.group(1)).lower().rstrip("/")
    return ""


# ---------------------------------------------------------------------------
# Result scoring — ensures the found profile actually matches the person
# ---------------------------------------------------------------------------

def _score_result(
    result_text: str,
    result_url: str,
    first_name: str,
    middle_name: str,
    last_name: str,
    org_hint: str,
) -> int:
    """
    Score a search result on how well it matches the person.
    Higher = better match.  Range roughly 0–100.

    Checks:
    - First name present in text or URL slug        (+30)
    - Last name present in text or URL slug         (+30)
    - Middle name present in text or URL slug       (+15)
    - Organization hint present in text             (+20)
    - Slug contains name parts                      (+5 bonus)
    """
    score = 0
    text = result_text.lower()
    slug = _extract_linkedin_slug(result_url)

    fn = _normalize_name(first_name)
    mn = _normalize_name(middle_name)
    ln = _normalize_name(last_name)
    org = _normalize_name(org_hint)

    # First name
    if fn and (fn in text or fn in slug):
        score += 30

    # Last name
    if ln and (ln in text or ln in slug):
        score += 30

    # Middle name (bonus, not required)
    if mn and (mn in text or mn in slug):
        score += 15

    # Organization hint from email domain
    if org and org in text:
        score += 20

    # Bonus if the slug itself contains both first and last name parts
    if fn and ln and fn in slug and ln in slug:
        score += 5

    return score


# ---------------------------------------------------------------------------
# Organization extraction
# ---------------------------------------------------------------------------

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
    at_match = re.search(r"\s+at\s+(.+?)(?:\s*[|\-–]|$)", headline, re.IGNORECASE)
    if at_match:
        return at_match.group(1).strip()
    dash_match = re.search(r"\s+[-–]\s+(.+?)$", headline)
    if dash_match:
        return dash_match.group(1).strip()
    return None


# ---------------------------------------------------------------------------
# URL validation
# ---------------------------------------------------------------------------

def validate_linkedin_url(url: str) -> str | None:
    """
    Validate and normalize a LinkedIn profile URL.
    Returns the cleaned URL if valid, None otherwise.
    """
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    match = re.match(
        r"^(?:https?://)?(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)/?$",
        url,
    )
    if match:
        slug = match.group(1)
        return f"https://www.linkedin.com/in/{slug}"
    return None


# ---------------------------------------------------------------------------
# Search strategies — each returns a list of candidate dicts
# ---------------------------------------------------------------------------

def _ddg_search(query: str, source_label: str) -> list[dict]:
    """Run a DuckDuckGo search and return all LinkedIn /in/ candidates."""
    candidates = []
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=10))
        for r in results:
            href = (r.get("href") or "").strip()
            if "linkedin.com/in/" in href:
                title = (r.get("title") or "").strip()
                body = (r.get("body") or "").strip()
                headline = title or body
                org = extract_organization_from_headline(headline)
                candidates.append({
                    "found": True,
                    "url": href,
                    "headline": headline,
                    "organization_from_headline": org,
                    "source": source_label,
                })
    except Exception as e:
        logger.debug("DuckDuckGo search failed (%s): %s", source_label, e)
    return candidates


def _google_search(query: str) -> list[dict]:
    """Google HTML scrape fallback — returns LinkedIn /in/ candidates."""
    candidates = []
    try:
        resp = requests.get(
            "https://www.google.com/search",
            params={"q": query},
            timeout=6,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
        )
        if resp.status_code != 200:
            return candidates
        pattern = r"https?://(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)"
        seen = set()
        for slug in re.findall(pattern, resp.text):
            if slug in seen:
                continue
            seen.add(slug)
            candidates.append({
                "found": True,
                "url": f"https://www.linkedin.com/in/{slug}",
                "headline": "",
                "organization_from_headline": None,
                "source": "google",
            })
    except Exception as e:
        logger.debug("Google LinkedIn search failed: %s", e)
    return candidates


def _bing_search(query: str) -> list[dict]:
    """Bing HTML scrape fallback — returns LinkedIn /in/ candidates."""
    candidates = []
    try:
        resp = requests.get(
            "https://www.bing.com/search",
            params={"q": query},
            timeout=6,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
        )
        if resp.status_code != 200:
            return candidates
        pattern = r"https?://(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)"
        seen = set()
        for slug in re.findall(pattern, resp.text):
            if slug in seen:
                continue
            seen.add(slug)
            candidates.append({
                "found": True,
                "url": f"https://www.linkedin.com/in/{slug}",
                "headline": "",
                "organization_from_headline": None,
                "source": "bing",
            })
    except Exception as e:
        logger.debug("Bing LinkedIn search failed: %s", e)
    return candidates


def _pick_best_candidate(
    candidates: list[dict],
    first_name: str,
    middle_name: str,
    last_name: str,
    org_hint: str,
    min_score: int = 25,
) -> dict | None:
    """
    Score all candidates and return the best one that exceeds min_score.
    A min_score of 25 means at least the first name OR last name must match.
    """
    if not candidates:
        return None

    best = None
    best_score = -1

    for c in candidates:
        text = f"{c.get('headline', '')} {c.get('url', '')}"
        s = _score_result(text, c.get("url", ""), first_name, middle_name, last_name, org_hint)
        if s > best_score:
            best_score = s
            best = c

    if best and best_score >= min_score:
        best["match_score"] = best_score
        return best
    return None


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def search_linkedin_profile(
    first_name: str,
    last_name: str,
    email: str | None = None,
    linkedin_url: str | None = None,
    middle_name: str | None = None,
) -> dict:
    """
    Find LinkedIn profile for the given person.

    Uses all available info (first, middle, last name + email domain) to
    build multiple search queries in decreasing specificity, then scores
    every candidate result to pick the best match.

    Priority order:
    1. User-provided LinkedIn URL (validated) — instant, 100% accurate
    2. DuckDuckGo: full name + middle + org hint (most specific)
    3. DuckDuckGo: full name + org hint
    4. DuckDuckGo: full name only
    5. Google fallback with best query
    6. Bing fallback with best query

    Returns dict with found, url, headline, organization_from_headline, source.
    """
    # 1. User-provided URL takes top priority
    if linkedin_url:
        validated_url = validate_linkedin_url(linkedin_url)
        if validated_url:
            return {
                "found": True,
                "url": validated_url,
                "headline": "",
                "organization_from_headline": None,
                "source": "user_provided",
            }

    first_name = (first_name or "").strip()
    middle_name = (middle_name or "").strip()
    last_name = (last_name or "").strip()
    email = (email or "").strip()

    if not first_name and not last_name:
        return {"found": False, "source": "none"}

    org_hint = _get_org_hint(email)

    # Build the full name string (with middle name if available)
    if middle_name:
        full_name = f"{first_name} {middle_name} {last_name}"
    else:
        full_name = f"{first_name} {last_name}"

    # --- Strategy 2: Most specific — full name + middle + org hint ---
    if middle_name and org_hint:
        query = f'"{full_name}" {org_hint} site:linkedin.com/in'
        candidates = _ddg_search(query, "ddg_fullname_org")
        best = _pick_best_candidate(candidates, first_name, middle_name, last_name, org_hint)
        if best:
            return best

    # --- Strategy 3: Full name + org hint (no middle) ---
    if org_hint:
        query = f'"{first_name} {last_name}" {org_hint} site:linkedin.com/in'
        candidates = _ddg_search(query, "ddg_name_org")
        best = _pick_best_candidate(candidates, first_name, middle_name, last_name, org_hint)
        if best:
            return best

    # --- Strategy 4: Full name with middle (no org) ---
    if middle_name:
        query = f'"{full_name}" site:linkedin.com/in'
        candidates = _ddg_search(query, "ddg_fullname")
        best = _pick_best_candidate(candidates, first_name, middle_name, last_name, org_hint)
        if best:
            return best

    # --- Strategy 5: First + last name only (broadest DuckDuckGo) ---
    query = f'"{first_name} {last_name}" site:linkedin.com/in'
    candidates = _ddg_search(query, "ddg_name")
    best = _pick_best_candidate(candidates, first_name, middle_name, last_name, org_hint)
    if best:
        return best

    # --- Strategy 6: Google fallback ---
    google_query = f'"{full_name}"'
    if org_hint:
        google_query += f" {org_hint}"
    google_query += " site:linkedin.com/in"
    candidates = _google_search(google_query)
    best = _pick_best_candidate(candidates, first_name, middle_name, last_name, org_hint)
    if best:
        return best

    # --- Strategy 7: Bing fallback ---
    candidates = _bing_search(google_query)
    best = _pick_best_candidate(candidates, first_name, middle_name, last_name, org_hint)
    if best:
        return best

    logger.info("LinkedIn profile not found for: %s %s %s", first_name, middle_name, last_name)
    return {"found": False, "source": "all_exhausted"}
