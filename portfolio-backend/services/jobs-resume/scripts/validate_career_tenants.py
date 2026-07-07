"""Validate career-page ATS candidates and emit the verified catalog.

Probes each candidate's public job-board JSON API (no auth, no scraping):
  greenhouse      GET boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=false
  lever           GET api.lever.co/v0/postings/{slug}?mode=json
  ashby           POST api.ashbyhq.com/posting-api/job-board/{slug}
  smartrecruiters GET api.smartrecruiters.com/v1/companies/{slug}/postings?limit=10
  workable        GET apply.workable.com/api/v1/widget/accounts/{slug}
  recruitee       GET {slug}.recruitee.com/api/offers/
  bamboohr        GET {slug}.bamboohr.com/careers/list

A candidate is VERIFIED when the endpoint returns 200 with a parsable jobs
payload. Rows with zero open jobs still count (catalog keeps them; the live
search just finds nothing that day). Output:
  - services/career_pages_catalog.py  (generated module)
  - scripts/career_pages_report.md    (probe report)

Usage:
  python scripts/validate_career_tenants.py cand1.json [cand2.json ...]
Candidate JSON: [{"display_name","ats","slug","industry"}, ...]
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"),
    "Accept": "application/json",
}
TIMEOUT = 8
WORKERS = 48

VALID_INDUSTRIES = {
    "tech", "fintech", "banking", "healthtech", "ecommerce_retail",
    "manufacturing_automotive", "insurance", "consulting", "pharma",
    "energy", "telecom", "media", "aerospace_defense", "gaming", "other",
}


def _get(url: str, **kw) -> Optional[requests.Response]:
    try:
        return requests.get(url, headers=HEADERS, timeout=TIMEOUT, **kw)
    except requests.RequestException:
        return None


def probe_greenhouse(slug: str) -> Tuple[bool, int, str]:
    r = _get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=false")
    if r is None:
        return False, 0, "network"
    if r.status_code != 200:
        return False, 0, f"http {r.status_code}"
    try:
        jobs = (r.json() or {}).get("jobs")
    except ValueError:
        return False, 0, "bad json"
    if not isinstance(jobs, list):
        return False, 0, "no jobs[]"
    return True, len(jobs), "ok"


def probe_lever(slug: str) -> Tuple[bool, int, str]:
    r = _get(f"https://api.lever.co/v0/postings/{slug}?mode=json&limit=100")
    if r is None:
        return False, 0, "network"
    if r.status_code != 200:
        return False, 0, f"http {r.status_code}"
    try:
        data = r.json()
    except ValueError:
        return False, 0, "bad json"
    if not isinstance(data, list):
        return False, 0, "not a list"
    return True, len(data), "ok"


def probe_ashby(slug: str) -> Tuple[bool, int, str]:
    # Ashby's posting API is GET-only (POST returns 401).
    r = _get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    if r is None:
        return False, 0, "network"
    if r.status_code != 200:
        return False, 0, f"http {r.status_code}"
    try:
        jobs = (r.json() or {}).get("jobs")
    except ValueError:
        return False, 0, "bad json"
    if not isinstance(jobs, list):
        return False, 0, "no jobs[]"
    return True, len(jobs), "ok"


def probe_smartrecruiters(slug: str) -> Tuple[bool, int, str]:
    r = _get(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=10")
    if r is None:
        return False, 0, "network"
    if r.status_code != 200:
        return False, 0, f"http {r.status_code}"
    try:
        data = r.json() or {}
    except ValueError:
        return False, 0, "bad json"
    if "content" not in data:
        return False, 0, "no content[]"
    return True, int(data.get("totalFound") or len(data["content"])), "ok"


def probe_workable(slug: str) -> Tuple[bool, int, str]:
    r = _get(f"https://apply.workable.com/api/v1/widget/accounts/{slug}")
    if r is None:
        return False, 0, "network"
    if r.status_code != 200:
        return False, 0, f"http {r.status_code}"
    try:
        data = r.json() or {}
    except ValueError:
        return False, 0, "bad json"
    jobs = data.get("jobs")
    if not isinstance(jobs, list):
        return False, 0, "no jobs[]"
    return True, int(data.get("total") or len(jobs)), "ok"


def probe_recruitee(slug: str) -> Tuple[bool, int, str]:
    r = _get(f"https://{slug}.recruitee.com/api/offers/")
    if r is None:
        return False, 0, "network"
    if r.status_code != 200:
        return False, 0, f"http {r.status_code}"
    try:
        offers = (r.json() or {}).get("offers")
    except ValueError:
        return False, 0, "bad json"
    if not isinstance(offers, list):
        return False, 0, "no offers[]"
    return True, len(offers), "ok"


def probe_bamboohr(slug: str) -> Tuple[bool, int, str]:
    r = _get(f"https://{slug}.bamboohr.com/careers/list")
    if r is None:
        return False, 0, "network"
    if r.status_code != 200:
        return False, 0, f"http {r.status_code}"
    try:
        result = (r.json() or {}).get("result")
    except ValueError:
        return False, 0, "bad json"
    if not isinstance(result, list):
        return False, 0, "no result[]"
    return True, len(result), "ok"


PROBES = {
    "greenhouse": probe_greenhouse,
    "lever": probe_lever,
    "ashby": probe_ashby,
    "smartrecruiters": probe_smartrecruiters,
    "workable": probe_workable,
    "recruitee": probe_recruitee,
    # bamboohr intentionally EXCLUDED: its public /careers/list JSON carries
    # no posting dates, so the tab's recency guarantee can't be honored.
    # (probe_bamboohr kept above for when that changes.)
}


def main(paths: List[str]) -> None:
    seen: set = set()
    cands: List[Dict[str, str]] = []
    for p in paths:
        for row in json.load(open(p, encoding="utf-8")):
            ats = str(row.get("ats", "")).lower()
            slug = str(row.get("slug", "")).strip()
            if ats not in PROBES or not slug:
                continue
            key = (ats, slug.lower())
            if key in seen:
                continue
            seen.add(key)
            ind = row.get("industry") if row.get("industry") in VALID_INDUSTRIES else "other"
            cands.append({"display_name": str(row.get("display_name") or slug).strip(),
                          "ats": ats, "slug": slug, "industry": ind})
    print(f"candidates: {len(cands)}")

    results: List[Tuple[Dict[str, str], bool, int, str]] = []
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = {pool.submit(PROBES[c["ats"]], c["slug"]): c for c in cands}
        done = 0
        for fut in as_completed(futs):
            c = futs[fut]
            try:
                ok, n, note = fut.result()
            except Exception as e:  # pragma: no cover
                ok, n, note = False, 0, f"err {e}"
            results.append((c, ok, n, note))
            done += 1
            if done % 100 == 0:
                print(f"  probed {done}/{len(cands)} ({time.time()-t0:.0f}s)")

    verified = sorted([(c, n) for c, ok, n, _ in results if ok],
                      key=lambda x: (x[0]["ats"], x[0]["display_name"].lower()))
    failed = [(c, note) for c, ok, _, note in results if not ok]
    print(f"verified: {len(verified)} | failed: {len(failed)} | {time.time()-t0:.0f}s")

    by_ats: Dict[str, int] = {}
    by_ind: Dict[str, int] = {}
    for c, _n in verified:
        by_ats[c["ats"]] = by_ats.get(c["ats"], 0) + 1
        by_ind[c["industry"]] = by_ind.get(c["industry"], 0) + 1
    print("by ats:", dict(sorted(by_ats.items())))
    print("by industry:", dict(sorted(by_ind.items())))

    base = Path(__file__).resolve().parent.parent
    mod = base / "services" / "career_pages_catalog.py"
    lines = [
        '"""Verified career-page ATS catalog (companies NOT on Workday).',
        "",
        "AUTO-GENERATED by scripts/validate_career_tenants.py — every row's",
        "public job-board JSON API returned 200 with a parsable jobs payload",
        "at validation time. Regenerate rather than hand-editing.",
        '"""',
        "from __future__ import annotations",
        "",
        "from typing import Dict, List",
        "",
        "CAREER_PAGES_CATALOG: List[Dict[str, str]] = [",
    ]
    for c, _n in verified:
        lines.append(
            f'    {{"display_name": {json.dumps(c["display_name"])}, '
            f'"ats": "{c["ats"]}", "slug": {json.dumps(c["slug"])}, '
            f'"industry": "{c["industry"]}"}},')
    lines += [
        "]",
        "",
        "INDUSTRIES: List[str] = sorted({r[\"industry\"] for r in CAREER_PAGES_CATALOG})",
        "ATS_KINDS: List[str] = sorted({r[\"ats\"] for r in CAREER_PAGES_CATALOG})",
        "",
    ]
    mod.write_text("\n".join(lines), encoding="utf-8")
    print("wrote", mod)

    rep = base / "scripts" / "career_pages_report.md"
    out = ["# Career-page ATS validation report", "",
           f"Probed {len(cands)} candidates -> **{len(verified)} verified**.", "",
           "| Company | ATS | Slug | Industry | Open jobs |", "|---|---|---|---|---|"]
    for c, n in verified:
        out.append(f"| {c['display_name']} | {c['ats']} | {c['slug']} | {c['industry']} | {n} |")
    out += ["", f"## Failed ({len(failed)})", "", "| Company | ATS | Slug | Reason |", "|---|---|---|---|"]
    for c, note in failed:
        out.append(f"| {c['display_name']} | {c['ats']} | {c['slug']} | {note} |")
    rep.write_text("\n".join(out), encoding="utf-8")
    print("wrote", rep)


if __name__ == "__main__":
    main(sys.argv[1:])
