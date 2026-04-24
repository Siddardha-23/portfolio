"""
Cloud Diary tools — owned by the Builder specialist.

`get_cloud_diary()` returns the persisted weekly engineering summaries.
The producer (`cloud_diary.generate_diary_entry`) runs out-of-band on a
schedule (EventBridge → Lambda) and writes into MongoDB.
"""
from __future__ import annotations

import logging
from typing import Dict

logger = logging.getLogger(__name__)


def _collection():
    from utils.db_connect import DBConnect
    return DBConnect().get_collection("cloud_diary")


def get_cloud_diary(limit: int = 5) -> Dict:
    """Return the most recent Cloud Diary entries (newest first)."""
    limit = max(1, min(int(limit or 5), 20))
    try:
        coll = _collection()
        cursor = coll.find({}, {"_id": 0}).sort("date", -1).limit(limit)
        entries = list(cursor)
    except Exception as exc:
        logger.warning("Cloud Diary read failed: %s", exc)
        return {
            "ok": False,
            "error": "Cloud Diary is temporarily unavailable.",
            "data": {"entries": []},
        }
    return {"ok": True, "data": {"entries": entries, "count": len(entries)}}


def get_latest_diary() -> Dict:
    """Convenience read for the 'Now Building' ticker — single newest entry."""
    result = get_cloud_diary(limit=1)
    if not result.get("ok"):
        return result
    entries = result["data"]["entries"]
    return {"ok": True, "data": entries[0] if entries else None}
