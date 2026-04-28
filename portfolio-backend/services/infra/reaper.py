"""
Ephemeral preview env reaper.

Triggered by EventBridge daily. Logic:
  1. Use ResourceGroupsTaggingAPI to enumerate live preview resources by tag
     (Purpose=ephemeral-previews). This is the source of truth.
  2. For each branch_slug found, look up the GitHub PR via the API.
  3. Tear down envs whose PR is closed/merged, or whose last_seen_at is older
     than PREVIEW_IDLE_DAYS (default 7).
  4. Trigger preview-down.yml via workflow_dispatch (does not destroy directly
     so that all teardowns flow through one well-tested path).

Environment:
  PREVIEW_DDB_TABLE       - DynamoDB table name
  PREVIEW_IDLE_DAYS       - days of inactivity before reap (default 7)
  SSM_PREVIEW_GITHUB_PAT  - SSM param holding GitHub PAT
  SSM_PREVIEW_GITHUB_REPO - SSM param holding "owner/repo"
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone, timedelta

import boto3
import requests
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AWS_REGION = os.getenv("AWS_REGION_NAME", os.getenv("AWS_REGION", "us-east-1"))
DDB_TABLE = os.getenv("PREVIEW_DDB_TABLE", "")
IDLE_DAYS = int(os.getenv("PREVIEW_IDLE_DAYS", "7"))


def _ssm(env_var: str) -> str:
    name = os.getenv(env_var, "")
    if not name:
        return ""
    ssm = boto3.client("ssm", region_name=AWS_REGION)
    return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def _slugs_from_tags() -> set[str]:
    client = boto3.client("resourcegroupstaggingapi", region_name=AWS_REGION)
    paginator = client.get_paginator("get_resources")
    slugs: set[str] = set()
    for page in paginator.paginate(
        TagFilters=[{"Key": "Purpose", "Values": ["ephemeral-previews"]}]
    ):
        for r in page.get("ResourceTagMappingList", []):
            for t in r.get("Tags", []):
                if t["Key"] == "EphemeralBranch":
                    slugs.add(t["Value"])
    return slugs


def _ddb_rows() -> dict[str, dict]:
    if not DDB_TABLE:
        return {}
    ddb = boto3.client("dynamodb", region_name=AWS_REGION)
    out: dict[str, dict] = {}
    paginator = ddb.get_paginator("scan")
    for page in paginator.paginate(TableName=DDB_TABLE):
        for item in page.get("Items", []):
            slug = item.get("branch_slug", {}).get("S")
            if slug:
                out[slug] = {k: list(v.values())[0] for k, v in item.items()}
    return out


def _pr_open(repo: str, pat: str, pr_number: int) -> bool:
    if pr_number <= 0:
        return False
    r = requests.get(
        f"https://api.github.com/repos/{repo}/pulls/{pr_number}",
        headers={
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github+json",
        },
        timeout=10,
    )
    if r.status_code != 200:
        logger.warning("PR fetch %s -> %s", pr_number, r.status_code)
        return False
    return r.json().get("state") == "open"


def _trigger_teardown(repo: str, pat: str, slug: str) -> bool:
    r = requests.post(
        f"https://api.github.com/repos/{repo}/actions/workflows/preview-down.yml/dispatches",
        headers={
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json={"ref": "main", "inputs": {"branch_slug": slug}},
        timeout=10,
    )
    if r.status_code >= 300:
        logger.error("teardown dispatch %s -> %s %s", slug, r.status_code, r.text[:200])
        return False
    return True


def _is_idle(row: dict) -> bool:
    last = row.get("last_seen_at") or row.get("created_at")
    if not last:
        return False
    try:
        ts = datetime.fromisoformat(last.replace("Z", "+00:00"))
    except ValueError:
        return False
    return datetime.now(timezone.utc) - ts > timedelta(days=IDLE_DAYS)


def handler(event, context):
    pat = _ssm("SSM_PREVIEW_GITHUB_PAT")
    repo = _ssm("SSM_PREVIEW_GITHUB_REPO")
    if not pat or not repo:
        logger.error("reaper missing PAT or repo SSM config; aborting")
        return {"ok": False, "reason": "missing config"}

    tag_slugs = _slugs_from_tags()
    rows = _ddb_rows()
    all_slugs = tag_slugs | set(rows.keys())

    teardown_targets: list[tuple[str, str]] = []
    for slug in sorted(all_slugs):
        row = rows.get(slug, {})
        try:
            pr = int(row.get("pr_number") or 0)
        except (ValueError, TypeError):
            pr = 0
        reason = None
        if pr and not _pr_open(repo, pat, pr):
            reason = "pr-closed"
        elif _is_idle(row):
            reason = f"idle>{IDLE_DAYS}d"
        elif slug in tag_slugs and slug not in rows:
            # AWS resources with no DDB row - reap (likely failed up-job)
            reason = "orphaned-aws"
        if reason:
            teardown_targets.append((slug, reason))

    triggered = 0
    for slug, reason in teardown_targets:
        logger.info("reaping %s: %s", slug, reason)
        if _trigger_teardown(repo, pat, slug):
            triggered += 1

    return {
        "ok": True,
        "slugs_seen": len(all_slugs),
        "teardown_targets": [{"slug": s, "reason": r} for s, r in teardown_targets],
        "triggered": triggered,
    }
