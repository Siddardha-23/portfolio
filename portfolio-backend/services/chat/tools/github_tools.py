"""
GitHub tools — owned by the Builder specialist.
Reads recent public activity to prove "this person is shipping right now."

Network calls are kept tight (3s timeout, single page) to fit Lambda's 29s
budget when chained with a Gemini round-trip. Results cached in-memory for
5 minutes to avoid hammering the GitHub API.
"""
from __future__ import annotations

import logging
import time
from typing import Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

GITHUB_USER = "Siddardha-23"
_CACHE: Dict[str, tuple[float, Dict]] = {}
_TTL = 300  # 5 minutes


def _gh_headers() -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "harshith-portfolio-agent",
    }
    try:
        from utils.config import _get_config_value
        token = _get_config_value("GITHUB_PAT", "")
        if token:
            headers["Authorization"] = f"Bearer {token}"
    except Exception:
        pass
    return headers


def _cached(key: str) -> Optional[Dict]:
    hit = _CACHE.get(key)
    if not hit:
        return None
    expires_at, value = hit
    if time.time() > expires_at:
        _CACHE.pop(key, None)
        return None
    return value


def _put_cache(key: str, value: Dict) -> None:
    _CACHE[key] = (time.time() + _TTL, value)


def _fetch_commits(repo: str, since_iso: str, per_page: int = 10) -> List[Dict]:
    """Fetch a repo's recent commits authored by GITHUB_USER. The user-events
    feed strips commit details, so we re-fetch per repo to get real messages."""
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{repo}/commits",
            headers=_gh_headers(),
            params={"since": since_iso, "author": GITHUB_USER, "per_page": per_page},
            timeout=4,
        )
        resp.raise_for_status()
        return resp.json() or []
    except Exception as exc:
        logger.warning("GitHub commits fetch failed for %s: %s", repo, exc)
        return []


def whats_new(days: int = 14, limit: int = 8) -> Dict:
    """Recent public commits across Harshith's GitHub repos.

    Strategy: use the user events feed to discover which repos the user
    touched in-window, then fetch real commit messages from
    /repos/{repo}/commits for each unique repo (the events feed itself
    has empty `commits` arrays for unauthenticated user-event reads).

    Results cached for 5 minutes (see _cached / _put_cache).

    Args:
        days: lookback window in days (1-60).
        limit: max events to return.
    """
    days = max(1, min(int(days or 14), 60))
    limit = max(1, min(int(limit or 8), 20))
    cache_key = f"whatsnew:{days}:{limit}"
    cached = _cached(cache_key)
    if cached is not None:
        return cached

    try:
        resp = requests.get(
            f"https://api.github.com/users/{GITHUB_USER}/events/public",
            headers=_gh_headers(),
            timeout=4,
        )
        resp.raise_for_status()
        events = resp.json() or []
    except Exception as exc:
        logger.warning("GitHub events fetch failed: %s", exc)
        return {
            "ok": False,
            "error": "GitHub activity is temporarily unavailable.",
            "data": {"items": []},
        }

    cutoff = time.time() - days * 86400
    since_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(cutoff))

    # Pass 1: collect non-push events directly + remember active repos for push pass
    items: List[Dict] = []
    push_repos_seen: List[str] = []  # ordered, dedup'd
    push_repos_set: set = set()
    for event in events:
        try:
            ts = time.mktime(time.strptime(event["created_at"], "%Y-%m-%dT%H:%M:%SZ"))
        except Exception:
            continue
        if ts < cutoff:
            continue
        repo = (event.get("repo") or {}).get("name", "")
        ev_type = event.get("type", "")
        payload = event.get("payload") or {}

        if ev_type == "PushEvent":
            if repo and repo not in push_repos_set:
                push_repos_set.add(repo)
                push_repos_seen.append(repo)
            continue

        if ev_type == "PullRequestEvent":
            pr = payload.get("pull_request") or {}
            message = f"PR {payload.get('action', '')}: {pr.get('title', '')[:120]}"
        elif ev_type == "CreateEvent":
            message = f"created {payload.get('ref_type', '')} {payload.get('ref') or ''}".strip()
        elif ev_type == "ReleaseEvent":
            release = payload.get("release") or {}
            message = f"released {release.get('tag_name', '')}"
        else:
            continue

        if not message:
            continue
        items.append({"repo": repo, "type": ev_type, "message": message, "at": event["created_at"]})

    # Pass 2: fetch real commit messages per active repo (one call per repo)
    for repo in push_repos_seen:
        for c in _fetch_commits(repo, since_iso, per_page=min(limit, 10)):
            commit = c.get("commit") or {}
            msg = ((commit.get("message") or "").split("\n")[0])[:140]
            if not msg or msg.lower().startswith("merge "):
                continue
            items.append({
                "repo": repo,
                "type": "PushEvent",
                "message": msg,
                "at": (commit.get("author") or {}).get("date") or c.get("commit", {}).get("committer", {}).get("date") or "",
            })

    # Sort by recency (descending) and truncate
    items.sort(key=lambda x: x.get("at") or "", reverse=True)
    items = items[:limit]

    payload = {
        "ok": True,
        "data": {
            "user": GITHUB_USER,
            "window_days": days,
            "items": items,
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }
    _put_cache(cache_key, payload)
    return payload


def repo_snapshot(limit: int = 6) -> Dict:
    """Recently-pushed public repos (a 'what am I building right now' read)."""
    limit = max(1, min(int(limit or 6), 12))
    cache_key = f"repos:{limit}"
    cached = _cached(cache_key)
    if cached is not None:
        return cached

    try:
        resp = requests.get(
            f"https://api.github.com/users/{GITHUB_USER}/repos",
            headers=_gh_headers(),
            params={"sort": "pushed", "per_page": limit},
            timeout=4,
        )
        resp.raise_for_status()
        repos = resp.json() or []
    except Exception as exc:
        logger.warning("GitHub repos fetch failed: %s", exc)
        return {
            "ok": False,
            "error": "GitHub repos are temporarily unavailable.",
            "data": {"items": []},
        }

    items = [
        {
            "name": r.get("name"),
            "description": r.get("description"),
            "language": r.get("language"),
            "stars": r.get("stargazers_count", 0),
            "pushed_at": r.get("pushed_at"),
            "url": r.get("html_url"),
        }
        for r in repos
        if not r.get("fork")
    ]
    payload = {"ok": True, "data": {"items": items[:limit]}}
    _put_cache(cache_key, payload)
    return payload
