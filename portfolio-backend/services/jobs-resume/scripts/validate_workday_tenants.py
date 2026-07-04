"""
Workday tenant catalog validator.

Probes every candidate (tenant, wd_host, site) combo against the live public
CXS endpoint:

    POST https://{tenant}.{wd_host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs

and emits a verified catalog module + a verified/rejected report. Run this
whenever the catalog is extended — NEVER ship a guessed combo without a 200.

Observed CXS status semantics (probed 2026-07):
    200 -> tenant + host + site all correct (response has jobPostings/total)
    404 -> tenant exists on this host but the site name is wrong
    422 -> tenant is not served from this wd host (or doesn't exist at all)

So the search strategy per candidate is:
    1. Try the candidate's own (host, site).
    2. If 404 -> host is right: scan common site names on that host.
    3. If 422 -> scan other wd hosts with the candidate site until one
       returns 200/404, then scan sites there.

Usage:
    python scripts/validate_workday_tenants.py candidates.json \
        --out-module services/workday_tenant_catalog.py \
        --out-report workday_tenant_report.md \
        [--concurrency 24]

candidates.json: [{"display_name","tenant","wd_host","site","industry"}, ...]
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

import requests

HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
}
PROBE_BODY = {"searchText": "", "locations": [], "appliedFacets": {}, "limit": 1, "offset": 0}
TIMEOUT = 12

HOST_CANDIDATES = ["wd1", "wd5", "wd3", "wd12", "wd2", "wd10", "wd103", "wd108"]
SITE_CANDIDATES = [
    "External", "Careers", "careers", "External_Career_Site", "ExternalCareerSite",
    "External_Careers", "ExternalCareers", "CareerSite", "Careers_External",
    "External_Career", "CorporateCareers", "Corporate_Careers", "Search",
    "External_Site", "jobs", "1", "2", "External1", "Global_Careers",
    "global_careers", "EXTERNAL_CAREERS", "en-US",
]

_print_lock = threading.Lock()


def _probe(tenant: str, host: str, site: str, session: requests.Session) -> Tuple[int, int]:
    """Return (status_code, total_postings). status -1 on network error."""
    url = f"https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
    try:
        resp = session.post(url, json=PROBE_BODY, headers=HEADERS, timeout=TIMEOUT)
    except requests.RequestException:
        return -1, 0
    if resp.status_code != 200:
        return resp.status_code, 0
    try:
        data = resp.json()
    except ValueError:
        return -2, 0
    if not isinstance(data, dict) or "jobPostings" not in data:
        return -2, 0
    return 200, int(data.get("total") or 0)


def _resolve(cand: Dict[str, Any], session: requests.Session) -> Dict[str, Any]:
    tenant = str(cand.get("tenant") or "").strip().lower()
    guess_host = str(cand.get("wd_host") or "wd1").strip().lower()
    guess_site = str(cand.get("site") or "External").strip()
    out = dict(cand)
    out["tenant"] = tenant

    if not tenant:
        out.update(status="rejected", reason="empty tenant")
        return out

    def _ok(host: str, site: str, total: int) -> Dict[str, Any]:
        out.update(status="verified", wd_host=host, site=site, total_postings=total,
                   reason="")
        return out

    # Step 1: exact guess.
    code, total = _probe(tenant, guess_host, guess_site, session)
    if code == 200:
        return _ok(guess_host, guess_site, total)

    hosts_to_try: List[str] = []
    if code == 404:
        # Host is right, site wrong — scan sites on this host only.
        hosts_to_try = [guess_host]
    else:
        # 422 / network error — find the right host first.
        hosts_to_try = [h for h in HOST_CANDIDATES if h != guess_host]

    site_scan = [guess_site] + [s for s in SITE_CANDIDATES if s.lower() != guess_site.lower()]

    for host in hosts_to_try:
        if host != guess_host:
            code, total = _probe(tenant, host, guess_site, session)
            if code == 200:
                return _ok(host, guess_site, total)
            if code != 404:
                # Tenant not on this host — move on without scanning sites.
                continue
        # Here: 404 on this host → tenant exists here, scan site names.
        for site in site_scan[1:]:
            code, total = _probe(tenant, host, site, session)
            if code == 200:
                return _ok(host, site, total)
        # Tenant exists on this host but none of the common sites matched —
        # record and stop (scanning further hosts would 422 anyway).
        out.update(status="rejected", reason=f"host {host} found but no working site")
        return out

    out.update(status="rejected", reason="no wd host accepted this tenant")
    return out


def validate(candidates: List[Dict[str, Any]], concurrency: int = 24) -> List[Dict[str, Any]]:
    # Dedupe by tenant, keep first occurrence.
    seen = set()
    deduped = []
    for c in candidates:
        t = str(c.get("tenant") or "").strip().lower()
        if not t or t in seen:
            continue
        seen.add(t)
        deduped.append(c)

    results: List[Dict[str, Any]] = []
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=concurrency,
                                            pool_maxsize=concurrency)
    session.mount("https://", adapter)
    done = 0
    start = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {pool.submit(_resolve, c, session): c for c in deduped}
        for fut in as_completed(futures):
            r = fut.result()
            results.append(r)
            done += 1
            with _print_lock:
                mark = "OK " if r["status"] == "verified" else "REJ"
                print(f"[{done}/{len(deduped)}] {mark} {r['tenant']:<28} "
                      f"{r.get('wd_host','?'):<5} {r.get('site','?'):<30} "
                      f"{r.get('reason','')}", flush=True)
    print(f"\nValidated {len(deduped)} tenants in {time.time()-start:.0f}s")
    return results


def write_module(verified: List[Dict[str, Any]], path: str) -> None:
    verified = sorted(verified, key=lambda r: (r.get("industry") or "", r["tenant"]))
    lines = [
        '"""',
        "Curated + live-validated Workday tenant catalog for the Workday Jobs tab.",
        "",
        "AUTO-GENERATED by scripts/validate_workday_tenants.py — every row below",
        "returned HTTP 200 with a jobPostings payload from the public CXS endpoint",
        "at generation time. Regenerate rather than hand-editing:",
        "",
        "    python scripts/validate_workday_tenants.py candidates.json \\",
        "        --out-module services/workday_tenant_catalog.py \\",
        "        --out-report workday_tenant_report.md",
        '"""',
        "from __future__ import annotations",
        "",
        "from typing import Dict, List",
        "",
        "# Each row: display_name, tenant, wd_host, site, industry",
        "WORKDAY_TENANT_CATALOG: List[Dict[str, str]] = [",
    ]
    current_industry = None
    for r in verified:
        ind = r.get("industry") or "tech"
        if ind != current_industry:
            lines.append(f"    # ── {ind} " + "─" * max(1, 58 - len(ind)))
            current_industry = ind
        lines.append(
            "    {"
            + f'"display_name": {json.dumps(r.get("display_name") or r["tenant"])}, '
            + f'"tenant": {json.dumps(r["tenant"])}, '
            + f'"wd_host": {json.dumps(r["wd_host"])}, '
            + f'"site": {json.dumps(r["site"])}, '
            + f'"industry": {json.dumps(ind)}'
            + "},"
        )
    lines += [
        "]",
        "",
        "INDUSTRIES: List[str] = sorted({row[\"industry\"] for row in WORKDAY_TENANT_CATALOG})",
        "",
    ]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote {len(verified)} verified tenants to {path}")


def write_report(results: List[Dict[str, Any]], path: str) -> None:
    verified = [r for r in results if r["status"] == "verified"]
    rejected = [r for r in results if r["status"] != "verified"]
    by_ind: Dict[str, int] = {}
    for r in verified:
        by_ind[r.get("industry") or "?"] = by_ind.get(r.get("industry") or "?", 0) + 1
    lines = [
        "# Workday tenant validation report",
        "",
        f"- Candidates probed: **{len(results)}**",
        f"- Verified (HTTP 200 + jobPostings): **{len(verified)}**",
        f"- Rejected: **{len(rejected)}**",
        "",
        "## Verified per industry",
        "",
        "| Industry | Count |",
        "|---|---|",
    ]
    for ind, n in sorted(by_ind.items()):
        lines.append(f"| {ind} | {n} |")
    lines += ["", "## Verified tenants", "",
              "| Company | Tenant | Host | Site | Industry | Postings |", "|---|---|---|---|---|---|"]
    for r in sorted(verified, key=lambda x: (x.get("industry") or "", x["tenant"])):
        lines.append(f"| {r.get('display_name','')} | {r['tenant']} | {r['wd_host']} | "
                     f"{r['site']} | {r.get('industry','')} | {r.get('total_postings','')} |")
    lines += ["", "## Rejected candidates", "",
              "| Company | Tenant | Reason |", "|---|---|---|"]
    for r in sorted(rejected, key=lambda x: x["tenant"]):
        lines.append(f"| {r.get('display_name','')} | {r['tenant']} | {r.get('reason','')} |")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Wrote report to {path}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("candidates", help="JSON file with candidate tenant list")
    ap.add_argument("--out-module", default="services/workday_tenant_catalog.py")
    ap.add_argument("--out-report", default="workday_tenant_report.md")
    ap.add_argument("--concurrency", type=int, default=24)
    args = ap.parse_args()

    with open(args.candidates, encoding="utf-8") as f:
        candidates = json.load(f)
    results = validate(candidates, concurrency=args.concurrency)
    verified = [r for r in results if r["status"] == "verified"]
    write_module(verified, args.out_module)
    write_report(results, args.out_report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
