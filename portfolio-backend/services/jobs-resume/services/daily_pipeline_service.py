"""
Daily Job Pipeline Service.

Ports the standalone job_pipeline.py flow into the resume-parser microservice.

Flow:
  1. Run two Apify actors in parallel:
       - curious_coder/linkedin-jobs-scraper   (LinkedIn keyword searches, past-N-days)
       - fantastic-jobs/workday-jobs-api       (Workday entry-level FTE titles)
  2. Filter & score against the user's profile (role families, body-shop /
     clearance / healthcare blocklists, H-1B sponsor & AI-native boosts).
  3. Return tier-grouped JSON (Tier 1/2/3) for the UI to render.

The user can override the LinkedIn keyword phrases and the Workday role titles
on every request; sensible defaults match job_pipeline.py.
"""
from __future__ import annotations

import ast
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import requests

from utils.config import _get_config_value

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Defaults (mirror job_pipeline.py)
# --------------------------------------------------------------------------
LINKEDIN_ACTOR = "curious_coder~linkedin-jobs-scraper"
WORKDAY_ACTOR = "fantastic-jobs~workday-jobs-api"
INDEED_ACTOR = "borderline~indeed-scraper"

# Source 3 — Indeed queries. Three focused queries beat one OR'd query:
# Indeed's default matcher is AND-of-tokens, so a single "software engineer
# new grad cloud full stack" only finds titles containing every word (rare).
# Three narrow queries each rank precise matches first, accepting the ~$0.75
# per pipeline cost (3 × $0.25). Override via indeed_queries payload key to
# trim runs.
INDEED_QUERIES = [
    "software engineer new grad",
    "cloud engineer DevOps",
    "full stack AI engineer",
]

# Source 5 — Direct ATS APIs (free, no Apify, no auth). Each tuple is (slug,
# display name) for the public job-board endpoints. Operators can extend these
# lists; failures on a single slug are logged and skipped.
# (slug, display name, domain) — domain is used by the Source-4 Apify
# fallback when our direct slug guess for Source 5 misses the board.
DEFAULT_GREENHOUSE_SLUGS = [
    ("anthropic", "Anthropic", "anthropic.com"),
    ("openai", "OpenAI", "openai.com"),
    ("notion", "Notion", "notion.so"),
    ("scaleai", "Scale AI", "scale.com"),
    ("snorkelai", "Snorkel AI", "snorkel.ai"),
    ("glean", "Glean", "glean.com"),
    ("stripe", "Stripe", "stripe.com"),
    ("procoretechnologies", "Procore", "procore.com"),
    ("cohere", "Cohere", "cohere.com"),
]
DEFAULT_LEVER_SLUGS = [
    ("ramp", "Ramp", "ramp.com"),
    ("brex", "Brex", "brex.com"),
    ("rippling", "Rippling", "rippling.com"),
    ("happyrobot", "HappyRobot", "happyrobot.ai"),
    ("taktile", "Taktile", "taktile.com"),
]
DEFAULT_ASHBY_SLUGS = [
    ("cognitionai", "Cognition", "cognition.ai"),
    ("decagon", "Decagon", "decagon.ai"),
    ("sierra", "Sierra", "sierra.ai"),
    ("harvey", "Harvey", "harvey.ai"),
]

# Source 4 fallback — Apify actor used when Source 5 (direct ATS APIs)
# returned no postings for a configured company. Hard-coded here so the
# fallback is always available whenever the Apify token is present.
_ATS_APIFY_ACTOR = "enosgb~ats-job-scraper"


def _ats_apify_actor_id() -> str:
    return _ATS_APIFY_ACTOR


def _load_user_profile(user_email: str) -> Optional[Dict[str, Any]]:
    """Load (and cache for one pipeline run) the user's resume profile.

    Returns None when no parsed resume exists for the user — the scorer then
    falls back to legacy flat title bonuses, preserving existing behavior for
    users who haven't uploaded a resume yet.
    """
    try:
        from services.resume_profiler import build_profile, feedback_signal_for_user
        from utils.db_connect import DBConnect
        db = DBConnect().get_db()
        resume = db.user_resumes.find_one(
            {"user_email": user_email, "structured": {"$exists": True}},
            sort=[("parsed_at", -1)],
        )
        if not resume:
            return None
        structured = resume.get("structured") or {}
        if "experience_years" not in structured and "experience_years" in resume:
            structured = dict(structured)
            structured["experience_years"] = resume.get("experience_years")
        try:
            feedback = feedback_signal_for_user(db.job_activity_log, user_email)
        except Exception:
            feedback = None
        return build_profile(structured, feedback_signal=feedback)
    except Exception as e:
        logger.warning(f"Failed to load resume profile for {user_email}: {e}")
        return None

DEFAULT_LINKEDIN_KEYWORD_SETS = [
    "Cloud Engineer DevOps",
    "Site Reliability Platform Engineer",
    "full stack engineer AI",
    "backend engineer Python AWS",
    "agentic AI engineer new grad",
    "software engineer new grad entry level",
    "associate software engineer h1b sponsor",
]

DEFAULT_WORKDAY_TITLES = [
    # The actor's titleSearch is token-AND (every query token must appear in
    # the title). Junior/Associate/New-Grad/Senior variants are absorbed by
    # the parent because the parent's tokens are still present. We only keep
    # variants whose *tokens differ* from the parent — they'd otherwise be
    # genuine misses. aiExperienceLevelFilter=["0-2"] handles seniority.
    #
    # Cloud / DevOps / SRE / Platform
    "Cloud Engineer", "DevOps Engineer", "Site Reliability Engineer",
    "SRE",  # bare token — distinct from "Site Reliability Engineer"
    "Platform Engineer", "Infrastructure Engineer",
    "AWS Engineer", "Kubernetes Engineer",  # distinct specialty tokens
    # Backend / Full-Stack / Frontend
    "Backend Engineer", "Backend Developer",
    "Full Stack Engineer", "Full Stack Developer",
    "Frontend Engineer", "Frontend Developer",
    "API Engineer", "Software Developer",
    # AI / ML — keep both spellings; "ML" and "Machine Learning" are
    # different tokens, similarly LLM / GenAI.
    "AI Engineer", "Machine Learning Engineer", "ML Engineer",
    "LLM Engineer", "GenAI Engineer", "Applied Scientist",
    # General SWE early-career — distinct prefixes Workday's matcher won't
    # collapse on its own.
    "Software Engineer", "Software Engineer I",
    "Associate Software Engineer", "Junior Software Engineer",
    "New Grad Software Engineer", "Entry Level Software Engineer",
    "Software Development Engineer", "SDE I",
    "Member of Technical Staff", "Graduate Software Engineer",
]

BODY_SHOPS = {
    # Original list
    "beaconfire", "jobs via dice", "turing", "aditi", "apetan", "sira",
    "teksystems", "jobright", "chatgpt jobs", "dataannotation",
    "tata consultancy services", "tcs", "infosys", "wipro", "cognizant",
    "hcl", "akraya", "rk infotech", "crystal equation", "piper companies",
    "techtriad", "cgi", "candid", "compunnel", "kforce", "robert half",
    "insight global", "hays", "randstad", "ust global", "mphasis",
    "ltimindtree", "ltts", "l&t technology", "synechron", "virtusa",
    # Extended staffing / body shops that frequently pollute LinkedIn entry-level
    "softhq", "zycus", "saxon global", "diverse lynx", "pyramid consulting",
    "judge group", "the judge group", "modis", "akkodis", "iconma",
    "eteam", "etalent", "infojini", "bayone", "bayone solutions",
    "spar information systems", "spar group", "softpath", "zillion technologies",
    "talent burst", "talentburst", "softworld", "matlen silver", "vdart",
    "v-dart", "smartIMS", "smartims", "infinite computer solutions",
    "intellectt", "intellectt inc", "harvey nash", "experis", "manpower",
    "kelly services", "system soft", "systemsoft", "pinnacle group",
    "pinnacle technical", "tek experts", "tekberry", "tekgroup",
    "computer task group", "ctg ", "donatech", "donato technologies",
    "rangam consultants", "rangam", "wisestaffing", "wise staffing",
    "alphapoint technology", "advanced systems group", "asg",
    "kavaliro", "stefanini", "amerit consulting", "anveta",
    "talent serv", "talentserv", "rishabh software",
    "encora", "softworld inc", "millennium consulting",
    "collabera", "collabera digital", "sysmind", "wsource group",
    "us tech solutions", "ustech solutions", "us tech",
    "eclaro", "talent groups", "iqvia consulting",
    "marlabs", "softonic", "infomatics", "tek-hub",
    "the icon", "icon consultants",
    "mastech", "mastech digital", "trianz",
    "iquasar", "i-quasar",
    "amtex", "amtex enterprises",
    "n harris computer", "harris computer corporation",
    "magnit", "magnit global",
    "k force", "kforce inc",
    "dice", "diceus", "techorbit", "tech orbit",
    "sage it", "sage-it", "talent acquisition group",
    "raja sw", "rajasoftwares", "raja software",
    "smartsoft technologies", "smarttech", "infinity quest",
    "trigyn", "trigyn technologies",
    "ascendion", "ascendion engineering",
    "saicon", "saicon consultants",
    "datrose", "datrose llc",
    "primus knowledge", "primus software",
    "innova solutions", "innova", "katalyst", "katalyst healthcares",
    "metasys technologies", "metasys", "infoways",
}
CLEARANCE_COMPANIES = {
    "rtx", "raytheon", "lockheed", "northrop", "leidos", "caci",
    "gdit", "general dynamics", "nightwing", "boeing", "spacex",
    "amentum", "radiance technologies", "booz allen", "ball aerospace",
    "saic", "mantech", "peraton", "parsons", "huntington ingalls", "kbr",
    "bae systems",
}
H1B_SPONSORS = {
    "nvidia", "paypal", "notion", "adobe", "cisco", "intel", "target",
    "deutsche bank", "capital one", "goldman sachs", "morgan stanley",
    "procore", "allstate", "zillow", "servicenow", "cox", "manulife",
    "athenahealth", "mufg", "fidelity", "toyota", "general motors",
    "symbotic", "ge healthcare", "aerovironment", "calix", "cambium learning",
    "openai", "anthropic", "meta", "google", "amazon", "microsoft", "apple",
    "stripe", "databricks", "snowflake", "datadog", "atlassian", "salesforce",
    "linkedin", "uber", "doordash", "airbnb", "pinterest", "reddit", "snap",
    "twilio", "okta", "block", "shopify", "intuit", "vmware", "oracle",
    "sap", "ibm", "dell", "hpe", "vanguard", "jpmorgan", "wells fargo",
    "bank of america", "citi", "blackrock", "amex", "american express",
    "verizon", "t-mobile", "comcast", "disney", "warner bros", "ea ",
    "electronic arts", "activision", "roblox",
}
AI_NATIVE = {
    "notion", "openai", "anthropic", "glean", "abridge",
    "applied intuition", "rilla", "arcade", "snorkel", "cognition",
    "happyrobot", "taktile", "intelepeer", "scout ai", "perplexity",
    "harvey", "decagon", "sierra", "writer", "runway", "character.ai",
    "mistral", "cohere", "huggingface", "hugging face", "weaviate",
    "pinecone", "langchain", "llamaindex", "replicate", "modal",
    "fixie", "you.com", "elevenlabs", "suno",
}
HEALTHCARE_NOISE_TITLE = re.compile(
    r"\b(rn|registered nurse|nursing|physical therapist|occupational therapist|"
    r"speech therapist|sales representative|sales account|account manager|"
    r"dialysis|maternity|behavioral health|cardiac|surgical|icu|stepdown|"
    r"resident|paramedic|technician|phlebotomist|radiologist|sonographer|"
    r"pharmacy|pharmacist|dental|dentist|veterinar|chiropractor|"
    r"medical assistant|cna|lpn|caregiver|hospice|hospital|"
    r"truck driver|delivery driver|cdl|warehouse|forklift|"
    r"cashier|barista|line cook|server|housekeep|janitor|"
    r"teacher|tutor|instructor|professor|aide|counselor|"
    r"financial advisor|wealth manager|loan officer|"
    r"property manager|leasing|real estate|insurance agent|"
    r"hairstylist|cosmetolog|massage|esthetician|"
    r"electrician|plumber|hvac|welder|mechanic)\b",
    re.IGNORECASE,
)
SENIORITY_BAD = re.compile(
    r"\b(senior|sr\.?|principal|staff|lead|manager|director|"
    r"head of|vp\b|vice president|chief)\b",
    re.IGNORECASE,
)
GOOD_TITLE = re.compile(
    r"\b(associate|junior|jr\.?|new grad|early career|entry level|entry-level|"
    r"software engineer i\b|swe i\b|engineer i\b|graduate|"
    r"co-?op|ncg|2026|recent grad)\b",
    re.IGNORECASE,
)
AGENTIC = re.compile(r"\b(agentic|ai agent|llm agent|multi-agent)\b", re.IGNORECASE)
AI_TITLE = re.compile(
    r"\b(applied ai|ai engineer|ml engineer|machine learning engineer|"
    r"gen[- ]?ai|llm|nlp engineer)\b", re.IGNORECASE,
)
CLOUD_TITLE = re.compile(
    r"\b(cloud|devops|sre|site reliability|platform engineer|infrastructure|"
    r"kubernetes|terraform|aws engineer|gcp engineer|azure engineer)\b",
    re.IGNORECASE,
)
BACKEND_TITLE = re.compile(
    r"\b(backend|back-?end|api engineer|server-side|distributed systems)\b",
    re.IGNORECASE,
)
FULLSTACK_TITLE = re.compile(r"\b(full[- ]?stack|fullstack)\b", re.IGNORECASE)
FRONTEND_TITLE = re.compile(
    r"\b(front[- ]?end|frontend|react engineer|ui engineer|web engineer)\b",
    re.IGNORECASE,
)
CLEARANCE_TEXT = re.compile(
    r"\b(ts/sci|top secret|secret clearance|active clearance|us citizen(ship)? required|"
    r"us citizens only|itar|polygraph|public trust|sci clearance)\b",
    re.IGNORECASE,
)
INTERN_TITLE = re.compile(r"\b(intern|internship|summer 2026|co-?op)\b", re.IGNORECASE)
PHOENIX_HINTS = re.compile(
    r"\b(phoenix|chandler|scottsdale|tempe|mesa|gilbert|arizona|\baz\b)\b",
    re.IGNORECASE,
)


# --------------------------------------------------------------------------
# Apify client
# --------------------------------------------------------------------------
def _get_apify_token() -> str:
    return (
        _get_config_value("APIFY_API_KEY", "")
        or _get_config_value("APIFY_TOKEN", "")
        or ""
    )


_CREDIT_EXHAUSTED_HINTS = (
    "monthly-usage-limit-exceeded",
    "monthly-usage-hard-limit-exceeded",
    "actor-monthly-usage-limit-exceeded",
    "credit",
    "payment-required",
    "subscription",
    "insufficient",
)


def _classify_apify_error(status_code: int, body_text: str) -> str:
    """Return a structured error code the UI can pattern-match on."""
    body = (body_text or "").lower()
    if status_code == 402 or any(h in body for h in _CREDIT_EXHAUSTED_HINTS):
        return "APIFY_CREDITS_EXHAUSTED"
    if status_code in (401, 403):
        return "APIFY_AUTH_FAILED"
    if status_code == 429:
        return "APIFY_RATE_LIMITED"
    return "APIFY_ERROR"


def _run_actor(actor: str, run_input: dict, token: str, timeout_s: int = 480) -> List[Dict[str, Any]]:
    """Run an Apify actor synchronously and return its dataset items.

    Raises RuntimeError on failure with a structured error-code prefix so the
    pipeline result can surface a clear message to the user (e.g. exhausted
    credits → prompt to update their BYO Apify key).
    """
    url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={quote(token)}"
    logger.info("[apify] starting %s ...", actor)
    t0 = time.time()
    try:
        r = requests.post(url, json=run_input, timeout=timeout_s)
    except requests.RequestException as e:
        raise RuntimeError(f"APIFY_ERROR: {actor} request failed: {e}") from e
    if r.status_code >= 400:
        code = _classify_apify_error(r.status_code, r.text)
        raise RuntimeError(f"{code}: {actor} returned {r.status_code} {r.reason}")
    items = r.json() if r.headers.get("content-type", "").startswith("application/json") else []
    if isinstance(items, dict) and items.get("error"):
        # Some actors return a JSON error body with HTTP 200 — sniff it.
        err = items["error"]
        body = err.get("type", "") + " " + err.get("message", "")
        code = _classify_apify_error(0, body)
        raise RuntimeError(f"{code}: {actor} reported {err.get('type', 'error')}")
    if not isinstance(items, list):
        items = []
    logger.info("[apify] %s -> %d items in %.1fs", actor, len(items), time.time() - t0)
    return items


_LINKEDIN_EXPERIENCE_CODES = {
    # LinkedIn's f_E parameter — multiple values are comma-separated.
    "internship": "1",
    "entry": "2",
    "associate": "3",
    "mid": "4",
    "senior": "5",
    "director": "6",
    "executive": "7",
}
_LINKEDIN_JT_CODES = {
    "FULLTIME": "F",
    "PARTTIME": "P",
    "CONTRACTOR": "C",
    "TEMPORARY": "T",
    "INTERN": "I",
}
_LINKEDIN_WT_CODES = {
    "onsite": "1",
    "remote": "2",
    "hybrid": "3",
}
_WORKDAY_EMPLOYMENT_MAP = {
    "FULLTIME": "FULL_TIME",
    "PARTTIME": "PART_TIME",
    "INTERN": "INTERN",
    "CONTRACTOR": "CONTRACTOR",
}
_WORKDAY_EXPERIENCE_MAP = {
    "internship": ["0-2"],
    "entry": ["0-2"],
    "associate": ["0-2", "3-5"],
    "mid": ["3-5"],
    "senior": ["5-10"],
    "director": ["10+"],
    "executive": ["10+"],
}
_WORKDAY_ARRANGEMENT_MAP = {
    "remote": ["Remote OK", "Remote Solely"],
    "hybrid": ["Hybrid"],
    "onsite": ["In-Office"],
}


def _build_linkedin_url(
    keywords: str,
    past_days: int,
    *,
    location: str = "United States",
    experience_level: str = "entry",
    employment_type: str = "FULLTIME",
    work_arrangement: str = "any",
) -> str:
    """Build a LinkedIn /jobs/search URL with the actor-supported filter params.

    All filters are optional — passing the defaults reproduces the previous
    24h/Entry-Level/US-only URL, so existing callers are unaffected.
    """
    f_tpr = "r86400" if past_days <= 1 else f"r{86400 * max(1, past_days)}"
    base = "https://www.linkedin.com/jobs/search/?"
    parts = [
        f"keywords={quote(keywords)}",
        f"location={quote(location or 'United States')}",
        f"f_TPR={f_tpr}",
    ]
    f_e = _LINKEDIN_EXPERIENCE_CODES.get((experience_level or "").lower())
    if f_e:
        parts.append(f"f_E={f_e}")
    # f_JT is only emitted for non-default employment types. The previous
    # LinkedIn URL had no f_JT, so passing employment_type="FULLTIME" (the
    # implicit baseline) reproduces that exactly. Explicit INTERN/CONTRACTOR/
    # PARTTIME tighten the URL; "ANY" leaves it unrestricted.
    emp_upper = (employment_type or "").upper()
    if emp_upper in ("PARTTIME", "INTERN", "CONTRACTOR"):
        f_jt = _LINKEDIN_JT_CODES.get(emp_upper)
        if f_jt:
            parts.append(f"f_JT={f_jt}")
    f_wt = _LINKEDIN_WT_CODES.get((work_arrangement or "").lower())
    if f_wt:
        parts.append(f"f_WT={f_wt}")
    return base + "&".join(parts)


# Pre-filter for ATS direct fetchers: drop sales / PM / marketing / recruiter /
# legal / finance / ops roles before we even normalize them. Saves compute on
# large company boards (Stripe, OpenAI, Anthropic publish 200+ jobs each).
_ATS_TECH_TITLE = re.compile(
    r"\b(engineer|engineering|developer|swe|sde|sre|mts|devops|"
    r"programmer|scientist|architect|technical staff|software|"
    r"data engineer|ml engineer|ai engineer|infrastructure|platform|"
    r"backend|frontend|full[- ]?stack|web)\b",
    re.IGNORECASE,
)


def _fetch_greenhouse(slug: str, display: str) -> List[Dict[str, Any]]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
    try:
        r = requests.get(url, timeout=10)
        if not r.ok:
            return []
        items = (r.json() or {}).get("jobs") or []
    except Exception as e:
        logger.warning("Greenhouse %s failed: %s", slug, e)
        return []
    out: List[Dict[str, Any]] = []
    for j in items:
        title = _clean_str(j.get("title"))
        if not _ATS_TECH_TITLE.search(title):
            continue
        out.append({
            "source": "Greenhouse",
            "company": display,
            "title": title,
            "location": _clean_str(j.get("location")),
            "posted": _normalize_posted(j.get("updated_at")),
            "salary": "—",
            "applicants": "",
            "url": _clean_str(j.get("absolute_url")),
            "description": "",
        })
    return out


def _fetch_lever(slug: str, display: str) -> List[Dict[str, Any]]:
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    try:
        r = requests.get(url, timeout=10)
        if not r.ok:
            return []
        items = r.json() or []
    except Exception as e:
        logger.warning("Lever %s failed: %s", slug, e)
        return []
    out: List[Dict[str, Any]] = []
    for j in items:
        title = _clean_str(j.get("text"))
        if not _ATS_TECH_TITLE.search(title):
            continue
        cats = j.get("categories") or {}
        posted_iso = ""
        ts = j.get("createdAt")
        if isinstance(ts, (int, float)) and ts > 0:
            try:
                posted_iso = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            except Exception:
                pass
        out.append({
            "source": "Lever",
            "company": display,
            "title": title,
            "location": _clean_str(cats.get("location") or cats.get("allLocations")),
            "posted": posted_iso,
            "salary": "—",
            "applicants": "",
            "url": _clean_str(j.get("hostedUrl") or j.get("applyUrl")),
            "description": "",
        })
    return out


def _fetch_ashby(slug: str, display: str) -> List[Dict[str, Any]]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
    try:
        r = requests.get(url, timeout=10)
        if not r.ok:
            return []
        items = (r.json() or {}).get("jobs") or []
    except Exception as e:
        logger.warning("Ashby %s failed: %s", slug, e)
        return []
    out: List[Dict[str, Any]] = []
    for j in items:
        title = _clean_str(j.get("title"))
        if not _ATS_TECH_TITLE.search(title):
            continue
        out.append({
            "source": "Ashby",
            "company": display,
            "title": title,
            "location": _clean_str(j.get("location") or j.get("locationName")),
            "posted": _normalize_posted(j.get("publishedAt") or j.get("updatedAt")),
            "salary": "—",
            "applicants": "",
            "url": _clean_str(j.get("jobUrl") or j.get("applyUrl")),
            "description": "",
        })
    return out


def _scrape_ats_direct(
    greenhouse: Optional[List[Tuple[str, str, str]]] = None,
    lever: Optional[List[Tuple[str, str, str]]] = None,
    ashby: Optional[List[Tuple[str, str, str]]] = None,
) -> List[Dict[str, Any]]:
    """Fan out to Greenhouse / Lever / Ashby in parallel and merge results."""
    gh = greenhouse if greenhouse is not None else DEFAULT_GREENHOUSE_SLUGS
    lv = lever if lever is not None else DEFAULT_LEVER_SLUGS
    ab = ashby if ashby is not None else DEFAULT_ASHBY_SLUGS
    tasks = []
    out: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for slug, name, _domain in gh:
            tasks.append(pool.submit(_fetch_greenhouse, slug, name))
        for slug, name, _domain in lv:
            tasks.append(pool.submit(_fetch_lever, slug, name))
        for slug, name, _domain in ab:
            tasks.append(pool.submit(_fetch_ashby, slug, name))
        for fut in tasks:
            try:
                out.extend(fut.result(timeout=15))
            except Exception as e:
                logger.warning("ATS fetch worker failed: %s", e)
    logger.info("[ats-direct] fetched %d total postings", len(out))
    return out


def _ats_apify_fallback(
    missing_companies: List[Tuple[str, str, str]],
    ats_type: str,
    token: str,
    max_per_company: int = 50,
) -> List[Dict[str, Any]]:
    """Run the Source-4 Apify ATS actor for companies that Source 5 missed.

    No-ops cleanly when APIFY_ATS_ACTOR isn't configured, the token is empty,
    or there's nothing to fetch. Per the spec caveats: posted_at is always
    null on this actor, so we route everything through _normalize_posted (which
    returns "" for missing dates and the cutoff filter then keeps it). We do
    not pass `filters.keywords` — Python-side filtering does the work.
    """
    actor = _ats_apify_actor_id()
    if not actor or not missing_companies or not token:
        return []
    payload = {
        "ats_override": ats_type,
        "include_description": False,
        "include_salary": True,
        "max_jobs_per_company": max_per_company,
        "companies": [{"name": name, "domain": domain} for _slug, name, domain in missing_companies],
    }
    try:
        items = _run_actor(actor, payload, token, timeout_s=300)
    except Exception as e:
        logger.warning("ATS Apify fallback (%s) failed: %s", ats_type, e)
        return []
    out: List[Dict[str, Any]] = []
    label = ats_type.capitalize()
    for j in items or []:
        title = _clean_str(j.get("title"))
        if not _ATS_TECH_TITLE.search(title):
            continue
        out.append({
            "source": f"{label} (Apify)",
            "company": _clean_str(j.get("company") or j.get("companyName") or j.get("organization")),
            "title": title,
            "location": _clean_str(j.get("location") or j.get("locationName")),
            # spec note: posted_at is always null here — _normalize_posted("") -> ""
            "posted": _normalize_posted(j.get("posted_at") or j.get("posted") or j.get("createdAt")),
            "salary": _clean_str(j.get("salary") or j.get("salary_text")) or "—",
            "applicants": "",
            "url": _clean_str(j.get("url") or j.get("job_url") or j.get("apply_url")),
            "description": "",
        })
    logger.info("[ats-apify-fallback] %s -> %d postings (covered %d companies)",
                ats_type, len(out), len(missing_companies))
    return out


def _scrape_indeed(token: str, queries: Optional[List[str]] = None, max_rows: int = 75) -> List[Dict[str, Any]]:
    """Source 3 — Indeed scrape. Returns normalized records or [] on any failure."""
    if not token:
        return []
    qs = queries if queries is not None else INDEED_QUERIES
    out: List[Dict[str, Any]] = []
    for q in qs:
        payload = {
            "country": "us",
            "query": q,
            "level": "entry_level",
            "jobType": "fulltime",
            "fromDays": "1",
            "sort": "date",
            "maxRows": max_rows,
        }
        try:
            items = _run_actor(INDEED_ACTOR, payload, token, timeout_s=180)
        except Exception as e:
            logger.warning("Indeed actor query=%r failed: %s", q, e)
            continue
        for j in items or []:
            out.append({
                "source": "Indeed",
                "company": _clean_str(j.get("companyName") or j.get("company")),
                "title": _clean_str(j.get("jobTitle") or j.get("title")),
                "location": _clean_str(j.get("location")),
                "posted": _normalize_posted(j.get("date") or j.get("postedAt") or j.get("posted_at")),
                "salary": _clean_str(j.get("salary") or j.get("salary_text")) or "—",
                "applicants": "",
                "url": _clean_str(j.get("url") or j.get("jobUrl") or j.get("job_url")),
                "description": _clean_str(j.get("description") or j.get("jobDescription"))[:500],
            })
    logger.info("[indeed] %d total postings across %d queries", len(out), len(qs))
    return out


def _scrape_in_parallel(
    token: str,
    linkedin_keywords: List[str],
    workday_titles: List[str],
    past_days: int,
    linkedin_count: int = 80,
    workday_limit: int = 200,
    *,
    location: str = "United States",
    experience_level: str = "entry",
    employment_type: str = "FULLTIME",
    work_arrangement: str = "any",
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    errors: List[str] = []

    linkedin_input = {
        "urls": [
            _build_linkedin_url(
                k, past_days,
                location=location,
                experience_level=experience_level,
                employment_type=employment_type,
                work_arrangement=work_arrangement,
            )
            for k in linkedin_keywords
        ],
        "count": linkedin_count,
        "scrapeCompany": False,
    }

    # Workday actor — only set the AI filter fields when the user explicitly
    # picked a value. Empty / "any" means "no filter" so the actor returns
    # the full set; the backend's existing role-family + dedupe + scoring
    # still applies. Defaults below reproduce the original pipeline behavior:
    #   experience=entry → "0-2", employment=FULLTIME → "FULL_TIME", US-only.
    workday_input: Dict[str, Any] = {
        "descriptionType": "text",
        "includeAi": True,
        "limit": workday_limit,
        "locationSearch": [location or "United States"],
        "removeAgency": True,
        "titleSearch": workday_titles,
    }
    exp_key = (experience_level or "").lower()
    if exp_key and exp_key != "any":
        wd_experience = _WORKDAY_EXPERIENCE_MAP.get(exp_key)
        if wd_experience:
            workday_input["aiExperienceLevelFilter"] = wd_experience
    emp_key = (employment_type or "").upper()
    if emp_key and emp_key != "ANY":
        wd_employment = _WORKDAY_EMPLOYMENT_MAP.get(emp_key)
        if wd_employment:
            workday_input["aiEmploymentTypeFilter"] = [wd_employment]
    wd_arrangement = _WORKDAY_ARRANGEMENT_MAP.get((work_arrangement or "").lower())
    if wd_arrangement:
        workday_input["aiWorkArrangementFilter"] = wd_arrangement

    def _safe_run(actor: str, payload: dict) -> List[Dict[str, Any]]:
        try:
            return _run_actor(actor, payload, token)
        except Exception as e:
            errors.append(f"{actor}: {e}")
            logger.warning("Apify actor %s failed: %s", actor, e)
            return []

    with ThreadPoolExecutor(max_workers=2) as ex:
        f_li = ex.submit(_safe_run, LINKEDIN_ACTOR, linkedin_input)
        f_wd = ex.submit(_safe_run, WORKDAY_ACTOR, workday_input)
        linkedin = f_li.result()
        workday = f_wd.result()

    return linkedin, workday, errors


# --------------------------------------------------------------------------
# Normalization
# --------------------------------------------------------------------------
def _clean_str(value: Any) -> str:
    """Coerce arbitrary actor-returned values into a clean string.

    Apify/ATS responses occasionally return dicts ({"name": "..."} or
    {"display": "..."}) or lists of strings where we expect a plain string,
    which then crashes downstream `.strip()` / regex calls.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("name", "display", "displayName", "text", "value", "label"):
            v = value.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
        return ""
    if isinstance(value, (list, tuple)):
        parts: List[str] = []
        for item in value:
            s = _clean_str(item)
            if s:
                parts.append(s)
        return ", ".join(parts)
    return str(value).strip()


def _norm_company(s: Any) -> str:
    return _clean_str(s).lower()


_RELATIVE_TIME_RE = re.compile(
    r"^\s*(\d+)\s*(minute|min|hour|hr|day|week|month)s?\s*ago\s*$",
    re.IGNORECASE,
)


def _normalize_posted(raw: Any, now: Optional[datetime] = None) -> str:
    """Normalize a posted timestamp into YYYY-MM-DD.

    Handles ISO strings ("2026-04-29T...") and LinkedIn's relative phrases
    ("2 days ago", "5 hours ago"). Returns "" when unparseable so the
    downstream cutoff filter treats the row as unknown-date (kept).
    """
    if not raw:
        return ""
    s = str(raw).strip()
    # ISO date / datetime — first 10 chars are YYYY-MM-DD when present.
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return s[:10]
    m = _RELATIVE_TIME_RE.match(s)
    if m:
        n = int(m.group(1))
        unit = m.group(2).lower()
        ref = now or datetime.now(timezone.utc)
        delta = {
            "minute": timedelta(minutes=n), "min": timedelta(minutes=n),
            "hour": timedelta(hours=n),     "hr": timedelta(hours=n),
            "day": timedelta(days=n),
            "week": timedelta(weeks=n),
            "month": timedelta(days=30 * n),
        }.get(unit, timedelta())
        return (ref - delta).strftime("%Y-%m-%d")
    if s.lower() in ("today", "just now"):
        return (now or datetime.now(timezone.utc)).strftime("%Y-%m-%d")
    if s.lower() == "yesterday":
        return ((now or datetime.now(timezone.utc)) - timedelta(days=1)).strftime("%Y-%m-%d")
    return ""


def _linkedin_to_record(j: dict) -> dict:
    return {
        "source": "LinkedIn",
        "company": _clean_str(j.get("companyName")),
        "title": _clean_str(j.get("title")),
        "location": _clean_str(j.get("location")),
        "posted": _normalize_posted(j.get("postedAt") or j.get("postedDate") or j.get("listedAt")),
        "salary": _clean_str(j.get("salary")) or "—",
        "applicants": j.get("applicantsCount") or "",
        "url": _clean_str(j.get("link")),
        "description": _clean_str(j.get("descriptionText")),
    }


def _workday_to_record(j: dict) -> dict:
    loc_raw = j.get("locations_alt_raw") or ""
    locs: List[str] = []
    if loc_raw:
        try:
            parsed = ast.literal_eval(loc_raw) if isinstance(loc_raw, str) else loc_raw
            if isinstance(parsed, list):
                locs = [str(x) for x in parsed]
        except Exception:
            locs = [str(loc_raw)]
    cities = j.get("cities_derived") or []
    regions = j.get("regions_derived") or []
    if isinstance(cities, str):
        try: cities = ast.literal_eval(cities)
        except Exception: cities = []
    if isinstance(regions, str):
        try: regions = ast.literal_eval(regions)
        except Exception: regions = []
    if not locs and (cities or regions):
        locs = [f"{c}, {r}" for c, r in zip(cities, regions)] or list(cities) or list(regions)
    if not locs and j.get("remote_derived"):
        locs = ["Remote (US)"]
    location = "; ".join(locs[:3]) if locs else "United States"

    salary_raw = j.get("salary_raw")
    salary = "—"
    if salary_raw:
        try:
            s = ast.literal_eval(salary_raw) if isinstance(salary_raw, str) else salary_raw
            v = s.get("value") if isinstance(s, dict) else None
            if isinstance(v, dict):
                lo, hi, cur = v.get("minValue"), v.get("maxValue"), v.get("unitText", "")
                if lo and hi: salary = f"${int(lo):,}-${int(hi):,} {cur}"
                elif lo:      salary = f"${int(lo):,}+ {cur}"
        except Exception:
            pass

    # The Workday actor returns the date under a few possible keys depending
    # on the actor version. Walk them all so we don't drop entries that just
    # have a different field name.
    posted_raw = (
        j.get("date_posted")
        or j.get("posted_date")
        or j.get("datePosted")
        or j.get("date_published")
        or j.get("aiDatePosted")
        or ""
    )
    return {
        "source": "Workday",
        "company": _clean_str(j.get("organization") or j.get("aiOrganization") or j.get("company")),
        "title": _clean_str(j.get("title") or j.get("aiTitle")),
        "location": _clean_str(location),
        "posted": _normalize_posted(posted_raw),
        "salary": salary,
        "applicants": "",
        "url": _clean_str(j.get("url") or j.get("link")),
        "description": _clean_str(j.get("description") or j.get("aiDescription"))[:500],
    }


# --------------------------------------------------------------------------
# Filters / scoring
# --------------------------------------------------------------------------
_US_STATE_CODES = frozenset({
    "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in",
    "ia","ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv",
    "nh","nj","nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn",
    "tx","ut","vt","va","wa","wv","wi","wy","dc",
})


def _is_us(rec: dict) -> bool:
    loc = _clean_str(rec.get("location")).lower()
    if not loc:
        return True
    if "united states" in loc or "usa" in loc or "remote" in loc:
        return True
    # Standalone "US" / "U.S." / "U.S.A." tokens
    if re.search(r"\b(us|u\.s\.|u\.s\.a\.)\b", loc):
        return True
    # Any token that is a US state abbreviation (handles bare "NY", "TX",
    # "Plano, TX", "Remote, CA", etc.)
    tokens = re.findall(r"[a-z]{2,}", loc)
    if any(t in _US_STATE_CODES for t in tokens):
        return True
    return bool(
        re.search(
            r"\b(new york|san francisco|seattle|austin|chicago|boston|atlanta|"
            r"denver|phoenix|chandler|scottsdale|tempe|dallas|houston|raleigh|"
            r"durham|charlotte|miami|los angeles|san diego|portland|nashville)\b",
            loc,
        )
    )


_STAFFING_HINT = re.compile(
    r"\b(staffing|recruit(ing|ers?)|consultanc(y|ies)|placement(s)?|"
    r"workforce solutions|human capital|talent solutions|talent partners|"
    r"contract(?:s|ing)?|c2c|w2|corp[- ]to[- ]corp|body shop|"
    r"sourcing solutions|talent network|talent group|talent acquisition)\b",
    re.IGNORECASE,
)


def _blocked_company(rec: dict) -> Optional[str]:
    c = _norm_company(rec.get("company"))
    for bs in BODY_SHOPS:
        if bs in c:
            return f"body-shop:{bs}"
    # Generic staffing/recruiting hint anywhere in the company name —
    # catches the long tail of LLCs we haven't curated by name.
    if _STAFFING_HINT.search(_clean_str(rec.get("company"))) or _STAFFING_HINT.search(_clean_str(rec.get("description"))):
        return "staffing/recruiting agency"
    return None


_SUMMER_2026_RE = re.compile(
    r"\b(summer\s*2026|may\s*2026|june\s*2026|jun\s*2026|2026\s+summer)\b",
    re.IGNORECASE,
)


def _opt_body_shop_reason(rec: dict) -> Optional[str]:
    """Drop low-pay 'OPT-friendly' postings — common with shady consultancies."""
    desc = _clean_str(rec.get("description")).lower()
    salary = _clean_str(rec.get("salary"))
    if "opt" not in desc:
        return None
    # Pull the largest dollar figure we can find from the salary string.
    nums = re.findall(r"\$?\s*([\d]{2,3}(?:[, ]\d{3})*|[\d]{4,6})", salary)
    cleaned: List[int] = []
    for n in nums:
        try:
            cleaned.append(int(n.replace(",", "").replace(" ", "")))
        except ValueError:
            continue
    if cleaned and max(cleaned) < 70_000:
        return f"OPT body-shop pattern (salary < $70K + 'OPT' in description)"
    return None


def _summer_intern_block(rec: dict) -> Optional[str]:
    """Hard-exclude Summer/May/June 2026 internship starts — collide with OPT EAD start."""
    title = _clean_str(rec.get("title"))
    desc = _clean_str(rec.get("description"))
    if not INTERN_TITLE.search(title):
        return None
    if _SUMMER_2026_RE.search(title) or _SUMMER_2026_RE.search(desc):
        return "summer-2026 intern (OPT EAD timing conflict)"
    return None


def _ghost_job_reason(rec: dict) -> Optional[str]:
    """Heuristics for low-quality / ghost postings."""
    # Very high applicant count = saturated, often reposted
    try:
        apc = int(rec.get("applicants") or 0)
    except (ValueError, TypeError):
        apc = 0
    if apc >= 500:
        return f"saturated posting ({apc}+ applicants)"
    # Reposted-from-old indicator on LinkedIn descriptions
    desc = _clean_str(rec.get("description")).lower()
    if "reposted" in desc and ("month" in desc or "30 days" in desc):
        return "reposted (likely stale / ghost)"
    return None


def _clearance_block(rec: dict) -> Optional[str]:
    c = _norm_company(rec.get("company"))
    for cl in CLEARANCE_COMPANIES:
        if cl in c:
            return f"clearance-co:{cl}"
    title = _clean_str(rec.get("title"))
    desc = _clean_str(rec.get("description"))
    if CLEARANCE_TEXT.search(title) or CLEARANCE_TEXT.search(desc):
        return "clearance-required"
    return None


def _healthcare_noise(rec: dict) -> Optional[str]:
    return "off-domain (healthcare/non-tech)" if HEALTHCARE_NOISE_TITLE.search(_clean_str(rec.get("title"))) else None


def _role_match(rec: dict, custom_role_terms: Optional[List[str]] = None) -> List[str]:
    t = _clean_str(rec.get("title"))
    out: List[str] = []
    if CLOUD_TITLE.search(t): out.append("Cloud/DevOps/SRE")
    if BACKEND_TITLE.search(t): out.append("Backend")
    if FULLSTACK_TITLE.search(t): out.append("Full-Stack")
    if AI_TITLE.search(t) or AGENTIC.search(t): out.append("AI/ML")
    if FRONTEND_TITLE.search(t): out.append("Frontend")
    if not out and re.search(r"\bsoftware engineer\b|\bswe\b", t, re.IGNORECASE):
        out.append("Software Engineer")
    if not out and custom_role_terms:
        tl = t.lower()
        for term in custom_role_terms:
            if term and term.lower() in tl:
                out.append(f"Custom: {term}")
                break
    return out


def _score(rec: dict, today_iso: Optional[str] = None, profile: Optional[Dict[str, Any]] = None) -> Tuple[int, List[str]]:
    s = 50
    flags: List[str] = []
    title = _clean_str(rec.get("title"))
    description = _clean_str(rec.get("description"))
    company = _norm_company(rec.get("company"))
    location = _clean_str(rec.get("location"))

    if any(sp in company for sp in H1B_SPONSORS): s += 30; flags.append("H1B-sponsor")
    if any(ai in company for ai in AI_NATIVE):    s += 20; flags.append("AI-native")
    if AGENTIC.search(title):       s += 25; flags.append("Agentic")

    # Title-family bonuses are now WEIGHTED by the candidate's primary intent.
    # An ML-focused candidate's Cloud-titled job stays neutral; their ML-titled
    # job gets the larger boost. A generalist (no profile) still gets the
    # legacy flat bonuses so first-time users see the same behavior as before.
    primary = (profile or {}).get("primary_intent")
    secondary = (profile or {}).get("secondary_intent")

    def _title_bonus(family_match: bool, family_key: str, base: int) -> int:
        if not profile:
            return base
        if family_key == primary:
            return base + 8           # primary domain → premium
        if family_key == secondary:
            return base                # secondary domain → unchanged
        return max(2, base // 3)       # off-domain → heavily damped

    if CLOUD_TITLE.search(title):
        bump = _title_bonus(True, "cloud_devops", 15); s += bump; flags.append(f"Cloud/DevOps (+{bump})")
    if GOOD_TITLE.search(title):
        s += 15; flags.append("Early-career")
    if BACKEND_TITLE.search(title) or FULLSTACK_TITLE.search(title):
        family = "fullstack" if FULLSTACK_TITLE.search(title) else "backend"
        bump = _title_bonus(True, family, 12); s += bump; flags.append(f"Backend/FS (+{bump})")
    if FRONTEND_TITLE.search(title):
        bump = _title_bonus(True, "frontend", 8); s += bump; flags.append(f"Frontend (+{bump})")

    # AI/ML title family — when the candidate's primary intent is ai_ml this
    # becomes the dominant signal; for a Cloud-focused candidate it stays
    # modest so AWS-only ML platform roles don't crowd out infra roles.
    from services.resume_profiler import INTENTS as _INTENTS
    ml_match = any(re.compile(p, re.IGNORECASE).search(title)
                   for p in _INTENTS["ai_ml"]["title_terms"])
    if ml_match:
        bump = _title_bonus(True, "ai_ml", 18); s += bump; flags.append(f"AI/ML title (+{bump})")

    # Domain mention in description (catch jobs with vague titles like
    # "Software Engineer" but ML-heavy descriptions for an ML candidate).
    if profile:
        try:
            from services.resume_profiler import domain_relevance as _domain_relevance
            dr = _domain_relevance(profile, f"{title} {description}")
            if dr >= 0.5:
                s += 10; flags.append(f"On-domain JD ({dr:.2f})")
            elif dr <= 0.1 and not (CLOUD_TITLE.search(title) or BACKEND_TITLE.search(title)
                                    or FULLSTACK_TITLE.search(title) or FRONTEND_TITLE.search(title)
                                    or ml_match or GOOD_TITLE.search(title)):
                # Title doesn't match any family AND description has no domain
                # signal — likely off-domain noise (e.g. a generic "Engineer"
                # at a hospital). Drop hard to push it below the Tier-3 floor.
                s -= 18; flags.append("off-domain")
        except Exception:
            pass

    if PHOENIX_HINTS.search(location): s += 8; flags.append("Phoenix-area")
    try:
        apc = int(rec["applicants"]) if rec["applicants"] else None
        if apc is not None and apc < 30:
            s += 8; flags.append(f"<30 apps ({apc})")
    except (ValueError, TypeError):
        pass
    # Fresh-post bonus when the post is dated today.
    if today_iso and rec.get("posted") == today_iso:
        s += 5; flags.append("Fresh today")
    if SENIORITY_BAD.search(title):       s -= 25; flags.append("senior-ish")
    # Catch roman numerals II/III/IV AND arabic 2/3/4 in titles like
    # "SDE 2", "SWE 3", "Software Engineer 2". Allow "I" and "1" through
    # because those are early-career.
    if re.search(r"\b(II|III|IV)\b|\b(SDE|SWE|Software Engineer)\s*[234]\b", title, re.IGNORECASE):
        s -= 25; flags.append("level II+")
    if CLEARANCE_TEXT.search(title):      s -= 40; flags.append("clearance")
    return s, flags


def _opt_status(rec: dict) -> str:
    return ("VERIFY-DATES (intern - confirm dates)"
            if INTERN_TITLE.search(rec["title"]) else "FTE OK")


def _tier(s: int) -> str:
    if s >= 100: return "Tier 1"
    if s >= 80:  return "Tier 2"
    if s >= 60:  return "Tier 3"
    return "Skip"


def _filter_and_score(
    records: List[dict],
    cutoff: str,
    custom_role_terms: Optional[List[str]] = None,
    profile: Optional[Dict[str, Any]] = None,
    *,
    location_filter: str = "United States",
    experience_level: str = "entry",
    employment_type: str = "FULLTIME",
    work_arrangement: str = "any",
    domain_strict: bool = False,
):
    apply_now: List[dict] = []
    verify: List[dict] = []
    excluded: List[dict] = []
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Cross-source dedupe — when LinkedIn and Workday both surface the same role
    # at the same company, keep one canonical copy. Prefer the entry that has a
    # parseable date or a non-empty description (more useful for tailoring).
    seen: Dict[Tuple[str, str], dict] = {}
    for r in records:
        key = (
            _norm_company(r.get("company") or ""),
            (r.get("title") or "").strip().lower(),
        )
        if not key[0] or not key[1]:
            # Anything missing both fields gets a synthetic key so it isn't
            # collapsed with other empty-field rows.
            seen[(r.get("source", ""), r.get("url") or id(r))] = r
            continue
        existing = seen.get(key)
        if existing is None:
            seen[key] = r
        else:
            # Choose whichever copy is "richer".
            def _quality(x: dict) -> int:
                q = 0
                if x.get("posted"): q += 2
                if (x.get("description") or "").strip(): q += 1
                if x.get("url"): q += 1
                return q
            if _quality(r) > _quality(existing):
                seen[key] = r
    deduped = list(seen.values())

    # Pre-compute domain-strict matchers ONCE if domain_strict is enabled,
    # so per-record filtering is cheap regex .search() calls.
    strict_patterns: List[Any] = []
    if domain_strict and profile:
        try:
            from services.resume_profiler import INTENTS as _INTENTS_STRICT
            primary_intent = profile.get("primary_intent")
            secondary_intent = profile.get("secondary_intent")
            for intent_key in (primary_intent, secondary_intent):
                if not intent_key or intent_key not in _INTENTS_STRICT:
                    continue
                for pat in _INTENTS_STRICT[intent_key].get("title_terms", []):
                    try:
                        strict_patterns.append(re.compile(pat, re.IGNORECASE))
                    except re.error:
                        continue
        except Exception:
            strict_patterns = []

    # Location post-filter — when caller specified something narrower than
    # "United States" (e.g. "New York", "Phoenix"), drop rows whose location
    # doesn't mention any token from the filter. We split on commas/spaces
    # and require at least one substring to match — Workday/LinkedIn return
    # location as "City, State, Country" strings.
    location_tokens: List[str] = []
    if location_filter:
        loc_lower = location_filter.strip().lower()
        if loc_lower not in ("", "united states", "usa", "us", "remote"):
            for token in re.split(r"[,/\s]+", loc_lower):
                token = token.strip()
                if len(token) >= 3:
                    location_tokens.append(token)

    # Work-arrangement post-filter — actors filter best-effort; we double-check
    # so a "remote-only" pipeline run doesn't quietly include hybrid roles.
    arrangement = (work_arrangement or "any").lower()

    # Employment-type post-filter — same reason.
    emp_type = (employment_type or "").upper()

    for r in deduped:
        # Only drop on date when we *know* it's older than the cutoff.
        # Workday entries often have no parseable date_posted; the actor
        # already filtered by recency on its side, so trusting them is safer
        # than dropping them all to "older than cutoff".
        posted = (r.get("posted") or "").strip()
        if posted and re.match(r"^\d{4}-\d{2}-\d{2}$", posted) and posted < cutoff:
            excluded.append({**r, "reason": f"older than {cutoff} (posted {posted})",
                             "tier": "Skip", "score": 0, "flags": ""}); continue
        if not _is_us(r):
            excluded.append({**r, "reason": f"non-US ({r['location']})",
                             "tier": "Skip", "score": 0, "flags": ""}); continue

        # User-specified location filter (post-filter — actors may return wider sets).
        if location_tokens:
            loc_text = (r.get("location") or "").lower()
            if not any(tok in loc_text for tok in location_tokens) and "remote" not in loc_text:
                excluded.append({**r, "reason": f"outside location filter ({location_filter})",
                                 "tier": "Skip", "score": 0, "flags": ""}); continue

        # Work-arrangement post-filter (only when user picked a specific mode).
        if arrangement in ("remote", "hybrid", "onsite"):
            loc_text = (r.get("location") or "").lower()
            desc_text = (r.get("description") or "").lower()
            blob = f"{loc_text} {desc_text}"
            if arrangement == "remote":
                if "remote" not in blob:
                    excluded.append({**r, "reason": "not remote",
                                     "tier": "Skip", "score": 0, "flags": ""}); continue
            elif arrangement == "hybrid":
                if "hybrid" not in blob:
                    excluded.append({**r, "reason": "not hybrid",
                                     "tier": "Skip", "score": 0, "flags": ""}); continue
            elif arrangement == "onsite":
                if "remote" in blob or "hybrid" in blob:
                    excluded.append({**r, "reason": "not on-site",
                                     "tier": "Skip", "score": 0, "flags": ""}); continue

        # Employment-type post-filter — primarily catches Contract postings
        # leaking through when user wants Full-Time only. "any" / empty skips.
        if emp_type and emp_type != "ANY":
            t_blob = f"{(r.get('title') or '').lower()} {(r.get('description') or '').lower()}"
            if emp_type == "FULLTIME":
                if any(k in t_blob for k in ["contract", "contractor", "1099", "c2c", "corp-to-corp"]):
                    excluded.append({**r, "reason": "contract role (full-time filter)",
                                     "tier": "Skip", "score": 0, "flags": ""}); continue
            elif emp_type == "CONTRACTOR":
                if not any(k in t_blob for k in ["contract", "contractor", "consultant", "1099"]):
                    excluded.append({**r, "reason": "not a contract role",
                                     "tier": "Skip", "score": 0, "flags": ""}); continue
            elif emp_type == "INTERN":
                if "intern" not in t_blob:
                    excluded.append({**r, "reason": "not an internship",
                                     "tier": "Skip", "score": 0, "flags": ""}); continue

        # Domain-strict post-filter — drop anything whose title doesn't match
        # the candidate's primary or secondary intent regex. The candidate
        # explicitly opted into "specialist mode" via the UI toggle; off-domain
        # roles (even high-scoring ones) get cut before scoring.
        if strict_patterns:
            t_lower = (r.get("title") or "").lower()
            if not any(rx.search(t_lower) for rx in strict_patterns):
                excluded.append({**r, "reason": "off-domain (strict mode)",
                                 "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _healthcare_noise(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _blocked_company(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _ghost_job_reason(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _clearance_block(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _summer_intern_block(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _opt_body_shop_reason(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        roles = _role_match(r, custom_role_terms=custom_role_terms)
        if not roles:
            excluded.append({**r, "reason": "no role-family match",
                             "tier": "Skip", "score": 0, "flags": ""}); continue

        sc, flags = _score(r, today_iso=today_iso, profile=profile)
        rec = {**r, "score": sc, "tier": _tier(sc),
               "flags": ", ".join(flags) or "—",
               "roles": ", ".join(roles), "opt": _opt_status(r)}
        if sc < 60:
            excluded.append({**rec, "reason": f"score {sc} < 60"})
        elif "intern" in r["title"].lower():
            verify.append(rec)
        else:
            apply_now.append(rec)

    apply_now.sort(key=lambda x: -x["score"])
    verify.sort(key=lambda x: -x["score"])
    return apply_now, verify, excluded


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------
def run_pipeline(
    linkedin_keywords: Optional[List[str]] = None,
    workday_titles: Optional[List[str]] = None,
    past_days: int = 1,
    custom_role_terms: Optional[List[str]] = None,
    linkedin_count: int = 80,
    workday_limit: int = 200,
    apify_token: Optional[str] = None,
    include_indeed: bool = False,
    user_email: Optional[str] = None,
    location: str = "United States",
    experience_level: str = "entry",
    employment_type: str = "FULLTIME",
    work_arrangement: str = "any",
    domain_strict: bool = False,
) -> Dict[str, Any]:
    """Run the full daily pipeline and return tier-grouped JSON.

    apify_token: when provided (e.g. a per-user BYO key), it overrides the
    shared SSM/env token. None falls back to _get_apify_token().
    """
    token = (apify_token or "").strip() or _get_apify_token()
    if not token:
        raise RuntimeError("APIFY_API_KEY/APIFY_TOKEN is not configured")

    li_kw = [k.strip() for k in (linkedin_keywords or DEFAULT_LINKEDIN_KEYWORD_SETS) if k and k.strip()]
    wd_titles = [t.strip() for t in (workday_titles or DEFAULT_WORKDAY_TITLES) if t and t.strip()]
    # past_days=0 means "today only" — cutoff is today's date, so anything
    # posted before today is excluded.
    past_days = max(0, min(int(past_days if past_days is not None else 1), 30))

    today = datetime.now(timezone.utc)
    cutoff = (today - timedelta(days=past_days)).strftime("%Y-%m-%d")

    # Run Apify scrapes (LinkedIn+Workday, optional Indeed) and direct-ATS in
    # parallel. ATS APIs have no Apify dependency so they keep delivering even
    # when the Apify token is missing or an actor is rate-limited. Indeed is
    # opt-in (include_indeed=True) — its date reliability is poor and its
    # listings are dominated by body-shop reposts.
    with ThreadPoolExecutor(max_workers=3) as pool:
        f_apify = pool.submit(
            _scrape_in_parallel,
            token=token,
            linkedin_keywords=li_kw or DEFAULT_LINKEDIN_KEYWORD_SETS,
            workday_titles=wd_titles or DEFAULT_WORKDAY_TITLES,
            past_days=past_days,
            linkedin_count=linkedin_count,
            workday_limit=workday_limit,
            location=location,
            experience_level=experience_level,
            employment_type=employment_type,
            work_arrangement=work_arrangement,
        )
        f_indeed = pool.submit(_scrape_indeed, token) if include_indeed else None
        f_ats = pool.submit(_scrape_ats_direct)
        linkedin_items, workday_items, errors = f_apify.result()
        indeed_items = f_indeed.result() if f_indeed is not None else []
        ats_items = f_ats.result()

    # Source-4 fallback: only fire for companies that returned 0 postings from
    # Source 5 (direct API). When APIFY_ATS_ACTOR is unset, _ats_apify_fallback
    # returns []. Still gated by the existing Apify token.
    if token and _ats_apify_actor_id():
        def _missing(slugs: List[Tuple[str, str, str]], label: str) -> List[Tuple[str, str, str]]:
            seen = {(r.get("company") or "").strip().lower() for r in ats_items if r.get("source") == label}
            return [t for t in slugs if t[1].lower() not in seen]

        fallback_jobs: List[Dict[str, Any]] = []
        for slugs, ats_type, label in (
            (DEFAULT_GREENHOUSE_SLUGS, "greenhouse", "Greenhouse"),
            (DEFAULT_LEVER_SLUGS, "lever", "Lever"),
            (DEFAULT_ASHBY_SLUGS, "ashby", "Ashby"),
        ):
            missing = _missing(slugs, label)
            if missing:
                fallback_jobs.extend(_ats_apify_fallback(missing, ats_type, token))
        if fallback_jobs:
            logger.info("[ats-direct] Apify fallback added %d postings", len(fallback_jobs))
            ats_items.extend(fallback_jobs)

    raw_li = [_linkedin_to_record(x) for x in linkedin_items]
    raw_wd = [_workday_to_record(x) for x in workday_items]
    raw_in = indeed_items   # already normalized by _scrape_indeed
    raw_ats = ats_items     # already normalized by the ATS fetchers
    all_raw = raw_li + raw_wd + raw_in + raw_ats

    # Resume profile (intent + weighted skills) — pulled from the user's
    # stored resume + recent feedback signals. None for anonymous runs;
    # _score falls back to its legacy flat bonuses when profile is None.
    profile = _load_user_profile(user_email) if user_email else None

    apply_now, verify, excluded = _filter_and_score(
        all_raw,
        cutoff,
        custom_role_terms=custom_role_terms,
        profile=profile,
        location_filter=location,
        experience_level=experience_level,
        employment_type=employment_type,
        work_arrangement=work_arrangement,
        domain_strict=domain_strict,
    )
    duplicates_dropped = max(0, len(all_raw) - (len(apply_now) + len(verify) + len(excluded)))
    phx = [r for r in apply_now + verify if PHOENIX_HINTS.search(r["location"] or "")]

    tier_counts = {
        "tier_1": sum(1 for r in apply_now + verify if r["tier"] == "Tier 1"),
        "tier_2": sum(1 for r in apply_now + verify if r["tier"] == "Tier 2"),
        "tier_3": sum(1 for r in apply_now + verify if r["tier"] == "Tier 3"),
    }

    def _by_src(rows: List[dict], src: str) -> int:
        return sum(1 for r in rows if (r.get("source") or "").lower() == src.lower())

    _ATS_SOURCES = {
        "Greenhouse", "Lever", "Ashby",
        "Greenhouse (Apify)", "Lever (Apify)", "Ashby (Apify)",
    }

    def _ats_count(rows: List[dict]) -> int:
        return sum(1 for r in rows if (r.get("source") or "") in _ATS_SOURCES)

    source_breakdown = {
        "linkedin": {
            "raw": len(raw_li),
            "apply_now": _by_src(apply_now, "LinkedIn"),
            "verify": _by_src(verify, "LinkedIn"),
            "excluded": _by_src(excluded, "LinkedIn"),
        },
        "workday": {
            "raw": len(raw_wd),
            "apply_now": _by_src(apply_now, "Workday"),
            "verify": _by_src(verify, "Workday"),
            "excluded": _by_src(excluded, "Workday"),
        },
        "indeed": {
            "raw": len(raw_in),
            "apply_now": _by_src(apply_now, "Indeed"),
            "verify": _by_src(verify, "Indeed"),
            "excluded": _by_src(excluded, "Indeed"),
        },
        "ats_direct": {
            "raw": len(raw_ats),
            "apply_now": _ats_count(apply_now),
            "verify": _ats_count(verify),
            "excluded": _ats_count(excluded),
        },
    }

    credits_exhausted = any("APIFY_CREDITS_EXHAUSTED" in (e or "") for e in errors)

    return {
        "ok": True,
        "generated_at": today.isoformat(),
        "credits_exhausted": credits_exhausted,
        "past_days": past_days,
        "cutoff": cutoff,
        "raw_counts": {
            "linkedin": len(raw_li),
            "workday": len(raw_wd),
            "indeed": len(raw_in),
            "ats_direct": len(raw_ats),
            "total": len(all_raw),
            "duplicates_dropped": duplicates_dropped,
        },
        "tier_counts": tier_counts,
        "source_breakdown": source_breakdown,
        "totals": {
            "apply_now": len(apply_now),
            "verify_dates": len(verify),
            "excluded": len(excluded),
            "phoenix": len(phx),
        },
        "apply_now": apply_now,
        "verify_dates": verify,
        "phoenix": phx,
        # Trim excluded to avoid huge payloads.
        "excluded_sample": excluded[:50],
        "excluded_total": len(excluded),
        "errors": errors,
        "inputs": {
            "linkedin_keywords": li_kw,
            "workday_titles": wd_titles[:20] + (["..."] if len(wd_titles) > 20 else []),
            "custom_role_terms": custom_role_terms or [],
        },
    }
