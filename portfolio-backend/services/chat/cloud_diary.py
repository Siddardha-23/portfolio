"""
Cloud Diary — generates a short, recruiter-friendly summary of recent shipped work.

Runs daily as a Lambda invocation. Pulls public GitHub events for the last 48h,
groups them by repo, asks Gemini to write 1 punchy line per repo + a one-line
"theme of the week" headline, persists into MongoDB `cloud_diary`.

The agentic concierge reads from this collection via `get_cloud_diary` /
`get_latest_diary`. The "Now Building" ticker on the home page reads
`/api/chat/diary/latest`.

CLI usage:
    python -m cloud_diary           # generate today's entry
    python -m cloud_diary --backfill 7    # generate 7 days of history if missing
"""
from __future__ import annotations

import argparse
import json
import logging
import time
from collections import defaultdict
from typing import Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

GITHUB_USER = "Siddardha-23"
MODEL_NAME = "gemini-2.5-flash-lite"


DIARY_PROMPT = """You are writing one entry of Harshith's Cloud Diary — a tiny daily/weekly log shown on his portfolio so recruiters can see live engineering activity.

You will be given grouped GitHub events from the last {window_hours} hours. Produce a JSON object with these exact keys:

  date           — ISO date (YYYY-MM-DD) of this entry, today's date
  headline       — ONE punchy sentence (max 110 chars) that captures the theme of recent work
  highlights     — 2-4 bullet strings, each ONE short sentence summarizing what shipped per repo
  tech           — array of 3-6 technology / tool names that appeared (e.g. ["AWS Lambda", "Terraform", "Gemini"])
  shipping_score — integer 0-100 estimating activity intensity (commits + PRs merged)

Rules:
  • Translate commit messages into plain-English outcomes (not raw shas).
  • Skip noise (merge commits, dependency bumps unless they're a real upgrade).
  • Sound like a builder, not a marketing site. Specific over fluffy.
  • Output ONLY valid JSON, no surrounding prose.
"""


# ──────────────────────────────────────────────────────────────────────────
# GitHub fetch
# ──────────────────────────────────────────────────────────────────────────

def _gh_headers() -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "harshith-cloud-diary",
    }
    try:
        from utils.config import _get_config_value
        token = _get_config_value("GITHUB_PAT", "")
        if token:
            headers["Authorization"] = f"Bearer {token}"
    except Exception:
        pass
    return headers


def _fetch_events(window_hours: int) -> List[Dict]:
    try:
        resp = requests.get(
            f"https://api.github.com/users/{GITHUB_USER}/events/public",
            headers=_gh_headers(), timeout=6,
        )
        resp.raise_for_status()
        events = resp.json() or []
    except Exception as exc:
        logger.warning("Cloud Diary GitHub fetch failed: %s", exc)
        return []

    cutoff = time.time() - window_hours * 3600
    fresh = []
    for e in events:
        try:
            ts = time.mktime(time.strptime(e["created_at"], "%Y-%m-%dT%H:%M:%SZ"))
        except Exception:
            continue
        if ts < cutoff:
            continue
        fresh.append(e)
    return fresh


def _fetch_repo_commits(repo: str, since_iso: str, limit: int = 12) -> List[str]:
    """Fetch recent commit messages for a repo. Used because the user events
    feed returns PushEvents *without* commit details."""
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{repo}/commits",
            headers=_gh_headers(),
            params={"since": since_iso, "author": GITHUB_USER, "per_page": limit},
            timeout=5,
        )
        resp.raise_for_status()
        commits = resp.json() or []
    except Exception as exc:
        logger.warning("Cloud Diary commits fetch failed for %s: %s", repo, exc)
        return []
    messages = []
    for c in commits:
        msg = (((c.get("commit") or {}).get("message")) or "").split("\n")[0][:160]
        if msg and not msg.lower().startswith("merge "):
            messages.append(msg)
    return messages


def _group_by_repo(events: List[Dict], window_hours: int) -> Dict[str, List[str]]:
    grouped: Dict[str, List[str]] = defaultdict(list)
    push_repos: set = set()
    since_iso = time.strftime(
        "%Y-%m-%dT%H:%M:%SZ",
        time.gmtime(time.time() - window_hours * 3600),
    )

    for ev in events:
        repo = (ev.get("repo") or {}).get("name", "unknown")
        ev_type = ev.get("type", "")
        payload = ev.get("payload") or {}

        if ev_type == "PushEvent":
            # The user events feed strips commit details; we'll fetch them
            # per-repo below to keep API calls minimal (one per unique repo).
            push_repos.add(repo)
        elif ev_type == "PullRequestEvent":
            pr = payload.get("pull_request") or {}
            grouped[repo].append(
                f"PR {payload.get('action', '')}: {pr.get('title', '')[:140]}"
            )
        elif ev_type == "ReleaseEvent":
            release = payload.get("release") or {}
            grouped[repo].append(f"release {release.get('tag_name', '')}")
        elif ev_type == "CreateEvent":
            grouped[repo].append(
                f"created {payload.get('ref_type', '')} {payload.get('ref') or ''}".strip()
            )

    # Resolve push commit messages with one /repos/.../commits call per repo
    for repo in push_repos:
        for msg in _fetch_repo_commits(repo, since_iso):
            grouped[repo].append(f"commit: {msg}")

    return grouped


# ──────────────────────────────────────────────────────────────────────────
# Gemini summarization
# ──────────────────────────────────────────────────────────────────────────

def _summarize(grouped: Dict[str, List[str]], window_hours: int) -> Optional[Dict]:
    if not grouped:
        return None
    from services.llm_providers import get_provider

    bullets = []
    for repo, items in grouped.items():
        head = items[:8]
        bullets.append(f"### {repo}\n" + "\n".join(f"- {x}" for x in head))
    payload = "\n\n".join(bullets)

    # Append a JSON-only instruction to the prompt since the abstraction's
    # text() method doesn't expose response_mime_type — Claude / Gemini both
    # produce JSON reliably when asked plainly + parsed defensively below.
    payload_with_hint = payload + "\n\nReturn ONLY valid JSON, no markdown fences, no preamble."

    try:
        provider = get_provider()
        text = provider.text(
            prompt=payload_with_hint,
            system=DIARY_PROMPT.format(window_hours=window_hours),
            temperature=0.5,
            max_tokens=600,
        )
        if not text:
            return None
        # Strip markdown fences if the model wrapped the response.
        t = text.strip()
        if t.startswith("```"):
            import re as _re
            t = _re.sub(r"^```(?:json)?\s*\n?", "", t)
            t = _re.sub(r"\n?```\s*$", "", t)
        return json.loads(t)
    except Exception as exc:
        logger.warning("Diary summarization failed: %s", exc)
        return None


# ──────────────────────────────────────────────────────────────────────────
# Persistence
# ──────────────────────────────────────────────────────────────────────────

def _collection():
    from utils.db_connect import DBConnect
    return DBConnect().get_collection("cloud_diary")


def _persist(entry: Dict) -> bool:
    try:
        coll = _collection()
        # Always stamp with today's UTC date — Gemini sometimes hallucinates dates
        # in its JSON output. Treat its `date` field as advisory only.
        date_key = time.strftime("%Y-%m-%d", time.gmtime())
        entry["date"] = date_key
        entry["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        coll.update_one({"date": date_key}, {"$set": entry}, upsert=True)
        # Optional TTL via app logic — keep newest 60 entries
        try:
            stale = coll.find({}, {"_id": 1, "date": 1}).sort("date", -1).skip(60)
            ids_to_drop = [doc["_id"] for doc in stale]
            if ids_to_drop:
                coll.delete_many({"_id": {"$in": ids_to_drop}})
        except Exception:
            pass
        return True
    except Exception as exc:
        logger.warning("Cloud Diary persist failed: %s", exc)
        return False


# ──────────────────────────────────────────────────────────────────────────
# Public entry points
# ──────────────────────────────────────────────────────────────────────────

def generate_diary_entry(window_hours: int = 48) -> Optional[Dict]:
    """Generate + persist a single diary entry covering the last `window_hours`."""
    events = _fetch_events(window_hours)
    grouped = _group_by_repo(events, window_hours)
    if not grouped:
        logger.info("Cloud Diary: no qualifying events in last %dh", window_hours)
        return None
    entry = _summarize(grouped, window_hours)
    if not entry:
        return None
    _persist(entry)
    return entry


def lambda_handler(event=None, context=None):
    """EventBridge → Lambda entry point. Idempotent on (date)."""
    window = 48
    if isinstance(event, dict):
        try:
            window = int(event.get("window_hours") or window)
        except Exception:
            pass
    entry = generate_diary_entry(window_hours=window)
    return {
        "statusCode": 200 if entry else 204,
        "body": json.dumps({"generated": bool(entry), "entry": entry}, default=str),
    }


def _cli():
    parser = argparse.ArgumentParser(description="Generate the Cloud Diary entry.")
    parser.add_argument("--window-hours", type=int, default=48)
    args = parser.parse_args()
    entry = generate_diary_entry(window_hours=args.window_hours)
    print(json.dumps(entry, indent=2, default=str) if entry else "no entry generated")


if __name__ == "__main__":
    _cli()
