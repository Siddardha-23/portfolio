"""
Concierge tools — owned by the Concierge specialist.

These persist recruiter-initiated intros into MongoDB (`intro_requests`
collection) so Harshith can pick them up. An optional email hook could be
wired later — kept as a write-to-DB to avoid exposing SES to the agent.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Dict

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _collection():
    from utils.db_connect import DBConnect
    return DBConnect().get_collection("intro_requests")


def book_chat(
    recruiter_email: str,
    context: str,
    preferred_time: str = "",
    company: str = "",
) -> Dict:
    """Record an interview / intro request from a recruiter.

    Args:
        recruiter_email: reply-to for Harshith.
        context: why they're reaching out / what the role is.
        preferred_time: optional free-text preferred slot.
        company: optional company name.
    """
    email = (recruiter_email or "").strip().lower()
    if not EMAIL_RE.match(email):
        return {"ok": False, "error": "A valid reply-to email is required."}
    if not context or len(context.strip()) < 10:
        return {"ok": False, "error": "A short note about the role / context is required (10+ chars)."}

    record = {
        "email": email,
        "context": context.strip()[:2000],
        "preferred_time": (preferred_time or "").strip()[:120],
        "company": (company or "").strip()[:160],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "agent:concierge",
    }
    try:
        _collection().insert_one(record.copy())
    except Exception as exc:
        logger.warning("Intro request persist failed: %s", exc)
        return {
            "ok": False,
            "error": "Couldn't record the request right now — email harshith.siddardha@gmail.com directly.",
        }

    return {
        "ok": True,
        "data": {
            "message": "Noted. Harshith will reach out within 24 hours.",
            "reply_to": email,
            "company": record["company"],
        },
    }


def compose_intro(role: str, highlights: str = "") -> Dict:
    """Draft a short intro note the recruiter can copy/paste or send via book_chat."""
    role_clean = (role or "").strip() or "the role"
    highlights_clean = (highlights or "").strip()

    body = (
        f"Hi Harshith,\n\nI came across your portfolio and your work on multi-agent AI and "
        f"AWS serverless architecture caught my attention. We have an opening for {role_clean} "
        f"and I think your background would be a strong match."
    )
    if highlights_clean:
        body += f" In particular, {highlights_clean}."
    body += "\n\nWould you have 15 minutes this week for a quick intro call?\n\nThanks,\n[Your name]"

    return {
        "ok": True,
        "data": {
            "subject": f"Quick intro — {role_clean}",
            "body": body,
            "to": "harshith.siddardha@gmail.com",
        },
    }
