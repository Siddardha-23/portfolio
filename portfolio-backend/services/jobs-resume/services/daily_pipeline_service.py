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

DEFAULT_LINKEDIN_KEYWORD_SETS = [
    "Cloud Engineer DevOps",
    "Site Reliability Platform Engineer",
    "full stack engineer AI",
    "backend engineer Python AWS",
    "agentic AI engineer new grad",
]

DEFAULT_WORKDAY_TITLES = [
    # Cloud / DevOps / SRE / Platform
    "Cloud Engineer", "Cloud Software Engineer", "Cloud DevOps Engineer",
    "DevOps Engineer", "DevOps Software Engineer",
    "Site Reliability Engineer", "SRE", "Junior SRE", "New Grad SRE",
    "Platform Engineer", "Platform Software Engineer",
    "Infrastructure Engineer", "Infrastructure Software Engineer",
    "Kubernetes Engineer", "AWS Engineer", "Cloud Infrastructure Engineer",
    # Backend
    "Backend Engineer", "Backend Software Engineer",
    "Backend Developer", "API Engineer", "Server Engineer",
    "Junior Backend Engineer", "Associate Backend Engineer",
    "New Grad Backend Engineer",
    # Full-stack
    "Full Stack Engineer", "Full Stack Software Engineer",
    "Full Stack Developer", "Junior Full Stack Engineer",
    "Associate Full Stack Engineer", "New Grad Full Stack Engineer",
    # Frontend
    "Frontend Engineer", "Frontend Software Engineer",
    "Frontend Developer", "UI Engineer", "Web Engineer",
    "Junior Frontend Engineer", "New Grad Frontend Engineer",
    # AI / ML / Agentic
    "AI Engineer", "ML Engineer", "Machine Learning Engineer",
    "Applied AI Engineer", "Applied Machine Learning Engineer",
    "Agentic AI Engineer", "AI Agent Engineer", "GenAI Engineer",
    "LLM Engineer", "Junior ML Engineer", "Junior AI Engineer",
    "New Grad AI Engineer", "New Grad ML Engineer",
    # General SWE early-career
    "Software Engineer", "Software Developer",
    "Software Engineer I", "Software Engineer 1",
    "Associate Software Engineer", "Associate Software Developer",
    "Junior Software Engineer", "Junior Software Developer",
    "Entry Level Software Engineer", "Entry-Level Software Engineer",
    "Graduate Software Engineer", "Software Engineer Graduate",
    "New Grad Software Engineer", "New Graduate Software Engineer",
    "Early Career Software Engineer",
    "SWE I", "SWE 1",
]

BODY_SHOPS = {
    "beaconfire", "jobs via dice", "turing", "aditi", "apetan", "sira",
    "teksystems", "jobright", "chatgpt jobs", "dataannotation",
    "tata consultancy services", "tcs", "infosys", "wipro", "cognizant",
    "hcl", "akraya", "rk infotech", "crystal equation", "piper companies",
    "techtriad", "cgi", "candid", "compunnel", "kforce", "robert half",
    "insight global", "hays", "randstad", "ust global", "mphasis",
    "ltimindtree", "ltts", "l&t technology", "synechron", "virtusa",
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


def _run_actor(actor: str, run_input: dict, token: str, timeout_s: int = 480) -> List[Dict[str, Any]]:
    """Run an Apify actor synchronously and return its dataset items."""
    url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={quote(token)}"
    logger.info("[apify] starting %s ...", actor)
    t0 = time.time()
    try:
        r = requests.post(url, json=run_input, timeout=timeout_s)
    except requests.RequestException as e:
        raise RuntimeError(f"Apify {actor} request failed: {e}") from e
    if r.status_code >= 400:
        raise RuntimeError(f"Apify {actor} returned {r.status_code} {r.reason}")
    items = r.json() if r.headers.get("content-type", "").startswith("application/json") else []
    if not isinstance(items, list):
        items = []
    logger.info("[apify] %s -> %d items in %.1fs", actor, len(items), time.time() - t0)
    return items


def _build_linkedin_url(keywords: str, past_days: int) -> str:
    f_tpr = "r86400" if past_days <= 1 else f"r{86400 * max(1, past_days)}"
    base = "https://www.linkedin.com/jobs/search/?"
    return (
        f"{base}keywords={quote(keywords)}&location=United%20States"
        f"&f_TPR={f_tpr}&f_E=2"
    )


def _scrape_in_parallel(
    token: str,
    linkedin_keywords: List[str],
    workday_titles: List[str],
    past_days: int,
    linkedin_count: int = 80,
    workday_limit: int = 200,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    errors: List[str] = []

    linkedin_input = {
        "urls": [_build_linkedin_url(k, past_days) for k in linkedin_keywords],
        "count": linkedin_count,
        "scrapeCompany": False,
    }
    workday_input = {
        "aiEmploymentTypeFilter": ["FULL_TIME"],
        "aiExperienceLevelFilter": ["0-2"],
        "descriptionType": "text",
        "includeAi": True,
        "limit": workday_limit,
        "locationSearch": ["United States"],
        "removeAgency": True,
        "titleSearch": workday_titles,
    }

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
def _norm_company(s: str) -> str:
    return (s or "").strip().lower()


def _linkedin_to_record(j: dict) -> dict:
    return {
        "source": "LinkedIn",
        "company": (j.get("companyName") or "").strip(),
        "title": (j.get("title") or "").strip(),
        "location": (j.get("location") or "").strip(),
        "posted": (j.get("postedAt") or "")[:10],
        "salary": (j.get("salary") or "").strip() or "—",
        "applicants": j.get("applicantsCount") or "",
        "url": j.get("link") or "",
        "description": j.get("descriptionText") or "",
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

    return {
        "source": "Workday",
        "company": (j.get("organization") or "").strip(),
        "title": (j.get("title") or "").strip(),
        "location": location,
        "posted": (j.get("date_posted") or "")[:10],
        "salary": salary,
        "applicants": "",
        "url": j.get("url") or "",
        "description": "",
    }


# --------------------------------------------------------------------------
# Filters / scoring
# --------------------------------------------------------------------------
def _is_us(rec: dict) -> bool:
    loc = (rec["location"] or "").lower()
    if not loc:
        return True
    if "united states" in loc or "usa" in loc or "remote" in loc:
        return True
    return bool(
        re.search(r",\s*[a-z]{2}\b", loc)
        or re.search(
            r"\b(new york|san francisco|seattle|austin|chicago|boston|atlanta|"
            r"denver|phoenix|chandler|scottsdale|tempe|dallas|houston|raleigh|"
            r"durham|charlotte|miami|los angeles|san diego|portland|nashville)\b",
            loc,
        )
    )


def _blocked_company(rec: dict) -> Optional[str]:
    c = _norm_company(rec["company"])
    for bs in BODY_SHOPS:
        if bs in c:
            return f"body-shop:{bs}"
    return None


def _clearance_block(rec: dict) -> Optional[str]:
    c = _norm_company(rec["company"])
    for cl in CLEARANCE_COMPANIES:
        if cl in c:
            return f"clearance-co:{cl}"
    if CLEARANCE_TEXT.search(rec["title"]) or CLEARANCE_TEXT.search(rec["description"]):
        return "clearance-required"
    return None


def _healthcare_noise(rec: dict) -> Optional[str]:
    return "off-domain (healthcare/non-tech)" if HEALTHCARE_NOISE_TITLE.search(rec["title"]) else None


def _role_match(rec: dict, custom_role_terms: Optional[List[str]] = None) -> List[str]:
    t = rec["title"]
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


def _score(rec: dict) -> Tuple[int, List[str]]:
    s = 50
    flags: List[str] = []
    title = rec["title"]
    company = _norm_company(rec["company"])

    if any(sp in company for sp in H1B_SPONSORS): s += 30; flags.append("H1B-sponsor")
    if any(ai in company for ai in AI_NATIVE):    s += 20; flags.append("AI-native")
    if AGENTIC.search(title):       s += 25; flags.append("Agentic")
    if CLOUD_TITLE.search(title):   s += 15; flags.append("Cloud/DevOps")
    if GOOD_TITLE.search(title):    s += 15; flags.append("Early-career")
    if BACKEND_TITLE.search(title) or FULLSTACK_TITLE.search(title):
        s += 12; flags.append("Backend/FS")
    if FRONTEND_TITLE.search(title): s += 8; flags.append("Frontend")
    try:
        apc = int(rec["applicants"]) if rec["applicants"] else None
        if apc is not None and apc < 30:
            s += 8; flags.append(f"<30 apps ({apc})")
    except (ValueError, TypeError):
        pass
    if SENIORITY_BAD.search(title):       s -= 25; flags.append("senior-ish")
    if re.search(r"\b(II|III|IV)\b", title): s -= 25; flags.append("level II+")
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


def _filter_and_score(records: List[dict], cutoff: str, custom_role_terms: Optional[List[str]] = None):
    apply_now: List[dict] = []
    verify: List[dict] = []
    excluded: List[dict] = []
    for r in records:
        if (r["posted"] or "0000") < cutoff:
            excluded.append({**r, "reason": f"older than {cutoff} (posted {r['posted'] or 'unknown'})",
                             "tier": "Skip", "score": 0, "flags": ""}); continue
        if not _is_us(r):
            excluded.append({**r, "reason": f"non-US ({r['location']})",
                             "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _healthcare_noise(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _blocked_company(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        if (why := _clearance_block(r)):
            excluded.append({**r, "reason": why, "tier": "Skip", "score": 0, "flags": ""}); continue
        roles = _role_match(r, custom_role_terms=custom_role_terms)
        if not roles:
            excluded.append({**r, "reason": "no role-family match",
                             "tier": "Skip", "score": 0, "flags": ""}); continue

        sc, flags = _score(r)
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
) -> Dict[str, Any]:
    """Run the full daily pipeline and return tier-grouped JSON."""
    token = _get_apify_token()
    if not token:
        raise RuntimeError("APIFY_API_KEY/APIFY_TOKEN is not configured")

    li_kw = [k.strip() for k in (linkedin_keywords or DEFAULT_LINKEDIN_KEYWORD_SETS) if k and k.strip()]
    wd_titles = [t.strip() for t in (workday_titles or DEFAULT_WORKDAY_TITLES) if t and t.strip()]
    past_days = max(1, min(int(past_days or 1), 30))

    today = datetime.now(timezone.utc)
    cutoff = (today - timedelta(days=past_days)).strftime("%Y-%m-%d")

    linkedin_items, workday_items, errors = _scrape_in_parallel(
        token=token,
        linkedin_keywords=li_kw or DEFAULT_LINKEDIN_KEYWORD_SETS,
        workday_titles=wd_titles or DEFAULT_WORKDAY_TITLES,
        past_days=past_days,
        linkedin_count=linkedin_count,
        workday_limit=workday_limit,
    )

    raw_li = [_linkedin_to_record(x) for x in linkedin_items]
    raw_wd = [_workday_to_record(x) for x in workday_items]
    all_raw = raw_li + raw_wd

    apply_now, verify, excluded = _filter_and_score(
        all_raw, cutoff, custom_role_terms=custom_role_terms
    )
    phx = [r for r in apply_now + verify if PHOENIX_HINTS.search(r["location"] or "")]

    tier_counts = {
        "tier_1": sum(1 for r in apply_now + verify if r["tier"] == "Tier 1"),
        "tier_2": sum(1 for r in apply_now + verify if r["tier"] == "Tier 2"),
        "tier_3": sum(1 for r in apply_now + verify if r["tier"] == "Tier 3"),
    }

    return {
        "ok": True,
        "generated_at": today.isoformat(),
        "past_days": past_days,
        "cutoff": cutoff,
        "raw_counts": {
            "linkedin": len(raw_li),
            "workday": len(raw_wd),
            "total": len(all_raw),
        },
        "tier_counts": tier_counts,
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
