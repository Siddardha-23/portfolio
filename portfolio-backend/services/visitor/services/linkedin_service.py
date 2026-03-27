"""
LinkedIn lookup service - Find LinkedIn profiles and extract organization info.

Uses the `ddgs` meta-search library (successor to duckduckgo-search) which
aggregates results from Google, Bing, Brave, DuckDuckGo, Yahoo, and more.
All name parts (first, middle, last) and email domain are used.
Results are scored to ensure the found profile actually matches the person.
"""
import logging
import os
import re
from urllib.parse import unquote

import requests
from ddgs import DDGS

logger = logging.getLogger(__name__)

# Backends to try in order — "auto" lets ddgs pick the best available,
# then we fall back to explicit engines if auto fails.
DDGS_BACKENDS = ["auto", "google", "bing", "duckduckgo", "brave"]

# Optional: Serper.dev API key for high-reliability fallback (2500 free/month)
SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")

# Personal email domains - no organization inferred
PERSONAL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "aol.com", "protonmail.com", "mail.com",
    "live.com", "msn.com", "ymail.com", "googlemail.com",
}

# Institutional/organizational domains
INSTITUTIONAL_DOMAINS = {
    "asu.edu", "edu", "mit.edu", "stanford.edu", "harvard.edu",
    "yale.edu", "princeton.edu", "berkeley.edu", "caltech.edu",
    "cmu.edu", "cornell.edu", "univ", "ac.uk", "org", "gov",
}

# Notable organizations — top MNCs and universities (used to highlight on frontend)
# Only well-known companies and top-tier institutions; excludes small startups
NOTABLE_ORGS = {
    # Big Tech / FAANG+
    "google", "alphabet", "meta", "facebook", "amazon", "aws", "apple",
    "microsoft", "netflix", "nvidia", "tesla", "openai", "anthropic",
    "ibm", "oracle", "salesforce", "adobe", "intel", "amd", "qualcomm",
    "cisco", "vmware", "broadcom", "samsung", "sony", "uber", "lyft",
    "airbnb", "twitter", "x corp", "snap", "snapchat", "spotify",
    "paypal", "stripe", "square", "block", "shopify", "databricks",
    "snowflake", "palantir", "crowdstrike", "palo alto networks",
    "servicenow", "workday", "twilio", "cloudflare", "datadog",
    "mongodb", "elastic", "confluent", "hashicorp", "splunk",
    "linkedin", "github", "gitlab", "atlassian", "slack",
    "bytedance", "tiktok", "tencent", "alibaba", "baidu",
    # Consulting / Finance
    "mckinsey", "bcg", "bain", "deloitte", "accenture", "kpmg",
    "ernst & young", "ey", "pwc", "pricewaterhousecoopers",
    "goldman sachs", "jpmorgan", "jp morgan", "morgan stanley",
    "blackrock", "citadel", "two sigma", "jane street",
    "bank of america", "citigroup", "wells fargo", "hsbc",
    "barclays", "deutsche bank", "credit suisse", "ubs",
    # Defense / Aerospace
    "boeing", "lockheed martin", "raytheon", "northrop grumman",
    "spacex", "blue origin", "nasa", "isro",
    # Top Universities (global)
    "mit", "stanford", "harvard", "caltech", "princeton",
    "yale", "columbia", "cornell", "upenn", "penn",
    "uc berkeley", "berkeley", "ucla", "ucsd", "carnegie mellon",
    "cmu", "georgia tech", "gt", "university of michigan",
    "university of texas", "ut austin", "university of illinois",
    "uiuc", "university of washington", "uw",
    "university of maryland", "purdue", "virginia tech",
    "ohio state", "penn state", "nc state", "texas a&m",
    "arizona state", "asu",
    "oxford", "cambridge", "imperial college", "eth zurich",
    "iit", "iisc", "bits pilani", "nit",
    # Healthcare / Pharma
    "pfizer", "johnson & johnson", "j&j", "merck", "novartis",
    "roche", "abbvie", "amgen", "gilead", "moderna",
    # Other notable
    "walmart", "target", "costco", "procter & gamble", "p&g",
    "coca-cola", "pepsi", "pepsico", "unilever", "nestle",
    "general electric", "ge", "siemens", "3m", "honeywell",
    "toyota", "ford", "gm", "general motors", "bmw", "mercedes",
}

# Common misspellings of personal email domains
PERSONAL_DOMAIN_TYPOS = {
    "gmial.com", "gamil.com", "gmai.com", "gmil.com",
    "gmal.com", "gnail.com", "gmaill.com", "gmali.com", "gimail.com",
    "gamail.com", "gmsil.com", "gmeil.com", "gmaul.com", "gmaol.com",
    "gmailcom", "gail.com", "gemail.com", "gmqil.com", "gmaio.com",
    "gmail.co", "gmail.cm", "gmail.om", "gmail.con", "gmail.cim",
    "yaho.com", "yahooo.com", "yhoo.com", "yaoo.com", "yhaoo.com",
    "yahoo.co", "yahoo.cm",
    "hotmial.com", "hotmal.com", "hotmali.com", "hotmaill.com",
    "hotmai.com", "hotamil.com", "hotmail.co",
    "outlok.com", "outllook.com", "outlookk.com", "outloo.com",
    "outlool.com", "outlook.co",
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _is_personal_domain(domain: str) -> bool:
    domain = domain.lower().strip()
    if domain in PERSONAL_DOMAINS or domain in PERSONAL_DOMAIN_TYPOS:
        return True
    if domain in INSTITUTIONAL_DOMAINS or any(domain.endswith(f".{inst}") for inst in INSTITUTIONAL_DOMAINS):
        return False
    domain_name = domain.split(".")[0]
    personal_names = {"gmail", "yahoo", "hotmail", "outlook", "icloud", "aol",
                      "protonmail", "mail", "live", "msn", "ymail", "googlemail"}
    for pn in personal_names:
        if _edit_distance(domain_name, pn) <= 2:
            return True
    return False


def _edit_distance(s1: str, s2: str) -> int:
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
        return domain.split(".")[0]
    except Exception:
        return ""


def _normalize(s: str) -> str:
    return (s or "").strip().lower()


def _extract_linkedin_slug(url: str) -> str:
    match = re.search(r"linkedin\.com/in/([a-zA-Z0-9_%-]+)", url)
    if match:
        return unquote(match.group(1)).lower().rstrip("/")
    return ""


# ---------------------------------------------------------------------------
# Result scoring
# ---------------------------------------------------------------------------

def _score_result(
    result_text: str,
    result_url: str,
    first_name: str,
    middle_name: str,
    last_name: str,
    org_hint: str,
    location: dict | None = None,
) -> int:
    """
    Score how well a search result matches the person (0-120).

    Name matching (required — both first AND last must match for a good score):
    - First name in text/slug:  +30
    - Last name in text/slug:   +30
    - Middle name in text/slug: +15
    - Slug has first+last:       +5

    Context signals (boost confidence):
    - Org hint in text:         +20
    - Location (city/region/country) in text: +10 each (max +20)
    """
    score = 0
    text = result_text.lower()
    slug = _extract_linkedin_slug(result_url)
    fn = _normalize(first_name)
    mn = _normalize(middle_name)
    ln = _normalize(last_name)
    org = _normalize(org_hint)

    # --- Name matching ---
    fn_match = fn and (fn in text or fn in slug)
    ln_match = ln and (ln in text or ln in slug)

    if fn_match:
        score += 30
    if ln_match:
        score += 30
    if mn and (mn in text or mn in slug):
        score += 15
    if fn and ln and fn in slug and ln in slug:
        score += 5

    # --- Organization ---
    if org and org in text:
        score += 20

    # --- Location matching ---
    # LinkedIn headlines often contain location (e.g. "Engineer at Google | Hyderabad")
    if location:
        loc_bonus = 0
        city = _normalize(location.get("city", ""))
        region = _normalize(location.get("region", ""))
        country = _normalize(location.get("country", ""))
        # City is the strongest geo signal
        if city and len(city) > 2 and city in text:
            loc_bonus += 10
        # Region/state
        if region and len(region) > 2 and region in text:
            loc_bonus += 5
        # Country — only useful for non-US (too generic otherwise)
        if country and len(country) > 2 and country in text and country not in ("united states",):
            loc_bonus += 5
        score += min(loc_bonus, 20)  # cap geo bonus at 20

    return score


# ---------------------------------------------------------------------------
# Organization / headline extraction
# ---------------------------------------------------------------------------

def extract_organization_from_email(email: str) -> str | None:
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

def is_notable_org(org_name: str | None) -> bool:
    """Check if an organization name matches a notable company/university."""
    if not org_name:
        return False
    name = org_name.strip().lower()
    if name in NOTABLE_ORGS:
        return True
    # Check if any notable org keyword appears in the name
    for notable in NOTABLE_ORGS:
        if len(notable) >= 3 and notable in name:
            return True
    return False


def get_notable_org_name(headline: str | None, org_from_email: str | None) -> str | None:
    """
    Extract the notable org name from headline or email-derived org.
    Returns the display name if notable, None otherwise.
    """
    # Check headline-derived org first (more specific)
    org = extract_organization_from_headline(headline)
    if org and is_notable_org(org):
        return org.strip()
    # Fall back to email-derived org
    if org_from_email and is_notable_org(org_from_email):
        return org_from_email.strip()
    return None


def validate_linkedin_url(url: str) -> str | None:
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    match = re.match(
        r"^(?:https?://)?(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)/?$",
        url,
    )
    if match:
        return f"https://www.linkedin.com/in/{match.group(1)}"
    return None


# ---------------------------------------------------------------------------
# Search engines
# ---------------------------------------------------------------------------

def _ddgs_search(query: str, backend: str = "auto") -> list[dict]:
    """
    Search using the ddgs meta-search library.
    Returns list of LinkedIn profile candidates.
    """
    candidates = []
    try:
        results = DDGS().text(query, max_results=10, backend=backend)
        for r in results:
            href = (r.get("href") or r.get("link") or "").strip()
            if "linkedin.com/in/" in href:
                title = (r.get("title") or "").strip()
                body = (r.get("body") or r.get("snippet") or "").strip()
                headline = title or body
                candidates.append({
                    "found": True,
                    "url": href,
                    "headline": headline,
                    "organization_from_headline": extract_organization_from_headline(headline),
                    "source": f"ddgs_{backend}",
                })
    except Exception as e:
        logger.debug("DDGS search failed (backend=%s): %s", backend, e)
    return candidates


def _serper_search(query: str) -> list[dict]:
    """
    Serper.dev Google search API fallback (2500 free queries/month).
    Only used if SERPER_API_KEY env var is set.
    """
    if not SERPER_API_KEY:
        return []
    candidates = []
    try:
        resp = requests.post(
            "https://google.serper.dev/search",
            json={"q": query, "num": 10},
            headers={
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json",
            },
            timeout=8,
        )
        if resp.status_code != 200:
            return candidates
        for r in resp.json().get("organic", []):
            link = (r.get("link") or "").strip()
            if "linkedin.com/in/" in link:
                title = (r.get("title") or "").strip()
                snippet = (r.get("snippet") or "").strip()
                headline = title or snippet
                candidates.append({
                    "found": True,
                    "url": link,
                    "headline": headline,
                    "organization_from_headline": extract_organization_from_headline(headline),
                    "source": "serper",
                })
    except Exception as e:
        logger.debug("Serper search failed: %s", e)
    return candidates


# ---------------------------------------------------------------------------
# Candidate picker
# ---------------------------------------------------------------------------

def _pick_best(
    candidates: list[dict],
    first_name: str,
    middle_name: str,
    last_name: str,
    org_hint: str,
    location: dict | None = None,
    min_score: int = 70,
) -> dict | None:
    """
    Return the highest-scoring candidate above min_score.
    Default min_score=70 requires BOTH first AND last name to match plus
    additional signals (org, location, middle name, or slug match).
    This prevents returning wrong profiles for partial name matches.
    """
    if not candidates:
        return None
    best, best_score = None, -1
    for c in candidates:
        text = f"{c.get('headline', '')} {c.get('url', '')}"
        s = _score_result(
            text, c.get("url", ""),
            first_name, middle_name, last_name, org_hint, location,
        )
        if s > best_score:
            best_score = s
            best = c
    if best and best_score >= min_score:
        best["match_score"] = best_score
        return best
    return None


# ---------------------------------------------------------------------------
# Query builder
# ---------------------------------------------------------------------------

def _build_queries(
    first_name: str, middle_name: str, last_name: str, org_hint: str,
) -> list[str]:
    """
    Build search queries in decreasing specificity.
    More specific queries first = better chance of finding the right person.
    """
    queries = []

    if middle_name:
        full = f"{first_name} {middle_name} {last_name}"
    else:
        full = f"{first_name} {last_name}"
    short = f"{first_name} {last_name}"

    # Most specific: full name + org
    if middle_name and org_hint:
        queries.append(f'"{full}" {org_hint} site:linkedin.com/in')

    # Name + org
    if org_hint:
        queries.append(f'"{short}" {org_hint} site:linkedin.com/in')

    # Full name with middle (no org)
    if middle_name:
        queries.append(f'"{full}" site:linkedin.com/in')

    # Just first + last
    queries.append(f'"{short}" site:linkedin.com/in')

    return queries


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def search_linkedin_profile(
    first_name: str,
    last_name: str,
    email: str | None = None,
    linkedin_url: str | None = None,
    middle_name: str | None = None,
    location: dict | None = None,
) -> dict:
    """
    Find LinkedIn profile for the given person.

    Args:
        location: dict with optional keys "city", "region", "country"
                  from the visitor's IP geolocation. Used to boost
                  scoring for profiles that mention the same location.

    Strategy:
    1. User-provided LinkedIn URL (instant, 100% accurate)
    2. DDGS meta-search across multiple backends (auto, google, bing, etc.)
       with multiple query variations (full name + org, name only, etc.)
    3. Serper.dev API fallback (if SERPER_API_KEY is configured)

    All candidates are scored against the person's name, org, and location.
    Only results scoring >= 70 (both first AND last name match + extra signals) are returned.
    If no confident match is found, returns {found: False} rather than
    risking a wrong profile.
    """
    # 1. User-provided URL
    if linkedin_url:
        validated = validate_linkedin_url(linkedin_url)
        if validated:
            return {
                "found": True,
                "url": validated,
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
    queries = _build_queries(first_name, middle_name, last_name, org_hint)

    # 2. Try DDGS with each query × each backend
    for query in queries:
        for backend in DDGS_BACKENDS:
            candidates = _ddgs_search(query, backend)
            best = _pick_best(
                candidates, first_name, middle_name, last_name,
                org_hint, location,
            )
            if best:
                logger.info(
                    "LinkedIn found for %s %s %s via %s (score=%s)",
                    first_name, middle_name, last_name,
                    best.get("source"), best.get("match_score"),
                )
                return best

    # 3. Serper.dev fallback (if configured)
    if SERPER_API_KEY:
        for query in queries[:2]:  # conserve quota, use top 2 queries
            candidates = _serper_search(query)
            best = _pick_best(
                candidates, first_name, middle_name, last_name,
                org_hint, location,
            )
            if best:
                logger.info(
                    "LinkedIn found for %s %s %s via serper (score=%s)",
                    first_name, middle_name, last_name, best.get("match_score"),
                )
                return best

    logger.info("LinkedIn not found for: %s %s %s", first_name, middle_name, last_name)
    return {"found": False, "source": "all_exhausted"}
