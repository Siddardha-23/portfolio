"""
Daily reaper for stale ephemeral preview environments.

Runs once per day on a CloudWatch EventBridge schedule. Scans the
portfolio-ephemeral-envs DynamoDB table and triggers preview-down.yml via
GitHub workflow_dispatch for any environment that:
  1. Belongs to a PR that has been closed/merged, OR
  2. Has been idle (no last_seen_at update) for >= PREVIEW_IDLE_DAYS.

Required env vars:
  PREVIEW_DDB_TABLE       - DDB table name (set by terraform)
  PREVIEW_IDLE_DAYS       - integer, default 7 (set by terraform)
  SSM_PREVIEW_GITHUB_PAT  - SSM param name holding a GitHub PAT
  SSM_PREVIEW_GITHUB_REPO - SSM param name holding "owner/repo"

The PAT must have `actions:write` scope on the repo.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_AWS_REGION = os.getenv("AWS_REGION_NAME", "us-east-1")
_DDB_TABLE = os.environ["PREVIEW_DDB_TABLE"]
_IDLE_DAYS = int(os.getenv("PREVIEW_IDLE_DAYS", "7"))
_SSM_PAT = os.getenv("SSM_PREVIEW_GITHUB_PAT", "")
_SSM_REPO = os.getenv("SSM_PREVIEW_GITHUB_REPO", "")
_DOWN_WORKFLOW = "preview-down.yml"

_ddb = boto3.client("dynamodb", region_name=_AWS_REGION)
_ssm = boto3.client("ssm", region_name=_AWS_REGION)


def _ssm_get(name: str) -> str | None:
    if not name:
        return None
    try:
        return _ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]
    except Exception:
        logger.exception("SSM get failed for %s", name)
        return None


def _scan_envs() -> Iterable[dict[str, Any]]:
    paginator = _ddb.get_paginator("scan")
    for page in paginator.paginate(TableName=_DDB_TABLE):
        yield from page.get("Items", [])


def _is_idle(item: dict[str, Any]) -> bool:
    last_seen = item.get("last_seen_at", {}).get("S")
    if not last_seen:
        return True  # missing timestamp => treat as idle
    try:
        ts = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
    except ValueError:
        return True
    return datetime.now(timezone.utc) - ts > timedelta(days=_IDLE_DAYS)


def _pr_is_open(repo: str, pr_number: int, pat: str) -> bool | None:
    """Return True/False if PR exists; None if call failed (be conservative)."""
    if not pr_number:
        return None
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/pulls/{pr_number}",
        headers={
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "portfolio-preview-reaper",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data.get("state") == "open"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False  # PR not found -> not open
        logger.warning("GitHub API HTTP %s for PR #%s", e.code, pr_number)
        return None
    except Exception:
        logger.exception("GitHub API error for PR #%s", pr_number)
        return None


def _dispatch_teardown(repo: str, slug: str, pr_number: int, pat: str) -> bool:
    payload = json.dumps(
        {
            "ref": "main",
            "inputs": {"branch_slug": slug, "pr_number": str(pr_number)},
        }
    ).encode()
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/actions/workflows/{_DOWN_WORKFLOW}/dispatches",
        data=payload,
        headers={
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "portfolio-preview-reaper",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 204:
                logger.info("dispatched %s for slug=%s pr=%s", _DOWN_WORKFLOW, slug, pr_number)
                return True
            logger.warning("dispatch returned %s for slug=%s", resp.status, slug)
            return False
    except Exception:
        logger.exception("dispatch failed for slug=%s", slug)
        return False


def handler(event, context):
    pat = _ssm_get(_SSM_PAT)
    repo = _ssm_get(_SSM_REPO)
    if not pat or not repo:
        logger.error("Missing GitHub PAT or repo (SSM_PREVIEW_GITHUB_PAT/REPO not configured)")
        return {"ok": False, "reason": "missing-config"}

    reaped: list[str] = []
    skipped: list[str] = []
    for item in _scan_envs():
        slug = item.get("branch_slug", {}).get("S")
        if not slug:
            continue
        try:
            pr_number = int(item.get("pr_number", {}).get("N", "0"))
        except (ValueError, TypeError):
            pr_number = 0

        pr_state = _pr_is_open(repo, pr_number, pat) if pr_number else None
        idle = _is_idle(item)

        # Teardown if: PR is definitively closed/missing, OR (PR state unknown AND idle).
        should_teardown = pr_state is False or (pr_state is None and idle) or (pr_state is True and idle)
        if not should_teardown:
            skipped.append(slug)
            continue

        if _dispatch_teardown(repo, slug, pr_number, pat):
            reaped.append(slug)

    logger.info("reaped=%d skipped=%d", len(reaped), len(skipped))
    return {"ok": True, "reaped": reaped, "skipped": skipped}
