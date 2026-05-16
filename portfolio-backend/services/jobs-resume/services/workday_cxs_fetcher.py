"""
Direct Workday CXS fetcher — bypasses Apify and hits each tenant's public
public job-board JSON endpoint:

    POST https://{tenant}.{wd_host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
    Body: {"searchText": "...", "locations": [...], "limit": 20, "offset": 0}

This catches roles that the third-party Apify Workday actor misses entirely
because its index doesn't cover every tenant (e.g. Yahoo's
`ouryahoo.wd5.myworkdayjobs.com`). It also returns within seconds with no
Apify credits consumed.

The curated tenant list below is a *starter*. Operators can extend it via
the WORKDAY_TENANTS env var (JSON list of [tenant, host, site, display]
4-tuples). Tenant URLs are verified by visiting the public career site and
copying the four URL parts.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests

from utils.config import _get_config_value

logger = logging.getLogger(__name__)

# (tenant, host, site, display_name)
# host is the wd-cluster the tenant lives on (wd1/wd5/wd12/wd3/...).
# site is the external-board path (varies — visit the careers page and copy).
#
# Every entry below was verified live by hitting
#   POST https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
# and confirming HTTP 200 with a jobPostings array. Tenants that exist but
# returned 4xx (often because their CXS search is gated behind a session
# cookie) were dropped rather than left to silently waste a parallel request.
# Add new tenants via the WORKDAY_TENANTS env var or by extending this list.
DEFAULT_WORKDAY_TENANTS: List[Tuple[str, str, str, str]] = [
    ("ouryahoo", "wd5", "Careers", "Yahoo"),
    ("adobe", "wd5", "external_experienced", "Adobe"),
    ("nvidia", "wd5", "NVIDIAExternalCareerSite", "NVIDIA"),
    ("salesforce", "wd12", "External_Career_Site", "Salesforce"),
    ("capitalone", "wd12", "Capital_One", "Capital One"),
    ("citi", "wd5", "2", "Citi"),
    ("disney", "wd5", "disneycareer", "Disney"),
    ("3m", "wd1", "Search", "3M"),
    ("hpe", "wd5", "Jobsathpe", "HPE"),
    ("walmart", "wd5", "WalmartExternal", "Walmart"),
    ("hp", "wd5", "ExternalCareerSite", "HP"),
    ("dell", "wd1", "External", "Dell"),
    ("intel", "wd1", "External", "Intel"),
    ("paypal", "wd1", "jobs", "PayPal"),
    ("tmobile", "wd1", "External", "T-Mobile"),
    ("micron", "wd1", "External", "Micron"),
    ("baxter", "wd1", "baxter", "Baxter"),
    ("target", "wd5", "targetcareers", "Target"),
    ("autodesk", "wd1", "Ext", "Autodesk"),
    ("philips", "wd3", "jobs-and-careers", "Philips"),
    ("humana", "wd5", "Humana_External_Career_Site", "Humana"),
    ("boeing", "wd1", "EXTERNAL_CAREERS", "Boeing"),
]


def _load_tenants() -> List[Tuple[str, str, str, str]]:
    """Allow operators to extend / override the tenant list via env."""
    raw = _get_config_value("WORKDAY_TENANTS", "")
    if not raw:
        return DEFAULT_WORKDAY_TENANTS
    try:
        parsed = json.loads(raw)
        out: List[Tuple[str, str, str, str]] = []
        for row in parsed:
            if isinstance(row, list) and len(row) == 4:
                out.append((str(row[0]), str(row[1]), str(row[2]), str(row[3])))
        return out + DEFAULT_WORKDAY_TENANTS if out else DEFAULT_WORKDAY_TENANTS
    except Exception as e:
        logger.warning("WORKDAY_TENANTS env override failed to parse (%s); falling back to defaults", e)
        return DEFAULT_WORKDAY_TENANTS


_HEADERS = {
    # Workday CXS rejects requests with no Accept/Content-Type or with a
    # python-requests UA on some clusters. Pretend to be a modern browser.
    "Accept": "application/json,application/xml",
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
}


def _fetch_tenant(
    tenant: str,
    host: str,
    site: str,
    display: str,
    search_text: str,
    location: str,
    limit: int = 20,
    timeout: int = 8,
) -> List[Dict[str, Any]]:
    base = f"https://{tenant}.{host}.myworkdayjobs.com"
    url = f"{base}/wday/cxs/{tenant}/{site}/jobs"
    # Workday CXS expects `locations` to be a list of facet UUIDs — we can't
    # know each tenant's location UUIDs without first calling the facets
    # endpoint, so we use freetext + a US-prefer hint via `appliedFacets`
    # left empty and filter after the fact on locationsText.
    body = {
        "searchText": search_text or "",
        "locations": [],
        "appliedFacets": {},
        "limit": limit,
        "offset": 0,
    }
    try:
        resp = requests.post(url, json=body, headers=_HEADERS, timeout=timeout)
    except requests.RequestException as e:
        logger.debug("Workday CXS %s: network error %s", tenant, e)
        return []
    if not resp.ok:
        # 404 / 403 are common when a site path changes — skip quietly so the
        # search doesn't bomb on one stale entry. Surface at debug only.
        logger.debug("Workday CXS %s: %s %s", tenant, resp.status_code, resp.reason)
        return []
    try:
        data = resp.json()
    except ValueError:
        return []
    postings = data.get("jobPostings") or []
    location_lc = (location or "").strip().lower()
    out: List[Dict[str, Any]] = []
    for jp in postings:
        if not isinstance(jp, dict):
            continue
        title = (jp.get("title") or "").strip()
        if not title:
            continue
        loc_text = (jp.get("locationsText") or "").strip()
        # Apply a soft location filter — the CXS endpoint can't narrow without
        # facet UUIDs, so we trim obvious mismatches here. We keep "remote"
        # and anything that mentions the requested location substring.
        if location_lc and location_lc not in {"united states", "us", "usa"}:
            haystack = loc_text.lower()
            if location_lc not in haystack and "remote" not in haystack:
                continue
        path = (jp.get("externalPath") or "").lstrip("/")
        # externalPath shape: "/job/{loc}/{slug}/{reqid}" — we just need to
        # prepend the canonical /{site}/ prefix and the tenant base URL.
        apply_link = (
            f"{base}/en-US/{site}/{path}" if path else
            jp.get("externalPath") or ""
        )
        posted_on = jp.get("postedOn") or ""
        # Workday CXS gives a relative "Posted Today / Posted 2 Days Ago"
        # rather than an ISO timestamp. We keep both fields populated so the
        # downstream recency filter has something to compare on.
        posted_iso = _approx_iso_from_relative(posted_on)
        req_id = jp.get("bulletFields", [None])[0] or jp.get("workdayJobId") or path
        job_id_seed = f"workday_direct|{tenant}|{req_id}|{title}".lower()
        job_id = "workday_direct:" + hashlib.md5(job_id_seed.encode()).hexdigest()[:24]
        out.append({
            "job_id": job_id,
            "title": title,
            "company": display,
            "logo": "",
            "location": loc_text or "Not specified",
            "apply_link": apply_link,
            "description": "",  # CXS list-view omits descriptions; Tailor fetches on demand
            "salary": "",
            "employment_type": "",
            "date_posted": posted_iso,
            "posted_text": posted_on,
            "is_remote": "remote" in loc_text.lower(),
            "h1b_sponsor": False,  # downstream H1B_SPONSORS regex re-checks
            "contract_friendly": False,
            "source": "Workday Direct",
        })
    return out


_DAY_RE = re.compile(r"(\d+)\+?\s+day", re.IGNORECASE)
_MONTH_RE = re.compile(r"(\d+)\+?\s+month", re.IGNORECASE)


def _approx_iso_from_relative(posted_on: str) -> str:
    """Convert "Posted 2 Days Ago" into an approximate ISO date.

    We bias to the *latest* possible time in the bucket so the recency filter
    is generous: a job marked "Posted Today" gets `now`, "Posted 2 Days Ago"
    gets `now - 2d`, etc. Falls back to empty string when we can't parse.
    """
    text = (posted_on or "").strip().lower()
    if not text:
        return ""
    now = datetime.now(timezone.utc)
    if "today" in text or "just" in text:
        return now.isoformat()
    if "yesterday" in text:
        from datetime import timedelta
        return (now - timedelta(days=1)).isoformat()
    m = _DAY_RE.search(text)
    if m:
        from datetime import timedelta
        return (now - timedelta(days=int(m.group(1)))).isoformat()
    m = _MONTH_RE.search(text)
    if m:
        from datetime import timedelta
        return (now - timedelta(days=int(m.group(1)) * 30)).isoformat()
    return ""


def fetch_workday_direct(
    search_text: str,
    location: str = "",
    tenants: Optional[List[Tuple[str, str, str, str]]] = None,
    per_tenant_limit: int = 20,
    overall_timeout: int = 12,
    max_workers: int = 16,
) -> List[Dict[str, Any]]:
    """Fan out to every configured Workday tenant in parallel.

    Returns a flat list of normalized job dicts. Individual tenant failures
    are swallowed at debug level — a partial result is far better than a hard
    error when one of 40 tenants changes its URL path.
    """
    tenant_list = tenants if tenants is not None else _load_tenants()
    if not tenant_list:
        return []
    out: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [
            pool.submit(
                _fetch_tenant,
                tenant, host, site, display,
                search_text, location, per_tenant_limit,
            )
            for tenant, host, site, display in tenant_list
        ]
        for fut in as_completed(futures, timeout=overall_timeout):
            try:
                out.extend(fut.result(timeout=overall_timeout))
            except Exception as e:
                logger.debug("Workday CXS tenant fetch failed: %s", e)
    logger.info("[workday-direct] fetched %d total postings across %d tenants",
                len(out), len(tenant_list))
    return out
