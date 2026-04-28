"""
Streak service — tracks daily resume-application streaks.

One "application" = one tailoring_record (the unit of work users send to a job
posting outside our app). Edits/regenerations of the same record are NOT
counted as separate applications — increments only fire on initial record
creation.

Storage: a single document per user in `parse_streaks`:

    {
      user_email: str,                       # unique
      current_streak: int,                   # days in a row ending at last_date
      longest_streak: int,
      last_application_date: "YYYY-MM-DD",   # UTC date of most recent application
      total_applications: int,
      daily_counts: { "YYYY-MM-DD": int },   # trimmed to last 90 days
      updated_at: datetime,
    }

Dates are computed in UTC. A future improvement could carry the user's
timezone, but UTC keeps the model self-contained for now.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from utils.db_connect import DBConnect

logger = logging.getLogger(__name__)

_HISTORY_DAYS = 90
_HEATMAP_DAYS = 30


def _collection():
    return DBConnect().get_db().parse_streaks


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _date_key(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


def _trim_history(daily_counts: Dict[str, int]) -> Dict[str, int]:
    cutoff = _date_key(datetime.now(timezone.utc) - timedelta(days=_HISTORY_DAYS))
    return {k: v for k, v in daily_counts.items() if k >= cutoff}


def record_application(user_email: str) -> Dict[str, Any]:
    """Increment the streak for a new application (new tailoring_record)."""
    if not user_email:
        return {}

    today = _today()
    yesterday = _date_key(datetime.now(timezone.utc) - timedelta(days=1))
    col = _collection()

    doc = col.find_one({"user_email": user_email}) or {}
    last_date = doc.get("last_application_date")
    current_streak = int(doc.get("current_streak") or 0)
    longest_streak = int(doc.get("longest_streak") or 0)
    total = int(doc.get("total_applications") or 0)
    daily_counts = dict(doc.get("daily_counts") or {})

    if last_date == today:
        # Same day — count goes up, streak unchanged.
        pass
    elif last_date == yesterday:
        current_streak += 1
    else:
        current_streak = 1

    daily_counts[today] = int(daily_counts.get(today, 0)) + 1
    total += 1
    longest_streak = max(longest_streak, current_streak)
    daily_counts = _trim_history(daily_counts)

    update = {
        "user_email": user_email,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_application_date": today,
        "total_applications": total,
        "daily_counts": daily_counts,
        "updated_at": datetime.now(timezone.utc),
    }
    col.update_one({"user_email": user_email}, {"$set": update}, upsert=True)
    return _serialize(update)


def get_streak(user_email: str) -> Dict[str, Any]:
    """Return streak summary + last-30-day heatmap for the user."""
    if not user_email:
        return _empty_summary()

    doc = _collection().find_one({"user_email": user_email})
    if not doc:
        return _empty_summary()

    return _serialize(doc)


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    today = _today()
    yesterday = _date_key(datetime.now(timezone.utc) - timedelta(days=1))
    last_date = doc.get("last_application_date")
    stored_streak = int(doc.get("current_streak") or 0)

    # Streak is "alive" only if the last application was today or yesterday.
    if last_date in (today, yesterday):
        current_streak = stored_streak
    else:
        current_streak = 0

    daily_counts = dict(doc.get("daily_counts") or {})
    today_count = int(daily_counts.get(today, 0))
    longest = int(doc.get("longest_streak") or 0)
    total = int(doc.get("total_applications") or 0)

    return {
        "current_streak": current_streak,
        "longest_streak": longest,
        "today_count": today_count,
        "total_applications": total,
        "last_application_date": last_date,
        "heatmap": _build_heatmap(daily_counts),
    }


def _build_heatmap(daily_counts: Dict[str, int]) -> List[Dict[str, Any]]:
    today_dt = datetime.now(timezone.utc)
    out: List[Dict[str, Any]] = []
    for offset in range(_HEATMAP_DAYS - 1, -1, -1):
        d = today_dt - timedelta(days=offset)
        key = _date_key(d)
        out.append({"date": key, "count": int(daily_counts.get(key, 0))})
    return out


def _empty_summary() -> Dict[str, Any]:
    return {
        "current_streak": 0,
        "longest_streak": 0,
        "today_count": 0,
        "total_applications": 0,
        "last_application_date": None,
        "heatmap": _build_heatmap({}),
    }
