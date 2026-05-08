"""
JD Fetcher — best-effort extraction of a job description from a posting URL.

Used by the Tailor flow when the pipeline scrape didn't include a description
(LinkedIn / Workday / Indeed / company sites can all skip it). The frontend
calls /api/jobs/fetch-jd?url=... once the user clicks "Tailor", and the
returned text seeds the JD textarea so the user doesn't have to paste it.

Strategy by URL kind:
  * LinkedIn /jobs/view/{id}    → use the public guest endpoint
                                   /jobs-guest/jobs/api/jobPosting/{id}
                                   which returns rendered HTML for the JD
                                   without requiring auth.
  * Greenhouse boards.greenhouse.io/{slug}/jobs/{id}
                                → call boards-api.greenhouse.io for the
                                   full content field. Reuses the listing
                                   API behavior the pipeline already trusts.
  * Lever jobs.lever.co/{slug}/{id}
                                → /v0/postings/{slug}/{id}?mode=json.
  * Ashby jobs.ashbyhq.com/{slug}/{id}
                                → /posting-api/job-board/{slug}/{id}.
  * Anything else (Workday, Greenhouse-on-custom-domain, company careers)
                                → plain HTTPS GET + HTML strip. Covers most
                                   server-rendered ATSes but won't help for
                                   single-page apps that hydrate client-side.

All paths are bounded with short timeouts and length caps so a slow / huge
posting can't hang the request thread.
"""
from __future__ import annotations

import logging
import re
from typing import Optional, Tuple
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

# Reuse the HTML→text helper from daily_pipeline_service so behavior is
# consistent with the listing scrape.
from services.daily_pipeline_service import _html_to_text  # noqa: E402

_TIMEOUT_S = 12
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
)
_MAX_JD_CHARS = 6000


# ---------------------------------------------------------------------------
# URL classifiers
# ---------------------------------------------------------------------------

# LinkedIn URLs come in two shapes:
#   /jobs/view/3845678920                           (id only)
#   /jobs/view/sde-i-at-amazon-3845678920            (slug-then-id)
# Either way the numeric ID is at the end of the path segment, so we anchor
# on a trailing digit cluster before the next slash / query / hash.
_LINKEDIN_VIEW_RE = re.compile(
    r"linkedin\.com/jobs/(?:view|collections)/(?:[^/?#]*?-)?(\d{6,})(?:[/?#]|$)",
    re.IGNORECASE,
)
_GREENHOUSE_RE = re.compile(r"boards\.greenhouse\.io/([^/]+)/jobs/(\d+)", re.IGNORECASE)
_GREENHOUSE_API_RE = re.compile(r"greenhouse\.io/embed/job_app\?token=([^&]+)", re.IGNORECASE)
_LEVER_RE = re.compile(r"jobs\.(?:eu\.)?lever\.co/([^/]+)/([^/?#]+)", re.IGNORECASE)
_ASHBY_RE = re.compile(r"jobs\.ashbyhq\.com/([^/]+)/([^/?#]+)", re.IGNORECASE)


def fetch_jd(url: str) -> Tuple[str, str]:
    """Return (description_text, source_kind). Empty text if extraction failed.

    `source_kind` lets the caller log which strategy was tried — useful in
    the UI's Tailor toast so the user can tell whether they got the rich
    Greenhouse JD or a generic HTML strip.
    """
    if not url or not isinstance(url, str):
        return "", "invalid_url"
    url = url.strip()
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return "", "invalid_url"

    # ---- LinkedIn (guest job-posting endpoint, no auth required) --------
    m = _LINKEDIN_VIEW_RE.search(url)
    if m:
        job_id = m.group(1)
        return _fetch_linkedin_guest(job_id), "linkedin_guest"

    # ---- Greenhouse hosted board ----------------------------------------
    m = _GREENHOUSE_RE.search(url)
    if m:
        slug, job_id = m.group(1), m.group(2)
        return _fetch_greenhouse_detail(slug, job_id), "greenhouse_api"

    # ---- Lever hosted board ---------------------------------------------
    m = _LEVER_RE.search(url)
    if m:
        slug, posting_id = m.group(1), m.group(2)
        return _fetch_lever_detail(slug, posting_id), "lever_api"

    # ---- Ashby hosted board ---------------------------------------------
    m = _ASHBY_RE.search(url)
    if m:
        slug, posting_id = m.group(1), m.group(2)
        return _fetch_ashby_detail(slug, posting_id), "ashby_api"

    # ---- Generic HTML scrape (Workday, company careers, etc.) -----------
    # Workday URLs vary per tenant (myworkdayjobs.com, careers.<co>.com).
    # A vanilla GET works for server-rendered Workday pages; it won't help
    # for the client-rendered single-page versions but those are rare among
    # entry-level postings.
    return _fetch_generic_html(url), "html_scrape"


# ---------------------------------------------------------------------------
# Per-source extractors
# ---------------------------------------------------------------------------

def _fetch_linkedin_guest(job_id: str) -> str:
    api_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    try:
        r = requests.get(api_url, timeout=_TIMEOUT_S, headers={"User-Agent": _UA})
        if not r.ok:
            logger.info("LinkedIn guest JD %s returned %s", job_id, r.status_code)
            return ""
        return _html_to_text(r.text)[:_MAX_JD_CHARS]
    except Exception as e:
        logger.warning("LinkedIn guest JD %s failed: %s", job_id, e)
        return ""


def _fetch_greenhouse_detail(slug: str, job_id: str) -> str:
    api_url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{job_id}?content=true"
    try:
        r = requests.get(api_url, timeout=_TIMEOUT_S)
        if not r.ok:
            return ""
        body = r.json() or {}
        content = body.get("content") or ""
        return _html_to_text(content)[:_MAX_JD_CHARS]
    except Exception as e:
        logger.warning("Greenhouse JD %s/%s failed: %s", slug, job_id, e)
        return ""


def _fetch_lever_detail(slug: str, posting_id: str) -> str:
    api_url = f"https://api.lever.co/v0/postings/{slug}/{posting_id}?mode=json"
    try:
        r = requests.get(api_url, timeout=_TIMEOUT_S)
        if not r.ok:
            return ""
        body = r.json() or {}
        plain = (body.get("descriptionPlain") or "").strip()
        if not plain:
            plain = _html_to_text(body.get("descriptionBody") or "")
        # Append lists (Responsibilities / Qualifications / etc.).
        for sec in (body.get("lists") or []):
            if not isinstance(sec, dict):
                continue
            heading = (sec.get("text") or "").strip()
            content = _html_to_text(sec.get("content") or "")
            if heading or content:
                plain += f"\n\n{heading}\n{content}".rstrip()
        return plain[:_MAX_JD_CHARS]
    except Exception as e:
        logger.warning("Lever JD %s/%s failed: %s", slug, posting_id, e)
        return ""


def _fetch_ashby_detail(slug: str, posting_id: str) -> str:
    api_url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}/{posting_id}"
    try:
        r = requests.get(api_url, timeout=_TIMEOUT_S)
        if not r.ok:
            return ""
        body = r.json() or {}
        # Ashby wraps the posting in a `job` field on detail endpoints.
        job = body.get("job") if isinstance(body.get("job"), dict) else body
        plain = (job.get("descriptionPlain") or "").strip()
        if not plain:
            plain = _html_to_text(job.get("descriptionHtml") or job.get("description") or "")
        return plain[:_MAX_JD_CHARS]
    except Exception as e:
        logger.warning("Ashby JD %s/%s failed: %s", slug, posting_id, e)
        return ""


def _fetch_generic_html(url: str) -> str:
    try:
        r = requests.get(url, timeout=_TIMEOUT_S, headers={"User-Agent": _UA}, allow_redirects=True)
        if not r.ok:
            return ""
        # Cap raw body before regex work — some pages are MB of HTML and most
        # of it is non-content (navs, footers, scripts).
        raw = r.text[:300_000]
        # Strip <script>/<style>/<svg> blocks before the generic HTML→text
        # pass so their contents don't leak into the JD as garbage.
        raw = re.sub(r"<(script|style|svg)\b[^>]*>.*?</\1>", " ", raw, flags=re.IGNORECASE | re.DOTALL)
        # Some Workday pages embed the JD inside a JSON-LD <script type="application/ld+json">
        # block we just removed. Try one focused extraction before falling
        # back to the body strip.
        ld_match = re.search(
            r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>",
            r.text[:300_000],
            flags=re.IGNORECASE | re.DOTALL,
        )
        if ld_match:
            try:
                import json as _json
                ld = _json.loads(ld_match.group(1))
                if isinstance(ld, list):
                    ld = next((x for x in ld if isinstance(x, dict) and x.get("@type") == "JobPosting"), None)
                if isinstance(ld, dict) and ld.get("description"):
                    text = _html_to_text(str(ld["description"]))
                    if text and len(text) > 80:
                        return text[:_MAX_JD_CHARS]
            except Exception:
                pass
        text = _html_to_text(raw)
        return text[:_MAX_JD_CHARS]
    except Exception as e:
        logger.warning("Generic JD scrape %s failed: %s", url, e)
        return ""
