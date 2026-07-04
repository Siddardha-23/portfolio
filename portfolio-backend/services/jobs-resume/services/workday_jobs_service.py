"""
Workday Jobs service — powers the dedicated "Workday Jobs" tab.

Fans out across the curated, live-validated tenant catalog
(services/workday_tenant_catalog.py) hitting each tenant's public CXS JSON
endpoint directly:

    POST https://{tenant}.{wd_host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs

No scraping, no Apify credits — the CXS API is the same JSON the public
career site renders from. Behavior notes confirmed by live probing:

  - With a `searchText` the response is relevance-sorted; without one it is
    newest-first. We search per derived term so a huge retail tenant's
    store-associate firehose doesn't bury the user's engineering titles.
  - `postedOn` is a relative phrase ("Posted Today", "Posted Yesterday",
    "Posted 2 Days Ago", "Posted 30+ Days Ago") — we convert to an absolute
    date and compute days_ago so the UI can filter Today/24h/3d/7d/30d
    client-side without a refetch.
  - Wrong site → 404, wrong host/tenant → 422. The catalog is pre-validated
    (scripts/validate_workday_tenants.py) so no runtime probing is needed.

Caching mirrors job_service's two-tier shape: we always fetch the widest
window (30 days) and cache that raw set in Mongo; recency filters are applied
downstream (client-side in the tab), so switching Today ↔ 30d is instant.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from threading import Lock
from typing import Any, Callable, Dict, List, Optional, Tuple

import requests

from services.workday_cxs_fetcher import _HEADERS, _approx_iso_from_relative
from services.workday_tenant_catalog import WORKDAY_TENANT_CATALOG, INDUSTRIES

logger = logging.getLogger(__name__)

# Bump when the record schema or fetch behavior changes so stale cached
# results don't leak the old shape into the UI. v6: country_code from the
# detail endpoint resolves "N Locations" rows' geo definitively.
RESULT_SCHEMA_VERSION = 6

# Fan-out envelope — tuned against a live full-catalog run (532 tenants x
# 3 terms, 2026-07): 1 page/term is enough because the US facet + relevance
# ranking put the best matches on page 1 and PER_TENANT_KEEP caps the take
# anyway; 96 workers is safe because the load spreads across ~532 distinct
# hosts (per-host concurrency stays ~1). The CXS API rejects limit > 20.
# jobs-resume Lambda timeout is 900s, so OVERALL_TIMEOUT=420 has headroom.
PAGE_LIMIT = 20
MAX_PAGES_PER_TERM = 1
MAX_QUERY_TERMS = 3       # title-family terms
TOTAL_TERMS_CAP = 4       # title terms + resume-skill terms combined
PER_TENANT_KEEP = 25
GLOBAL_KEEP = 1500
REQUEST_TIMEOUT = 6
OVERALL_TIMEOUT = 600
MAX_WORKERS = 96
WINDOW_DAYS = 30
# Top-ranked rows get their full JD fetched from the CXS detail endpoint so
# skill matching runs against the real description, not just the title.
DETAIL_ENRICH_TOP = 200
DETAIL_TIMEOUT = 5
# Stream a provisional top slice to the poller as companies complete, so the
# tab renders matches while the scan is still running.
STREAM_EVERY_TASKS = 80
STREAM_TOP = 120

# Shared session: connection pooling saves a TLS handshake for every
# (tenant, term) pair beyond the first per host. pool size covers the worker
# count; pool_connections bounds the per-host pool LRU across ~532 hosts.
_SESSION = requests.Session()
_SESSION.mount("https://", requests.adapters.HTTPAdapter(
    pool_connections=256, pool_maxsize=MAX_WORKERS, max_retries=0,
))

CACHE_COLLECTION = "workday_jobs_cache"
CACHE_TTL_SECONDS = 6 * 3600     # Mongo TTL reaper
CACHE_FRESH_SECONDS = 3 * 3600   # served-as-fresh horizon

# Seniority/stack noise words stripped when deriving compact CXS search terms
# from the user's (often long) title list. "Senior Backend Engineer Python"
# and "Backend Engineer II" both collapse to "backend engineer".
_TERM_NOISE = frozenset({
    "senior", "sr", "sr.", "junior", "jr", "jr.", "associate", "staff",
    "lead", "principal", "mid-level", "midlevel", "entry", "level",
    "new", "grad", "graduate", "intern", "internship", "i", "ii", "iii",
    "iv", "1", "2", "3",
})


def _derive_query_terms(titles: List[str], cap: int = MAX_QUERY_TERMS) -> List[str]:
    """Collapse a long title list into a few core CXS search terms.

    The fan-out cost is tenants x terms, so we can't send all 40 synthesized
    titles — but Workday's search is a keyword match, so the de-seniorized
    core families ("backend engineer", "data engineer") cover their variants.
    All original titles still participate in local title-match ranking.
    """
    seen: set = set()
    out: List[str] = []
    for raw in titles or []:
        tokens = [t for t in re.split(r"[^a-z0-9+#.]+", str(raw).lower()) if t]
        core = [t for t in tokens if t not in _TERM_NOISE]
        if not core:
            continue
        term = " ".join(core[:4])
        if term in seen:
            continue
        seen.add(term)
        out.append(term)
        if len(out) >= cap:
            break
    return out or ["software engineer"]


# Soft skills / ubiquitous tokens that would make terrible search terms.
_SKILL_TERM_STOPLIST = frozenset({
    "communication", "leadership", "teamwork", "problem solving", "agile",
    "scrum", "git", "github", "microsoft office", "excel", "english", "jira",
    "collaboration", "documentation", "testing", "debugging", "linux",
})


def _derive_skill_terms(skills: List[str], title_terms: List[str],
                        cap: int) -> List[str]:
    """Broaden retrieval beyond title vocabulary.

    Workday's searchText matches the FULL posting text, so querying by a
    distinctive resume skill ("python", "kubernetes") surfaces roles whose
    titles never say "engineer" — e.g. "Member of Technical Staff". Those
    rows then earn a skill-signal boost in scoring instead of being missed
    entirely. Skills arrive in resume-prominence order from the parser.
    """
    if cap <= 0:
        return []
    title_blob = " ".join(title_terms).lower()
    out: List[str] = []
    for s in skills or []:
        tok = str(s).strip().lower()
        if len(tok) < 3 or tok in _SKILL_TERM_STOPLIST or tok in title_blob:
            continue
        if not re.fullmatch(r"[a-z0-9+#. /-]{3,30}", tok):
            continue
        out.append(tok)
        if len(out) >= cap:
            break
    return out


def _title_matchers(titles: List[str]) -> List[List[str]]:
    """Token lists for local title matching — a job title 'matches' a user
    title when every significant token of that user title appears in it."""
    matchers: List[List[str]] = []
    for raw in titles or []:
        tokens = [t for t in re.split(r"[^a-z0-9+#.]+", str(raw).lower()) if t]
        core = [t for t in tokens if t not in _TERM_NOISE]
        if core:
            matchers.append(core[:5])
    return matchers


def _days_ago(iso_date: str) -> Optional[int]:
    if not iso_date:
        return None
    try:
        d = datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc).date() - d.date()).days)
    except ValueError:
        return None


# Workday's global country reference WID for the United States. Confirmed
# identical across independent tenants (CVS wd1, Adobe wd5, Salesforce wd12)
# — the CXS locationCountry facet uses global reference IDs, not
# tenant-local ones. The 532-tenant live run showed two failure modes we
# must handle: ~half the tenants 400 the facet (not exposed on their site),
# and a further set (notably some wd12 tenants) silently IGNORE it and
# return worldwide results with HTTP 200. So the facet is used only as a
# server-side narrowing hint — the client-side geo filter below always runs.
US_COUNTRY_FACET_ID = "bc33aa3152ec42d4995f4791a106ed09"

# Tenants observed to 400 the locationCountry facet — remembered for the
# process lifetime so only the FIRST term-query per tenant pays the
# 400+retry round trip (the live run had 264 such tenants x 3 terms).
_FACET_UNSUPPORTED: set = set()
_FACET_LOCK = Lock()

# "in" is deliberately absent: Indian postings like "Hyderabad IN" would
# match it. Indiana rows don't need the rescue — anything not explicitly
# foreign is kept by the default tier anyway.
_US_STATE_RE = re.compile(
    r"\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|ia|ks|ky|la|me|md|ma|mi"
    r"|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut"
    r"|vt|va|wa|wv|wi|wy|dc)\b", re.IGNORECASE,
)

# Explicit non-US markers seen in enterprise Workday locationsText values.
# Checked ONLY after the US-positive tier, so "Paris, TX" / "Vienna, VA" /
# "Ontario, CA" are already kept before these substrings are consulted.
_NON_US_MARKERS = (
    "india", "canada", "united kingdom", "ireland", "poland", "philippines",
    "mexico", "brazil", "china", "japan", "singapore", "australia",
    "germany", "france", "spain", "italy", "netherlands", "romania",
    "hungary", "czech", "israel", "egypt", "colombia", "argentina",
    "costa rica", "malaysia", "vietnam", "thailand", "indonesia",
    "switzerland", "sweden", "denmark", "norway", "finland", "belgium",
    "austria", "portugal", "greece", "turkey", "united arab emirates",
    "saudi", "qatar", "south africa", "kenya", "nigeria", "hong kong",
    "taiwan", "korea", "new zealand", "chile", "peru", "sri lanka",
    "pakistan", "bangladesh",
    # City / hub tells that appear without a country suffix:
    "pune", "bengaluru", "bangalore", "hyderabad", "chennai", "mumbai",
    "new delhi", "noida", "gurgaon", "gurugram", "kolkata", "ahmedabad",
    "toronto", "vancouver", "montreal", "mississauga", "ottawa", "calgary",
    "london", "edinburgh", "glasgow", "belfast", "leeds", "dublin, ireland",
    "warsaw", "krakow", "gdansk", "bucharest", "budapest", "prague",
    "lisbon", "madrid", "barcelona", "paris, fr", "munich", "berlin, de",
    "frankfurt", "amsterdam", "zurich", "geneva", "stockholm", "copenhagen",
    "oslo", "helsinki", "brussels", "milan, it", "tel aviv", "cairo",
    "nairobi", "lagos", "dubai", "abu dhabi", "riyadh", "doha", "seoul",
    "taipei", "jakarta", "kuala lumpur", "ho chi minh", "hanoi", "tokyo",
    "osaka", "sydney", "melbourne", "brisbane", "shanghai", "beijing",
    "shenzhen", "makati", "manila", "taguig", "cebu", "guadalajara",
    "monterrey", "sao paulo", "colombo", "karachi", "lahore", "islamabad",
)
# Word-boundary matching — "india" must not fire inside "Indianapolis".
_NON_US_RE = re.compile(
    r"\b(" + "|".join(re.escape(m) for m in _NON_US_MARKERS) + r")\b",
    re.IGNORECASE,
)
# Comma-anchored so "On-site" / "Ab initio" prose never matches — Canadian
# postings write provinces as "Toronto, ON" / "Vancouver, BC".
_CA_PROVINCE_RE = re.compile(r",\s*(on|bc|ab|qc|mb|sk|ns|nb|nl|pe)\b", re.IGNORECASE)


def _geo_keep_us(loc_text: str) -> bool:
    """Tiered US filter, applied to EVERY row when us_only is set.

    1. Country-level US signal ("United States", "USA", "US") -> keep.
    2. US state code -> keep. Runs BEFORE the marker tier so collisions like
       "Paris, TX" / "Vienna, VA" / "Ontario, CA" are rescued.
    3. Explicit non-US marker (country, foreign hub city, ", ON"-style
       Canadian province) -> drop. Catches "Remote India" and "Hyderabad IN"
       — which is why "remote" alone is NOT a keep signal earlier.
    4. Ambiguous ("6 Locations", "Remote", bare city, empty) -> keep.
       Dropping ambiguous rows would silently lose valid US roles; the
       server-side facet already biased page 1 toward US where honored.
    """
    loc = (loc_text or "").strip().lower()
    if not loc or "location" in loc:
        return True
    # Pre-tier: "Toronto" outranks the state-code rescue — Canadian rows like
    # "CA-Toronto-York St" would otherwise be kept by the "ca" token.
    if "toronto" in loc:
        return False
    if "united states" in loc or "usa" in loc:
        return True
    if re.search(r"\b(us|u\.s\.)\b", loc):
        return True
    if _US_STATE_RE.search(loc):
        return True
    if _NON_US_RE.search(loc):
        return False
    if _CA_PROVINCE_RE.search(loc):
        return False
    return True


def _fetch_tenant_term(
    row: Dict[str, str],
    term: str,
    location: str,
    us_only: bool = True,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """One (tenant, search-term) unit of the fan-out.

    Strategy (proven against the full 532-tenant catalog, 2026-07):
      1. Query with searchText=<term> AND the US locationCountry facet so the
         server both relevance-ranks and geo-narrows page 1 where supported.
      2. If the tenant 400s the facet, remember that in _FACET_UNSUPPORTED
         (so later terms skip the wasted round trip) and retry unfaceted.
      3. The client-side _geo_keep_us filter runs on EVERY row regardless —
         some tenants silently ignore unknown facets and return worldwide
         results with HTTP 200, so facet acceptance proves nothing.
      4. Keep rows inside the 30-day window, normalize into the live-search
         Job record shape.

    Returns (jobs, meta). Failures return ([], meta) — a partial result
    across N tenants always beats a hard error."""
    tenant, host, site = row["tenant"], row["wd_host"], row["site"]
    base = f"https://{tenant}.{host}.myworkdayjobs.com"
    url = f"{base}/wday/cxs/{tenant}/{site}/jobs"
    location_lc = (location or "").strip().lower()
    if location_lc in {"united states", "us", "usa"}:
        location_lc = ""  # us_only already handles country scoping
    out: List[Dict[str, Any]] = []
    meta: Dict[str, Any] = {"facet_fallback": False, "error": None, "pages": 0}
    with _FACET_LOCK:
        facet_known_bad = tenant in _FACET_UNSUPPORTED
    facets: Dict[str, Any] = (
        {"locationCountry": [US_COUNTRY_FACET_ID]}
        if us_only and not facet_known_bad else {}
    )

    for page in range(MAX_PAGES_PER_TERM):
        body = {
            "searchText": term,
            "locations": [],
            "appliedFacets": facets,
            "limit": PAGE_LIMIT,
            "offset": page * PAGE_LIMIT,
        }
        try:
            resp = _SESSION.post(url, json=body, headers=_HEADERS, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 400 and facets:
                # Tenant doesn't expose the locationCountry facet — drop it,
                # remember for this tenant's remaining terms, retry unfaceted.
                facets = {}
                meta["facet_fallback"] = True
                with _FACET_LOCK:
                    _FACET_UNSUPPORTED.add(tenant)
                body["appliedFacets"] = {}
                resp = _SESSION.post(url, json=body, headers=_HEADERS, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as e:
            logger.debug("workday-jobs %s/%s: network error %s", tenant, term, e)
            meta["error"] = f"network: {e.__class__.__name__}"
            break
        if resp.status_code != 200:
            logger.debug("workday-jobs %s/%s: HTTP %s", tenant, term, resp.status_code)
            meta["error"] = f"http_{resp.status_code}"
            break
        try:
            data = resp.json()
        except ValueError:
            meta["error"] = "bad_json"
            break
        meta["pages"] = page + 1
        postings = data.get("jobPostings") or []
        for jp in postings:
            if not isinstance(jp, dict):
                continue
            title = (jp.get("title") or "").strip()
            if not title:
                continue
            posted_text = (jp.get("postedOn") or "").strip()
            posted_iso = _approx_iso_from_relative(posted_text)
            days = _days_ago(posted_iso)
            # "Posted 30+ Days Ago" parses to exactly 30 — treat >30 or
            # unparseable as outside the tab's widest window.
            if days is None or days > WINDOW_DAYS or "30+" in posted_text:
                continue
            loc_text = (jp.get("locationsText") or "").strip()
            # Geo filtering ALWAYS runs — the facet is only a narrowing hint
            # (some tenants silently ignore it and return worldwide rows).
            if us_only and not _geo_keep_us(loc_text):
                continue
            if location_lc:
                haystack = loc_text.lower()
                if location_lc not in haystack and "remote" not in haystack:
                    continue
            path = (jp.get("externalPath") or "").lstrip("/")
            req_id = (jp.get("bulletFields") or [None])[0] or path
            seed = f"workday_jobs|{tenant}|{req_id}|{title}".lower()
            out.append({
                "job_id": "workday:" + hashlib.md5(seed.encode()).hexdigest()[:24],
                "title": title,
                "company": row["display_name"],
                "logo": "",
                "location": loc_text or "Not specified",
                # Canonical form Workday itself emits in the detail endpoint's
                # externalUrl — no locale segment.
                "apply_link": f"{base}/{site}/{path}" if path else base,
                "description": "",
                "salary": "",
                "employment_type": (jp.get("timeType") or "").strip(),
                "date_posted": posted_iso,
                "posted_text": posted_text,
                "is_remote": "remote" in loc_text.lower(),
                "h1b_sponsor": False,
                "contract_friendly": False,
                "source": "Workday",
                "tenant": tenant,
                "industry": row.get("industry") or "",
                "days_ago": days,
                "search_term": term,
            })
        if len(postings) < PAGE_LIMIT:
            break  # exhausted this term on this tenant
    return out, meta


# ----------------------------------------------------------------------
# Scoring
# ----------------------------------------------------------------------

def _score_jobs(
    jobs: List[Dict[str, Any]],
    titles: List[str],
    skills: List[str],
    skill_terms: List[str],
) -> List[Dict[str, Any]]:
    """Attach match_score / matched_skills / missing_skills to every job.

    Deterministic (no LLM). Three signals:
      - skill overlap of the resume skills against title + description (the
        description exists once _enrich_details has run for that row — same
        regex semantics as jd_match_scorer);
      - a title-family bonus (+45) when the job title covers all core tokens
        of one of the user's titles;
      - a skill-signal bonus (+20) when the title DOESN'T match but the row
        either overlaps resume skills or was retrieved by a skill-derived
        search term — this is what keeps differently-titled roles ("Member
        of Technical Staff") ranked instead of buried at zero.

    Nothing is ever dropped here — scoring only orders; recall is preserved.
    """
    from services.jd_match_scorer import _build_match_regex

    skill_rx = [(s, _build_match_regex(s)) for s in skills]
    matchers = _title_matchers(titles)
    skill_terms_set = {t.lower() for t in skill_terms}
    denom = max(8, len(skills))

    for job in jobs:
        title_lc = job["title"].lower()
        blob = (job["title"] + "\n" + (job.get("description") or "")).lower()
        matched = [s for s, rx in skill_rx if rx is not None and rx.search(blob)]
        matched_set = set(matched)
        missing = [s for s, _ in skill_rx if s not in matched_set][:8]
        base = min(100, round(len(matched) / denom * 100)) if skills else 0
        title_matched = any(all(tok in title_lc for tok in m) for m in matchers)
        skill_signal = bool(matched) or bool(
            skill_terms_set & {str(t).lower() for t in (job.get("matched_terms") or [])}
        )
        score = min(100, base + (45 if title_matched else (20 if skill_signal else 0)))
        if not skills and not title_matched:
            score = 15  # neutral floor so the ring isn't a sea of zeros
        job["match_score"] = score
        job["matched_skills"] = matched[:12]
        job["missing_skills"] = missing
        job["title_matched"] = title_matched
    return jobs


# ----------------------------------------------------------------------
# Detail enrichment — full JD for the top-ranked rows
# ----------------------------------------------------------------------

_TAG_RE = re.compile(r"<[^>]+>")


def _html_to_text(raw: str) -> str:
    import html as _html
    return re.sub(r"\s+", " ", _TAG_RE.sub(" ", _html.unescape(raw or ""))).strip()


def _enrich_details(jobs: List[Dict[str, Any]]) -> int:
    """Fetch the CXS job-detail JSON for rows lacking a description.

    GET {base}/wday/cxs/{tenant}/{site}{externalPath} returns
    jobPostingInfo with the full HTML jobDescription, the EXACT posting
    startDate (better than the lossy "Posted N Days Ago"), and remoteType.
    Enables real skill-overlap scoring + accurate recency for top matches.
    Returns how many rows were enriched; individual failures are skipped.
    """
    need = [j for j in jobs if not j.get("description") and j.get("tenant")]
    if not need:
        return 0

    def _one(job: Dict[str, Any]) -> bool:
        m = re.match(r"(https://[^/]+)/(.+)$", job.get("apply_link") or "")
        if not m:
            return False
        url = f"{m.group(1)}/wday/cxs/{job['tenant']}/{m.group(2)}"
        try:
            resp = _SESSION.get(url, headers=_HEADERS, timeout=DETAIL_TIMEOUT)
            if resp.status_code != 200:
                return False
            info = (resp.json() or {}).get("jobPostingInfo") or {}
        except (requests.RequestException, ValueError):
            return False
        desc = info.get("jobDescription") or ""
        if desc:
            job["description"] = _html_to_text(desc)[:5000]
        start = str(info.get("startDate") or "")[:10]
        if re.match(r"^\d{4}-\d{2}-\d{2}$", start):
            days = _days_ago(start)
            if days is not None:
                job["date_posted"] = start
                job["days_ago"] = days
        if "remote" in str(info.get("remoteType") or "").lower():
            job["is_remote"] = True
        # Definitive geo: the detail payload names the posting's country,
        # which resolves rows the list view hid behind "N Locations".
        cinfo = info.get("country") or {}
        rloc = ((info.get("jobRequisitionLocation") or {}).get("country") or {})
        if cinfo or rloc:
            is_us_row = (cinfo.get("id") == US_COUNTRY_FACET_ID
                         or rloc.get("alpha2Code") == "US")
            job["country_code"] = "US" if is_us_row else str(
                rloc.get("alpha2Code") or cinfo.get("descriptor") or "non-US")[:40]
        primary_loc = str(info.get("location") or "").strip()
        if primary_loc and "location" in str(job.get("location") or "").lower():
            job["location"] = primary_loc
        return bool(desc)

    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, 64)) as pool:
        results = list(pool.map(_one, need))
    return sum(1 for ok in results if ok)


# ----------------------------------------------------------------------
# Cache
# ----------------------------------------------------------------------

def _catalog_signature(rows: List[Dict[str, str]]) -> str:
    blob = "|".join(sorted(f"{r['tenant']}.{r['wd_host']}/{r['site']}" for r in rows))
    return hashlib.md5(blob.encode()).hexdigest()[:12]


def _cache_key(rows: List[Dict[str, str]], terms: List[str], location: str,
               us_only: bool) -> str:
    payload = json.dumps({
        "v": RESULT_SCHEMA_VERSION,
        "catalog": _catalog_signature(rows),
        "terms": sorted(terms),
        "location": (location or "").strip().lower(),
        "us_only": bool(us_only),
    }, sort_keys=True)
    return hashlib.md5(payload.encode()).hexdigest()


def _get_cache_collection():
    try:
        from utils.db_connect import DBConnect
        db = DBConnect().get_db()
        coll = db[CACHE_COLLECTION]
        try:
            coll.create_index("cache_key", unique=True)
            coll.create_index("cached_at", expireAfterSeconds=CACHE_TTL_SECONDS,
                              name="workday_jobs_cache_ttl")
        except Exception:
            pass  # index may already exist / racing another cold start
        return coll
    except Exception as e:
        logger.warning("workday-jobs: cache unavailable: %s", e)
        return None


def _read_cache(coll, key: str) -> Optional[List[Dict[str, Any]]]:
    if coll is None:
        return None
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=CACHE_FRESH_SECONDS)
        doc = coll.find_one({"cache_key": key, "cached_at": {"$gte": cutoff}})
        if doc and isinstance(doc.get("jobs"), list):
            return doc["jobs"]
    except Exception as e:
        logger.warning("workday-jobs: cache read failed: %s", e)
    return None


def _write_cache(coll, key: str, jobs: List[Dict[str, Any]]) -> None:
    if coll is None:
        return
    try:
        coll.update_one(
            {"cache_key": key},
            {"$set": {"cache_key": key, "jobs": jobs,
                      "cached_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    except Exception as e:
        logger.warning("workday-jobs: cache write failed: %s", e)


# ----------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------

def run_workday_jobs_search(
    payload: Dict[str, Any],
    partial_cb: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """Execute one Workday Jobs search. Called from the async job runner.

    payload (sanitized by the blueprint):
        titles: list[str]        - role titles (prefilled from resume)
        industries: list[str]    - subset of catalog industries ([] = all)
        companies: list[str]     - subset of catalog tenants ([] = all)
        location: str            - free-text location filter within the US
                                   ("" / "United States" = whole country)
        remote_only: bool
        us_only: bool            - default True; server-side US country facet
        force_refresh: bool
        user_email: str

    Returns the full 30-day scored result; the tab filters recency locally.
    """
    titles = [str(t).strip() for t in (payload.get("titles") or []) if str(t or "").strip()]
    industries = {str(i).strip() for i in (payload.get("industries") or []) if str(i or "").strip()}
    companies = {str(c).strip().lower() for c in (payload.get("companies") or []) if str(c or "").strip()}
    location = str(payload.get("location") or "").strip()
    remote_only = bool(payload.get("remote_only", False))
    us_only = bool(payload.get("us_only", True))
    force_refresh = bool(payload.get("force_refresh", False))
    user_email = str(payload.get("user_email") or "")

    rows = [
        r for r in WORKDAY_TENANT_CATALOG
        if (not industries or r.get("industry") in industries)
        and (not companies or r["tenant"] in companies)
    ]
    # Resume skills drive both retrieval (extra search terms) and scoring.
    from services.jd_match_scorer import _load_user_skills
    skills = _load_user_skills(user_email) if user_email else []
    title_terms = _derive_query_terms(titles)
    skill_terms = _derive_skill_terms(
        skills, title_terms, cap=TOTAL_TERMS_CAP - len(title_terms),
    )
    terms = title_terms + skill_terms
    errors: List[str] = []

    coll = _get_cache_collection()
    key = _cache_key(rows, terms, location, us_only)
    cache_hit = False
    raw_jobs: Optional[List[Dict[str, Any]]] = None
    if not force_refresh:
        raw_jobs = _read_cache(coll, key)
        cache_hit = raw_jobs is not None

    tenants_total = len(rows)
    tenants_done = 0
    tenants_with_results = 0
    diagnostics = {"facet_fallbacks": 0, "task_errors": 0}

    if raw_jobs is None:
        collected: List[Dict[str, Any]] = []
        tasks: List[Tuple[Dict[str, str], str]] = [(r, t) for r in rows for t in terms]
        seen_tenants_with_hits: set = set()
        fallback_tenants: set = set()
        done_tasks = 0
        tasks_per_tenant = max(1, len(terms))
        matchers = _title_matchers(titles)

        def _stream_snapshot() -> None:
            """Push a provisional, cheaply-ranked top slice to the poller so
            the tab renders matches company-by-company during the scan."""
            if not partial_cb:
                return
            snap: Dict[str, Dict[str, Any]] = {}
            for j in collected:
                snap.setdefault(j["job_id"], j)
            rows_snap = list(snap.values())
            for j in rows_snap:
                tl = j["title"].lower()
                tm = any(all(tok in tl for tok in m) for m in matchers)
                j["match_score"] = 45 if tm else 15
                j.setdefault("matched_skills", [])
                j.setdefault("missing_skills", [])
            rows_snap.sort(key=lambda x: (
                -(x["match_score"]),
                x.get("days_ago") if x.get("days_ago") is not None else 99,
            ))
            try:
                partial_cb({
                    "progress": {
                        "tenants_done": min(tenants_total, done_tasks // tasks_per_tenant),
                        "tenants_total": tenants_total,
                        "jobs_found": len(rows_snap),
                    },
                    "jobs": rows_snap[:STREAM_TOP],
                    "total": len(rows_snap),
                    "streaming": True,
                })
            except Exception:
                pass
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(_fetch_tenant_term, r, t, location, us_only): (r, t)
                       for r, t in tasks}
            try:
                for fut in as_completed(futures, timeout=OVERALL_TIMEOUT):
                    r, _t = futures[fut]
                    done_tasks += 1
                    try:
                        items, meta = fut.result()
                    except Exception as e:
                        logger.debug("workday-jobs tenant task failed: %s", e)
                        items, meta = [], {"error": str(e)}
                    if meta.get("facet_fallback"):
                        fallback_tenants.add(r["tenant"])
                    if meta.get("error"):
                        diagnostics["task_errors"] += 1
                    if items:
                        seen_tenants_with_hits.add(r["tenant"])
                        collected.extend(items)
                    # Stream a provisional result slice every ~80 tasks so
                    # matches appear in the tab while the scan continues.
                    if partial_cb and done_tasks % STREAM_EVERY_TASKS == 0:
                        _stream_snapshot()
            except TimeoutError:
                pending = sum(1 for f in futures if not f.done())
                errors.append(f"timeout: {pending} tenant queries did not finish")
                logger.info("[workday-jobs] overall timeout; %d tasks pending", pending)
                for f in futures:
                    if not f.done():
                        f.cancel()
        tenants_done = min(tenants_total, done_tasks // tasks_per_tenant)
        tenants_with_results = len(seen_tenants_with_hits)
        diagnostics["facet_fallbacks"] = len(fallback_tenants)

        # Dedupe (same posting can match multiple terms — remember WHICH
        # terms found it, the scorer uses that) + per-tenant cap so a single
        # high-volume tenant can't flood the feed.
        by_id: Dict[str, Dict[str, Any]] = {}
        for j in collected:
            term = j.pop("search_term", None)
            existing = by_id.get(j["job_id"])
            if existing is None:
                j["matched_terms"] = [term] if term else []
                by_id[j["job_id"]] = j
            elif term and term not in existing["matched_terms"]:
                existing["matched_terms"].append(term)
        per_tenant: Dict[str, int] = {}
        raw_jobs = []
        for j in sorted(by_id.values(), key=lambda x: x.get("days_ago") if x.get("days_ago") is not None else 99):
            n = per_tenant.get(j["tenant"], 0)
            if n >= PER_TENANT_KEEP:
                continue
            per_tenant[j["tenant"]] = n + 1
            raw_jobs.append(j)
        _write_cache(coll, key, raw_jobs)
    else:
        tenants_done = tenants_total
        tenants_with_results = len({j.get("tenant") for j in raw_jobs if j.get("tenant")})

    # Recompute recency at SERVE time — cached rows age (a "Posted Today"
    # row cached before midnight is 1 day old after it), so days_ago must
    # never be trusted from the cache. Rows aging past the window drop out.
    jobs = []
    for j0 in raw_jobs:
        j = dict(j0)
        days = _days_ago(j.get("date_posted") or "")
        if days is None or days > WINDOW_DAYS:
            continue
        # country_code is set by detail enrichment (possibly via a cached
        # earlier run) — it outranks the locationsText heuristic.
        if us_only and j.get("country_code") not in (None, "US"):
            continue
        j["days_ago"] = days
        jobs.append(j)

    if remote_only:
        jobs = [j for j in jobs if j.get("is_remote")]

    def _rank(items: List[Dict[str, Any]]) -> None:
        items.sort(key=lambda j: (
            -(j.get("match_score") or 0),
            j.get("days_ago") if j.get("days_ago") is not None else 99,
        ))

    jobs = _score_jobs(jobs, titles, skills, skill_terms)
    _rank(jobs)

    # Fetch full descriptions for the top slice, then rescore those rows on
    # real skill overlap + exact posting dates. Rows outside the slice keep
    # their title-based score — nothing is dropped either way.
    if partial_cb:
        try:
            partial_cb({
                "progress": {"tenants_done": tenants_total,
                             "tenants_total": tenants_total,
                             "jobs_found": len(jobs), "phase": "details"},
                "jobs": jobs[:STREAM_TOP], "total": len(jobs),
                "streaming": True,
            })
        except Exception:
            pass
    top = jobs[:DETAIL_ENRICH_TOP]
    enriched = _enrich_details(top)
    if enriched:
        _score_jobs(top, titles, skills, skill_terms)
        # startDate refinement can push a row past the window, and the
        # detail country resolves "N Locations" rows definitively.
        jobs = [j for j in jobs
                if j.get("days_ago") is not None and j["days_ago"] <= WINDOW_DAYS
                and not (us_only and j.get("country_code") not in (None, "US"))]
        _rank(jobs)
        # Persist descriptions/exact dates/geo into the cache so repeat
        # searches serve them without re-fetching 200 detail pages.
        if coll is not None:
            enriched_by_id = {j["job_id"]: j for j in top
                              if j.get("description") or j.get("country_code")}
            for rj in raw_jobs:
                e = enriched_by_id.get(rj["job_id"])
                if e:
                    if e.get("description"):
                        rj["description"] = e["description"]
                    rj["date_posted"] = e["date_posted"]
                    rj["is_remote"] = e["is_remote"]
                    rj["location"] = e["location"]
                    if e.get("country_code"):
                        rj["country_code"] = e["country_code"]
            _write_cache(coll, key, raw_jobs)

    jobs = jobs[:GLOBAL_KEEP]

    window_counts = {"today": 0, "d1": 0, "d3": 0, "d7": 0, "d30": 0}
    for j in jobs:
        d = j.get("days_ago")
        if d is None:
            continue
        if d == 0:
            window_counts["today"] += 1
        if d <= 1:
            window_counts["d1"] += 1
        if d <= 3:
            window_counts["d3"] += 1
        if d <= 7:
            window_counts["d7"] += 1
        if d <= 30:
            window_counts["d30"] += 1

    return {
        "ok": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "jobs": jobs,
        "total": len(jobs),
        "window_counts": window_counts,
        "query_terms": terms,
        "tenants_total": tenants_total,
        "tenants_done": tenants_done,
        "tenants_with_results": tenants_with_results,
        "industries_available": INDUSTRIES,
        "cache_hit": cache_hit,
        "us_only": us_only,
        "diagnostics": diagnostics,
        "errors": errors[:20],
    }


def catalog_summary() -> Dict[str, Any]:
    """Lightweight catalog metadata for the tab's filter UI."""
    by_industry: Dict[str, List[Dict[str, str]]] = {}
    for r in WORKDAY_TENANT_CATALOG:
        by_industry.setdefault(r.get("industry") or "tech", []).append(
            {"display_name": r["display_name"], "tenant": r["tenant"]}
        )
    return {
        "total": len(WORKDAY_TENANT_CATALOG),
        "industries": [
            {
                "key": ind,
                "count": len(companies),
                "companies": sorted(companies, key=lambda c: c["display_name"].lower()),
            }
            for ind, companies in sorted(by_industry.items())
        ],
    }
