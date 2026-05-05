"""
Gmail integration — OAuth, encrypted-token storage, message sync, and
LLM-classified status suggestions for application tracking.

Design notes
------------
- Uses Google's OAuth 2.0 web flow with the readonly Gmail scope.
- Refresh tokens are encrypted at rest (Fernet); the encryption key comes
  from `GMAIL_TOKEN_ENCRYPTION_KEY` (SSM/env). Access tokens are never
  persisted — they are minted on demand from the refresh token.
- Sync is incremental: we remember `last_history_id` per user so we only
  process new messages on each run. Falls back to a date-bounded list
  query on first sync.
- Classification is delegated to Gemini Flash with a strict JSON schema.
  High-confidence results auto-apply; lower-confidence ones land in a
  per-user "suggestions" inbox the user reviews from the UI.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests

from utils.config import _get_config_value
from utils.db_connect import DBConnect

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# OAuth + Gmail constants
# ---------------------------------------------------------------------------
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "email",
]

# Confidence at/above which we auto-apply a status change vs. surface a suggestion.
AUTO_APPLY_CONFIDENCE = 0.85

# Cap how many messages we look at per sync. Bumped along with the 60-day
# lookback so a freshly-linked inbox gets enough headroom to scan two months
# of recruiter mail in one pass.
MAX_MESSAGES_PER_SYNC = 250

# Connection age beyond which we ignore older messages on the very first sync.
# 60d covers the typical "applied → first-round → final-round → outcome" arc
# so users see status backfill even on records they applied to weeks ago.
INITIAL_LOOKBACK_DAYS = 60


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _client_id() -> str:
    return _get_config_value("GOOGLE_OAUTH_CLIENT_ID", "")


def _client_secret() -> str:
    return _get_config_value("GOOGLE_OAUTH_CLIENT_SECRET", "")


def _redirect_uri() -> str:
    return _get_config_value("GOOGLE_OAUTH_REDIRECT_URI", "")


def _encryption_key() -> bytes:
    """Return a Fernet-compatible key derived from the configured secret.

    Accepts either a raw 32-byte urlsafe-base64 Fernet key or any string
    (we hash it to 32 bytes and base64-urlsafe-encode). This makes local
    setup as simple as `export GMAIL_TOKEN_ENCRYPTION_KEY=anything-secret`.
    """
    raw = _get_config_value("GMAIL_TOKEN_ENCRYPTION_KEY", "")
    if not raw:
        raise RuntimeError("GMAIL_TOKEN_ENCRYPTION_KEY is not configured")
    if len(raw) == 44 and raw.endswith("="):
        return raw.encode("utf-8")
    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet():
    from cryptography.fernet import Fernet  # lazy import — only loaded for Gmail flows
    return Fernet(_encryption_key())


def gmail_configured() -> bool:
    """True if the deployment has the credentials needed to run the OAuth flow."""
    return bool(_client_id() and _client_secret() and _redirect_uri())


# ---------------------------------------------------------------------------
# Mongo collections (created on first use)
# ---------------------------------------------------------------------------

def _connections():
    return DBConnect().get_db().gmail_connections


def _suggestions():
    return DBConnect().get_db().gmail_suggestions


def _oauth_states():
    return DBConnect().get_db().gmail_oauth_states


# ---------------------------------------------------------------------------
# OAuth flow
# ---------------------------------------------------------------------------

def build_auth_url(user_email: str) -> str:
    """Generate a Google authorization URL bound to a one-time state token.

    State is stored server-side so the callback can validate it without
    trusting the client. State auto-expires after 10 minutes.
    """
    state = secrets.token_urlsafe(24)
    _oauth_states().insert_one({
        "state": state,
        "user_email": user_email,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",  # ensure refresh_token is returned even on re-link
        "state": state,
    }
    from urllib.parse import urlencode
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def consume_state(state: str) -> Optional[str]:
    """Validate and burn a one-time OAuth state. Returns the user_email it was issued to."""
    if not state:
        return None
    doc = _oauth_states().find_one_and_delete({"state": state})
    if not doc:
        return None
    if doc.get("expires_at") and doc["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    return doc.get("user_email")


def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "redirect_uri": _redirect_uri(),
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        logger.warning("Google token exchange failed: %s %s", resp.status_code, resp.text[:300])
        raise RuntimeError("Failed to exchange Google authorization code")
    return resp.json()


def refresh_access_token(refresh_token: str) -> str:
    resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "refresh_token": refresh_token,
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        logger.warning("Google refresh failed: %s %s", resp.status_code, resp.text[:300])
        raise RuntimeError("Failed to refresh Gmail access token")
    return resp.json().get("access_token")


def revoke_refresh_token(refresh_token: str) -> None:
    try:
        requests.post(GOOGLE_REVOKE_URL, data={"token": refresh_token}, timeout=10)
    except Exception:
        # Revoke is best-effort; we still drop our local copy regardless.
        pass


# ---------------------------------------------------------------------------
# Connection management
# ---------------------------------------------------------------------------

def _userinfo(access_token: str) -> Dict[str, Any]:
    resp = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if resp.status_code != 200:
        return {}
    return resp.json()


def store_connection(user_email: str, token_payload: Dict[str, Any]) -> Dict[str, Any]:
    refresh = token_payload.get("refresh_token")
    if not refresh:
        # Google won't return a refresh_token if the user previously consented
        # and we didn't pass prompt=consent. We always pass prompt=consent, so
        # the only way to land here is a misconfiguration.
        raise RuntimeError("Google did not return a refresh_token. Re-link from a fresh consent screen.")
    access = token_payload.get("access_token") or ""
    info = _userinfo(access) if access else {}
    gmail_address = info.get("email") or ""

    encrypted = _fernet().encrypt(refresh.encode("utf-8")).decode("utf-8")
    doc = {
        "user_email": user_email,
        "gmail_address": gmail_address,
        "refresh_token_enc": encrypted,
        "scopes": token_payload.get("scope", "").split(),
        "linked_at": datetime.now(timezone.utc),
        "last_synced_at": None,
        "last_history_id": None,
    }
    _connections().update_one(
        {"user_email": user_email},
        {"$set": doc},
        upsert=True,
    )
    return {"gmail_address": gmail_address, "linked_at": doc["linked_at"].isoformat()}


def get_connection(user_email: str) -> Optional[Dict[str, Any]]:
    return _connections().find_one({"user_email": user_email})


def disconnect(user_email: str) -> bool:
    doc = _connections().find_one_and_delete({"user_email": user_email})
    if not doc:
        return False
    enc = doc.get("refresh_token_enc")
    if enc:
        try:
            refresh = _fernet().decrypt(enc.encode("utf-8")).decode("utf-8")
            revoke_refresh_token(refresh)
        except Exception:
            pass
    # Drop pending suggestions too — they're meaningless without a connection.
    _suggestions().delete_many({"user_email": user_email, "applied": False, "dismissed": False})
    return True


def _get_access_token(user_email: str) -> Tuple[str, Dict[str, Any]]:
    conn = get_connection(user_email)
    if not conn:
        raise RuntimeError("Gmail is not connected")
    refresh = _fernet().decrypt(conn["refresh_token_enc"].encode("utf-8")).decode("utf-8")
    access = refresh_access_token(refresh)
    return access, conn


# ---------------------------------------------------------------------------
# Gmail API helpers
# ---------------------------------------------------------------------------

class GmailAPIError(RuntimeError):
    """Raised when a Gmail API call returns a non-200 we don't want to swallow."""
    def __init__(self, status: int, body: str):
        self.status = status
        self.body = body
        super().__init__(f"Gmail API returned {status}: {body[:200]}")


def _gmail_get(path: str, access_token: str, params: Optional[Dict[str, Any]] = None, raise_on_error: bool = False) -> Dict[str, Any]:
    resp = requests.get(
        f"{GMAIL_API_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params or {},
        timeout=15,
    )
    if resp.status_code == 429:
        time.sleep(1.5)
        resp = requests.get(
            f"{GMAIL_API_BASE}{path}",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params or {},
            timeout=15,
        )
    if resp.status_code != 200:
        logger.warning("Gmail API %s failed: %s %s", path, resp.status_code, resp.text[:300])
        if raise_on_error:
            raise GmailAPIError(resp.status_code, resp.text)
        return {}
    return resp.json()


def _list_message_ids(access_token: str, query: str, max_results: int) -> List[str]:
    ids: List[str] = []
    page_token: Optional[str] = None
    while len(ids) < max_results:
        params: Dict[str, Any] = {"q": query, "maxResults": min(100, max_results - len(ids))}
        if page_token:
            params["pageToken"] = page_token
        # raise_on_error=True so a transient 4xx/5xx surfaces as an exception in
        # sync_user — otherwise we'd swallow the failure and poison last_synced_at.
        body = _gmail_get("/users/me/messages", access_token, params=params, raise_on_error=True)
        for m in body.get("messages") or []:
            if m.get("id"):
                ids.append(m["id"])
        page_token = body.get("nextPageToken")
        if not page_token:
            break
    return ids


def _b64url_decode(data: str) -> str:
    if not data:
        return ""
    pad = "=" * (-len(data) % 4)
    try:
        return base64.urlsafe_b64decode(data + pad).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_body_text(payload: Dict[str, Any]) -> str:
    """Walk a Gmail payload tree and concatenate text/plain (preferred) or text/html parts."""
    if not payload:
        return ""
    out: List[str] = []
    plain: List[str] = []
    html: List[str] = []

    def walk(part: Dict[str, Any]) -> None:
        mime = part.get("mimeType", "")
        body = part.get("body") or {}
        data = body.get("data")
        if mime == "text/plain" and data:
            plain.append(_b64url_decode(data))
        elif mime == "text/html" and data:
            html.append(_b64url_decode(data))
        for sub in part.get("parts") or []:
            walk(sub)

    walk(payload)
    out.extend(plain or html)
    text = "\n".join(out)
    if not plain and html:
        text = re.sub(r"<[^>]+>", " ", text)  # strip HTML tags
    text = re.sub(r"\s+", " ", text).strip()
    return text[:4000]  # plenty for the classifier; keeps token budget tight


def _headers_dict(headers: Iterable[Dict[str, str]]) -> Dict[str, str]:
    return {h.get("name", "").lower(): h.get("value", "") for h in headers or []}


def _parse_email_address(value: str) -> Tuple[str, str]:
    """Parse 'Recruiter Name <r@co.com>' → ('Recruiter Name', 'r@co.com')."""
    if not value:
        return "", ""
    m = re.match(r"^\s*(.*?)\s*<([^>]+)>\s*$", value)
    if m:
        return m.group(1).strip().strip('"'), m.group(2).strip().lower()
    return "", value.strip().lower()


def fetch_recent_messages(user_email: str, since: Optional[datetime]) -> List[Dict[str, Any]]:
    """Return a list of normalized message dicts since the given datetime."""
    access, _conn = _get_access_token(user_email)
    if since is None:
        since = datetime.now(timezone.utc) - timedelta(days=INITIAL_LOOKBACK_DAYS)
    # Gmail accepts unix-seconds for `after:` queries.
    after_epoch = int(since.timestamp())
    query = f"in:anywhere after:{after_epoch} -category:promotions -category:social"
    ids = _list_message_ids(access, query, MAX_MESSAGES_PER_SYNC)
    out: List[Dict[str, Any]] = []
    for mid in ids:
        full = _gmail_get(f"/users/me/messages/{mid}", access, params={"format": "full"})
        if not full:
            continue
        payload = full.get("payload") or {}
        headers = _headers_dict(payload.get("headers") or [])
        from_name, from_addr = _parse_email_address(headers.get("from", ""))
        subject = headers.get("subject", "")
        date_hdr = headers.get("date", "")
        snippet = full.get("snippet", "") or ""
        body = _extract_body_text(payload)
        out.append({
            "message_id": mid,
            "thread_id": full.get("threadId"),
            "from_name": from_name,
            "from_address": from_addr,
            "from_domain": from_addr.split("@")[-1] if "@" in from_addr else "",
            "subject": subject,
            "date": date_hdr,
            "internal_date": int(full.get("internalDate") or 0),
            "snippet": snippet,
            "body": body,
        })
    return out


# ---------------------------------------------------------------------------
# Matching: link a message to one of the user's tailoring records
# ---------------------------------------------------------------------------

_STATUS_KEYWORDS = {
    "rejected": [
        "we regret", "unfortunately", "not be moving forward", "decided not to move forward",
        "other candidates", "will not be progressing", "we have decided to move forward with other",
        "no longer under consideration", "did not select",
    ],
    "interviewing": [
        "schedule", "interview", "phone screen", "next round", "would you be available",
        "calendly", "available to meet", "looking forward to speaking", "panel interview",
        "technical screen", "coding interview", "onsite",
    ],
    "applied": [
        "thank you for applying", "we received your application", "your application has been received",
        "application submitted", "thanks for your interest",
    ],
    "offer": [
        "pleased to offer", "offer of employment", "we'd like to offer", "we are excited to extend",
        "offer letter",
    ],
}


def _normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower())


def _company_token(company: str) -> str:
    """Reduce a company string to a short matching token (drops Inc/LLC/etc.)."""
    if not company or company == "Not specified":
        return ""
    s = _normalize(company)
    for stop in (" inc", " llc", " corp", " corporation", " ltd", " limited", " co", " gmbh"):
        if s.endswith(stop):
            s = s[: -len(stop)]
    return s.strip().split()[0] if s.strip() else ""


def _build_record_index(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    index = []
    for r in records:
        jd = r.get("jd_analysis") or {}
        app = r.get("application") or {}
        company = jd.get("company") or ""
        title = jd.get("job_title") or ""
        recruiter_email = (app.get("recruiter_email") or "").lower()
        recruiter_domain = recruiter_email.split("@")[-1] if "@" in recruiter_email else ""
        index.append({
            "record_id": r.get("record_id"),
            "company": company,
            "company_token": _company_token(company),
            "title": title,
            "title_norm": _normalize(title),
            "recruiter_email": recruiter_email,
            "recruiter_domain": recruiter_domain,
            "current_status": app.get("status") or "draft",
        })
    return index


def _match_message_to_record(msg: Dict[str, Any], index: List[Dict[str, Any]]) -> Optional[Tuple[Dict[str, Any], float, str]]:
    """Pick the best record candidate for this email. Returns (record_meta, score, reason).

    Scoring is intentionally simple — the LLM does the nuanced part. Here we just
    pick a viable candidate so we don't waste classifier calls on noise.
    """
    if not index:
        return None
    haystack = _normalize(f"{msg.get('subject','')} {msg.get('snippet','')} {msg.get('from_name','')} {msg.get('from_address','')}")
    sender_domain = (msg.get("from_domain") or "").lower()
    sender_addr = (msg.get("from_address") or "").lower()

    best: Optional[Tuple[Dict[str, Any], float, str]] = None
    for rec in index:
        score = 0.0
        reasons: List[str] = []

        if rec["recruiter_email"] and rec["recruiter_email"] == sender_addr:
            score += 0.6
            reasons.append("recruiter email matches sender")
        elif rec["recruiter_domain"] and sender_domain and rec["recruiter_domain"] == sender_domain:
            score += 0.4
            reasons.append("recruiter domain matches sender")

        if rec["company_token"] and len(rec["company_token"]) >= 3:
            if rec["company_token"] in haystack:
                score += 0.35
                reasons.append(f"company name '{rec['company_token']}' present")
            if sender_domain and rec["company_token"] in sender_domain:
                score += 0.25
                reasons.append("company present in sender domain")

        if rec["title_norm"]:
            title_words = [w for w in rec["title_norm"].split() if len(w) >= 4]
            hits = sum(1 for w in title_words if w in haystack)
            if title_words:
                ratio = hits / len(title_words)
                if ratio >= 0.5:
                    score += 0.2 * ratio
                    reasons.append(f"job title overlap {hits}/{len(title_words)}")

        if score > 0 and (best is None or score > best[1]):
            best = (rec, score, "; ".join(reasons))
    if best and best[1] >= 0.4:
        return best
    return None


# ---------------------------------------------------------------------------
# Classification (LLM)
# ---------------------------------------------------------------------------

VALID_STATUSES = {"applied", "interviewing", "offer", "rejected", "ghosted", "withdrawn"}


def _heuristic_status(msg: Dict[str, Any]) -> Tuple[Optional[str], float]:
    """Quick keyword pass — if nothing matches we still call the LLM."""
    text = (msg.get("subject", "") + " " + msg.get("snippet", "") + " " + msg.get("body", "")).lower()
    for status, phrases in _STATUS_KEYWORDS.items():
        for phrase in phrases:
            if phrase in text:
                return status, 0.7
    return None, 0.0


def classify_message(msg: Dict[str, Any], record_meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Classify an email → {status, confidence, reason}.

    Uses keyword heuristics + Gemini Flash. Returns None on failure.
    """
    heur_status, heur_conf = _heuristic_status(msg)

    prompt = f"""You are classifying a recruiting email to update a job application tracker.

The user is tracking this application:
- Company: {record_meta.get('company') or 'unknown'}
- Role: {record_meta.get('title') or 'unknown'}
- Current tracker status: {record_meta.get('current_status')}

The email:
From: {msg.get('from_name', '')} <{msg.get('from_address', '')}>
Subject: {msg.get('subject', '')}
Snippet: {msg.get('snippet', '')}
Body (truncated):
{(msg.get('body') or '')[:1500]}

Decide which application status best fits this email. Statuses:
- applied        → confirmation that the user's application was received
- interviewing   → recruiter wants to schedule, confirms a time, sends prep, advances to next round
- offer          → an offer is being extended
- rejected       → the user is no longer being considered
- ignore         → the email is unrelated, marketing, a job alert, an automated digest, etc.

Output strict JSON: {{"status": "...", "confidence": 0.0-1.0, "reason": "one short sentence"}}.
Confidence should reflect how unambiguous the email is. If status is "ignore", confidence reflects how sure you are it should be ignored.
"""

    try:
        from services.gemini_client import gemini_json, GEMINI_FLASH
        result = gemini_json(
            prompt=prompt,
            max_tokens=200,
            temperature=0.0,
            model=GEMINI_FLASH,
            max_retries=1,
        )
    except Exception as e:
        logger.warning("Gmail classifier LLM call failed: %s", e)
        if heur_status:
            return {"status": heur_status, "confidence": heur_conf, "reason": "keyword heuristic"}
        return None

    status = (result.get("status") or "").lower()
    confidence = float(result.get("confidence") or 0.0)
    reason = (result.get("reason") or "")[:240]

    if status == "ignore":
        return {"status": "ignore", "confidence": confidence, "reason": reason}
    if status not in VALID_STATUSES:
        return None

    # If both heuristic and LLM agree, nudge confidence up slightly.
    if heur_status == status:
        confidence = min(1.0, confidence + 0.1)

    return {"status": status, "confidence": confidence, "reason": reason}


# ---------------------------------------------------------------------------
# Sync orchestrator
# ---------------------------------------------------------------------------

def _records_for_user(user_email: str) -> List[Dict[str, Any]]:
    db = DBConnect().get_db()
    cursor = db.tailoring_records.find(
        {"user_email": user_email},
        {
            "record_id": 1,
            "jd_analysis.job_title": 1,
            "jd_analysis.company": 1,
            "application.status": 1,
            "application.recruiter_email": 1,
            "_id": 0,
        },
    )
    return list(cursor)


def _apply_status(user_email: str, record_id: str, status: str) -> bool:
    """Persist a status change directly. Mirrors the PATCH /application logic minimally."""
    if status not in VALID_STATUSES:
        return False
    db = DBConnect().get_db()
    updates: Dict[str, Any] = {
        "application.status": status,
        "application.updated_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    if status == "applied":
        updates.setdefault("application.applied_at", datetime.utcnow())
    res = db.tailoring_records.update_one(
        {"record_id": record_id, "user_email": user_email},
        {"$set": updates},
    )
    return bool(res.matched_count)


def sync_user(user_email: str, force: bool = False) -> Dict[str, Any]:
    """Pull recent Gmail, match to records, classify, and write applies/suggestions.

    Args:
        user_email: identity of the linked user.
        force: when True, ignore last_synced_at and re-scan the full
               INITIAL_LOOKBACK_DAYS window. Used by the UI's "rescan" path
               to recover after a misconfiguration window or bring older
               applications up to date.

    Returns a summary dict for the API response.
    """
    conn = get_connection(user_email)
    if not conn:
        raise RuntimeError("Gmail is not connected")

    records = _records_for_user(user_email)
    index = _build_record_index(records)
    if not index:
        _connections().update_one(
            {"user_email": user_email},
            {"$set": {"last_synced_at": datetime.now(timezone.utc)}},
        )
        return {"messages_scanned": 0, "auto_applied": 0, "suggested": 0, "ignored": 0}

    since = None if force else conn.get("last_synced_at")
    if isinstance(since, datetime) and since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    try:
        messages = fetch_recent_messages(user_email, since)
    except GmailAPIError as e:
        # Don't poison last_synced_at — caller (route) can show a user-facing
        # error and the next sync will retry the same window.
        logger.warning("[gmail-sync] fetch_failed user=%s status=%s", user_email, e.status)
        raise RuntimeError(f"Gmail API error ({e.status}). Check that the Gmail API is enabled and the OAuth scope is granted.") from e

    auto_applied = 0
    suggested = 0
    ignored = 0
    skipped_already_seen = 0
    skipped_no_match = 0
    skipped_already_in_status = 0
    seen_message_ids = set()

    logger.info(
        "[gmail-sync] user=%s records=%d messages_fetched=%d since=%s",
        user_email, len(index), len(messages), since.isoformat() if since else "initial",
    )

    for msg in messages:
        mid = msg["message_id"]
        if mid in seen_message_ids:
            continue
        seen_message_ids.add(mid)

        # Skip messages we already classified for this user.
        if _suggestions().find_one({"user_email": user_email, "gmail_message_id": mid}, {"_id": 1}):
            skipped_already_seen += 1
            continue

        match = _match_message_to_record(msg, index)
        if not match:
            skipped_no_match += 1
            ignored += 1
            logger.info(
                "[gmail-sync] no_match subject=%r from=%s",
                (msg.get("subject") or "")[:80], msg.get("from_address"),
            )
            continue
        record_meta, match_score, match_reason = match
        logger.info(
            "[gmail-sync] matched subject=%r → record=%s score=%.2f reason=%s",
            (msg.get("subject") or "")[:80], record_meta.get("record_id"), match_score, match_reason,
        )

        cls = classify_message(msg, record_meta)
        if not cls:
            ignored += 1
            logger.info("[gmail-sync] classifier_failed message=%s", mid)
            continue
        if cls["status"] == "ignore":
            ignored += 1
            logger.info(
                "[gmail-sync] classified=ignore subject=%r reason=%s",
                (msg.get("subject") or "")[:80], cls.get("reason"),
            )
            continue

        new_status = cls["status"]
        confidence = cls["confidence"]
        # Skip if already in this status.
        if record_meta["current_status"] == new_status:
            skipped_already_in_status += 1
            logger.info(
                "[gmail-sync] already_in_status record=%s status=%s",
                record_meta.get("record_id"), new_status,
            )
            continue

        suggestion = {
            "suggestion_id": str(uuid.uuid4()),
            "user_email": user_email,
            "record_id": record_meta["record_id"],
            "company": record_meta["company"],
            "title": record_meta["title"],
            "gmail_message_id": mid,
            "gmail_thread_id": msg.get("thread_id"),
            "from_name": msg.get("from_name"),
            "from_address": msg.get("from_address"),
            "subject": msg.get("subject"),
            "snippet": msg.get("snippet"),
            "current_status": record_meta["current_status"],
            "suggested_status": new_status,
            "confidence": confidence,
            "reason": cls.get("reason", ""),
            "applied": False,
            "dismissed": False,
            "auto_applied": False,
            "created_at": datetime.now(timezone.utc),
        }

        if confidence >= AUTO_APPLY_CONFIDENCE and _apply_status(user_email, record_meta["record_id"], new_status):
            suggestion["applied"] = True
            suggestion["auto_applied"] = True
            suggestion["applied_at"] = datetime.now(timezone.utc)
            # Update in-memory index so subsequent messages in the same sync don't re-suggest.
            record_meta["current_status"] = new_status
            auto_applied += 1
        else:
            suggested += 1

        _suggestions().insert_one(suggestion)

    _connections().update_one(
        {"user_email": user_email},
        {"$set": {"last_synced_at": datetime.now(timezone.utc)}},
    )

    logger.info(
        "[gmail-sync] done user=%s scanned=%d auto=%d suggest=%d ignored=%d "
        "skipped_seen=%d skipped_nomatch=%d skipped_same_status=%d",
        user_email, len(messages), auto_applied, suggested, ignored,
        skipped_already_seen, skipped_no_match, skipped_already_in_status,
    )

    return {
        "messages_scanned": len(messages),
        "auto_applied": auto_applied,
        "suggested": suggested,
        "ignored": ignored,
        "skipped_already_seen": skipped_already_seen,
        "skipped_no_match": skipped_no_match,
        "skipped_already_in_status": skipped_already_in_status,
    }


# ---------------------------------------------------------------------------
# Suggestion CRUD (used by the blueprint)
# ---------------------------------------------------------------------------

def _serialize_suggestion(s: Dict[str, Any]) -> Dict[str, Any]:
    s.pop("_id", None)
    for k in ("created_at", "applied_at"):
        v = s.get(k)
        if hasattr(v, "isoformat"):
            s[k] = v.isoformat()
    return s


def list_suggestions(user_email: str, include_resolved: bool = False) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {"user_email": user_email}
    if not include_resolved:
        q["applied"] = False
        q["dismissed"] = False
    docs = list(_suggestions().find(q).sort("created_at", -1).limit(100))
    return [_serialize_suggestion(d) for d in docs]


def apply_suggestion(user_email: str, suggestion_id: str) -> Dict[str, Any]:
    s = _suggestions().find_one({"suggestion_id": suggestion_id, "user_email": user_email})
    if not s:
        raise LookupError("Suggestion not found")
    if s.get("applied") or s.get("dismissed"):
        return _serialize_suggestion(s)
    if not _apply_status(user_email, s["record_id"], s["suggested_status"]):
        raise RuntimeError("Failed to apply status — record may have been deleted")
    _suggestions().update_one(
        {"suggestion_id": suggestion_id},
        {"$set": {"applied": True, "applied_at": datetime.now(timezone.utc)}},
    )
    s["applied"] = True
    s["applied_at"] = datetime.now(timezone.utc)
    return _serialize_suggestion(s)


def dismiss_suggestion(user_email: str, suggestion_id: str) -> bool:
    res = _suggestions().update_one(
        {"suggestion_id": suggestion_id, "user_email": user_email, "applied": False},
        {"$set": {"dismissed": True, "dismissed_at": datetime.now(timezone.utc)}},
    )
    return bool(res.matched_count)
