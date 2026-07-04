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
# results don't leak the old shape into the UI. v4: tightened geo tiers
# ("IN"-suffix, "Remote India", "CA-Toronto" no longer slip through).
RESULT_SCHEMA_VERSION = 4

# Fan-out envelope — tuned against a live full-catalog run (532 tenants x
# 3 terms, 2026-07): 1 page/term is enough because the US facet + relevance
# ranking put the best matches on page 1 and PER_TENANT_KEEP caps the take
# anyway; 96 workers is safe because the load spreads across ~532 distinct
# hosts (per-host concurrency stays ~1). The CXS API rejects limit > 20.
# jobs-resume Lambda timeout is 900s, so OVERALL_TIMEOUT=420 has headroom.
PAGE_LIMIT = 20
MAX_PAGES_PER_TERM = 1
MAX_QUERY_TERMS = 3
PER_TENANT_KEEP = 20
GLOBAL_KEEP = 1500
REQUEST_TIMEOUT = 6
OVERALL_TIMEOUT = 420
MAX_WORKERS = 96
WINDOW_DAYS = 30

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
    user_email: str,
) -> List[Dict[str, Any]]:
    """Attach match_score / matched_skills / missing_skills to every job.

    Two signals, both deterministic (no LLM):
      - skill overlap of the job TITLE against the parsed resume skills
        (jd_match_scorer.score_one — same scorer the pipeline overlay uses);
      - a title-family bonus when the job title covers all core tokens of one
        of the user's search titles. The CXS list view has no description, so
        the title bonus carries most of the ranking weight.
    """
    from services.jd_match_scorer import _load_user_skills, score_one

    skills = _load_user_skills(user_email) if user_email else []
    matchers = _title_matchers(titles)

    for job in jobs:
        title_lc = job["title"].lower()
        title_matched = any(all(tok in title_lc for tok in m) for m in matchers)
        if skills:
            s = score_one(jd_text="", title=job["title"], resume_skills=skills)
            base = s["match_score"]
            matched = s["matched_skills"]
            missing = s["missing_top"]
        else:
            base, matched, missing = 0, [], []
        score = min(100, base + (45 if title_matched else 0))
        if not skills and not title_matched:
            score = 15  # neutral floor so the ring isn't a sea of zeros
        job["match_score"] = score
        job["matched_skills"] = matched
        job["missing_skills"] = missing
        job["title_matched"] = title_matched
    return jobs


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
    terms = _derive_query_terms(titles)
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
                    # Progress stream every ~25 completed tasks so the tab can
                    # render "Scanned N of M companies - X roles so far".
                    if partial_cb and done_tasks % 25 == 0:
                        try:
                            partial_cb({
                                "progress": {
                                    "tenants_done": min(tenants_total, done_tasks // tasks_per_tenant),
                                    "tenants_total": tenants_total,
                                    "jobs_found": len(collected),
                                },
                            })
                        except Exception:
                            pass
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

        # Dedupe (same posting can match multiple terms) + per-tenant cap so a
        # single high-volume tenant can't flood the feed.
        by_id: Dict[str, Dict[str, Any]] = {}
        for j in collected:
            by_id.setdefault(j["job_id"], j)
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

    jobs = [dict(j) for j in raw_jobs]

    if remote_only:
        jobs = [j for j in jobs if j.get("is_remote")]

    jobs = _score_jobs(jobs, titles, user_email)
    jobs.sort(key=lambda j: (
        -(j.get("match_score") or 0),
        j.get("days_ago") if j.get("days_ago") is not None else 99,
    ))
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
