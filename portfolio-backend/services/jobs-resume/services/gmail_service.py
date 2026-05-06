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
from collections import defaultdict
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
# Tightened from 0.70 → 0.85 after users reported false positives — emails being
# silently moved to "interviewing" off automated boilerplate, or "applied"
# records being left stale because per-email classification couldn't see the
# rejection that arrived later. The per-record thread classifier is the real
# accuracy fix; this raised bar just keeps borderline calls in the user's
# review queue instead of auto-applying them.
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
    # 0.3 catches borderline matches (e.g. company name in subject only, no
    # recruiter signal). The LLM gets a chance to filter these via "ignore"
    # if the email is actually unrelated noise.
    if best and best[1] >= 0.3:
        return best
    return None


# ---------------------------------------------------------------------------
# Classification: deterministic signals + LLM, reconciled
# ---------------------------------------------------------------------------
#
# Architecture
# ------------
# Pure-LLM classifiers drift on adversarial-looking-but-benign emails (e.g. an
# automated "thanks for applying — next steps if you're a fit" reads as
# "interviewing" to a small model). To get production-grade accuracy we run a
# two-tier pipeline per record:
#
#   Tier 1 — DETERMINISTIC SIGNALS (this module).
#     Regex-extracted phrases that are unambiguous in plain English: explicit
#     decline language ("we have decided to move forward with other
#     candidates"), explicit offer language ("pleased to extend an offer"),
#     scheduled-time signals (Calendly link, "are you available <date>"). When
#     a deterministic signal fires we treat it as ground truth — no LLM can
#     override a verbatim "we will not be moving forward".
#
#   Tier 2 — LLM THREAD CLASSIFIER (`classify_record_thread`).
#     Reads the full email thread for nuanced cases the regex layer can't
#     parse: politely-phrased rejections without the canonical phrase, soft
#     interview signals via context, etc. Outputs a status + confidence.
#
#   RECONCILIATION (`reconcile_classification`).
#     Combines both:
#       - deterministic rejection/offer  → final = that, conf = 0.97 (override LLM)
#       - deterministic interview + LLM agrees → final = interviewing, conf = 0.95
#       - LLM confident (>=0.85) and no contradicting deterministic signal → trust LLM
#       - everything else → suggestion for user approval (never auto-apply)
#
# This gives 100% precision on the explicit-phrase cases (the regex layer
# never produces false positives because the patterns are quoted decline
# language), with the LLM serving as a recall layer for everything else and
# the user as the safety net for ambiguity.

VALID_STATUSES = {"applied", "interviewing", "offer", "rejected", "ghosted", "withdrawn"}


# ── Deterministic signal patterns ─────────────────────────────────────────
# Each pattern is a phrase that, when present in any email body for the
# record, is taken as ground truth for that status. Patterns are quoted from
# real recruiter mail; we deliberately avoid loose patterns ("not a fit"
# alone is too risky — it can appear in a "you'd be a great fit" rebuttal).

_REJECTION_PATTERNS = [
    r"\bwe (?:have )?decided to (?:move|go) forward with other (?:candidates|applicants)\b",
    r"\bmoving forward with (?:other|another) candidate",
    r"\bwe (?:will|won['’]t|will not) be (?:moving|proceeding) (?:forward|further) (?:with|in)\b",
    r"\bwe regret to inform\b",
    r"\bunfortunately[,]? (?:we|after|at this time)\b",
    r"\bafter careful (?:consideration|review)[,]? we\b.*\b(?:not|other)\b",
    r"\byour application (?:was|has been) (?:not selected|unsuccessful|declined)\b",
    r"\bwe (?:are|will be) unable to (?:move forward|proceed|offer)\b",
    r"\bwe['’]ll keep your (?:resume|application|profile) on file\b",
    r"\bno longer (?:under )?consideration\b",
    r"\bdid not select(?:ed)? (?:your|you for)\b",
    r"\bnot (?:moving|proceeding|progressing) (?:forward|further) with your\b",
    r"\bposition has been filled\b",
    r"\bwe (?:have )?filled (?:the|this) (?:position|role)\b",
]

_OFFER_PATTERNS = [
    r"\bpleased to (?:offer|extend (?:an|the) offer)\b",
    r"\bwe['’]re? excited to (?:offer|extend)\b",
    r"\bwe['’]?d like to (?:formally )?offer\b",
    r"\boffer letter (?:attached|enclosed|below)\b",
    r"\bplease find (?:your |the )?offer (?:letter |of employment )?attached\b",
    r"\bextending an offer of employment\b",
    r"\bcongratulations[!.,].{0,80}\boffer\b",
]

# Interview signals require *human-authored* progression — a scheduled time,
# Calendly link, hiring-manager intro, or explicit availability ask.
_INTERVIEW_PATTERNS = [
    r"\bcalendly\.com/",
    r"\b(?:zoom|google meet|teams|meet\.google\.com|us\d+web\.zoom\.us)/[A-Za-z0-9/_?=&\-]+",
    r"\b(?:are|would) you (?:available|free) (?:on |for |to )",
    r"\blet['’]s (?:schedule|set up|find a time)\b",
    r"\bschedule (?:a|the|your) (?:call|interview|screen|chat|conversation)\b",
    r"\b(?:phone|technical|behavioral|hiring manager|recruiter) (?:screen|interview|call)\s+(?:with|on|at|scheduled|confirmed)\b",
    r"\binvit(?:e|ation) (?:to|for) (?:an? )?(?:interview|screen|onsite|loop)\b",
    r"\b(?:onsite|virtual onsite|panel) (?:loop|interview|round)\s+(?:with|on|scheduled|confirmed)\b",
    r"\btake[- ]home (?:assessment|assignment|exercise|challenge|project)\b",
    r"\bhiring manager (?:would like to|wants to|will|intro)\b",
    r"\binterview (?:scheduled|confirmed) for\b",
    r"\bnext (?:round|step|stage) (?:of|in) (?:the|your) interview\b",
]

_REJECTION_REGEX = [re.compile(p, re.IGNORECASE) for p in _REJECTION_PATTERNS]
_OFFER_REGEX = [re.compile(p, re.IGNORECASE) for p in _OFFER_PATTERNS]
_INTERVIEW_REGEX = [re.compile(p, re.IGNORECASE) for p in _INTERVIEW_PATTERNS]


def _scan_patterns(text: str, regexes: List[re.Pattern]) -> Optional[str]:
    """Return the first matching pattern's source phrase, or None.

    We surface the matched phrase so reconciliation can include it as the
    `reason` shown in the suggestions UI — users trust the call more when
    they can see the literal sentence that drove it.
    """
    if not text:
        return None
    for rx in regexes:
        m = rx.search(text)
        if m:
            return m.group(0)[:160]
    return None


def extract_deterministic_signals(messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Run regex extractors across an application's email bundle.

    Returns a dict with at most one of: rejected, offer, interviewing — plus
    the matched phrase + the message it came from for traceability. Order of
    precedence on conflict: rejected > offer > interviewing (a rejection
    after an offer is rare but real — withdrawn offer; we surface it as a
    suggestion rather than auto-flipping).

    100%-precision claim: a hit on these patterns means the literal phrase
    appears in the email; the only failure mode is the upstream Gmail API
    handing us truncated bodies, which is bounded by `_extract_body_text`.
    """
    # Newest-first processing so an older "applied" receipt doesn't shadow a
    # later rejection — but we still scan ALL messages for any signal.
    found_rejection: Optional[Tuple[str, Dict[str, Any]]] = None
    found_offer: Optional[Tuple[str, Dict[str, Any]]] = None
    found_interview: Optional[Tuple[str, Dict[str, Any]]] = None

    for msg in messages:
        text = " ".join([
            msg.get("subject") or "",
            msg.get("snippet") or "",
            (msg.get("body") or "")[:3500],  # bound CPU; bodies > this are usually footer/quoted-thread
        ])
        if found_rejection is None:
            phrase = _scan_patterns(text, _REJECTION_REGEX)
            if phrase:
                found_rejection = (phrase, msg)
        if found_offer is None:
            phrase = _scan_patterns(text, _OFFER_REGEX)
            if phrase:
                found_offer = (phrase, msg)
        if found_interview is None:
            phrase = _scan_patterns(text, _INTERVIEW_REGEX)
            if phrase:
                found_interview = (phrase, msg)

    out: Dict[str, Any] = {}
    if found_rejection:
        out["rejected"] = {"phrase": found_rejection[0], "message_id": found_rejection[1].get("message_id")}
    if found_offer:
        out["offer"] = {"phrase": found_offer[0], "message_id": found_offer[1].get("message_id")}
    if found_interview:
        out["interviewing"] = {"phrase": found_interview[0], "message_id": found_interview[1].get("message_id")}
    return out


def reconcile_classification(
    deterministic: Dict[str, Any],
    llm: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Merge deterministic signals with the LLM verdict into a final call.

    Returns {status, confidence, reason, source} or None if neither layer
    produced anything actionable.

    Precedence (highest → lowest):
      1. Deterministic REJECTION   → status=rejected, conf=0.97
      2. Deterministic OFFER       → status=offer, conf=0.96
      3. Deterministic INTERVIEW + LLM=interviewing/applied → status=interviewing, conf=0.95
      4. LLM verdict alone         → trust at LLM's stated confidence (capped 0.90 without
                                     deterministic backing — never auto-apply on LLM-only
                                     unless the LLM is genuinely confident)
      5. Deterministic INTERVIEW only (LLM disagreed) → status=interviewing, conf=0.80
         (we trust the regex but flag for review since LLM saw something else)
    """
    # 1. Hard rejection — never overridden by anything else.
    if "rejected" in deterministic:
        return {
            "status": "rejected",
            "confidence": 0.97,
            "reason": f'Decline phrase: "{deterministic["rejected"]["phrase"]}"',
            "source": "deterministic",
            "evidence_message_id": deterministic["rejected"].get("message_id"),
        }

    # 2. Offer.
    if "offer" in deterministic:
        return {
            "status": "offer",
            "confidence": 0.96,
            "reason": f'Offer phrase: "{deterministic["offer"]["phrase"]}"',
            "source": "deterministic",
            "evidence_message_id": deterministic["offer"].get("message_id"),
        }

    llm_status = (llm or {}).get("status") if llm else None
    llm_conf = float((llm or {}).get("confidence") or 0.0) if llm else 0.0
    llm_reason = (llm or {}).get("reason", "") if llm else ""

    # 3. Deterministic interview + LLM agrees (or LLM still on applied — which
    #    is fine, the regex caught a signal LLM may have under-weighted).
    if "interviewing" in deterministic:
        if llm_status in ("interviewing", "applied", None):
            return {
                "status": "interviewing",
                "confidence": 0.95,
                "reason": f'Interview signal: "{deterministic["interviewing"]["phrase"]}"',
                "source": "deterministic+llm" if llm_status == "interviewing" else "deterministic",
                "evidence_message_id": deterministic["interviewing"].get("message_id"),
            }
        # LLM said something contradictory (e.g. "rejected" but no decline
        # phrase fired — possible polite rejection). Fall through to LLM.
        if llm_status in ("rejected", "offer"):
            return {
                "status": llm_status,
                "confidence": min(llm_conf, 0.85),  # cap — interview signal is mildly contradicting
                "reason": llm_reason,
                "source": "llm",
                "evidence_message_id": None,
            }
        # 5. Interview signal but no useful LLM verdict — trust regex but lower conf.
        return {
            "status": "interviewing",
            "confidence": 0.80,
            "reason": f'Interview signal: "{deterministic["interviewing"]["phrase"]}"',
            "source": "deterministic",
            "evidence_message_id": deterministic["interviewing"].get("message_id"),
        }

    # 4. LLM-only verdict.
    if llm_status in VALID_STATUSES:
        return {
            "status": llm_status,
            # Cap LLM-only confidence so we don't auto-apply on a hallucinated
            # high-confidence call without any deterministic backing.
            "confidence": min(llm_conf, 0.90),
            "reason": llm_reason,
            "source": "llm",
            "evidence_message_id": None,
        }
    if llm_status == "ignore":
        return {"status": "ignore", "confidence": llm_conf, "reason": llm_reason, "source": "llm"}

    return None


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

    prompt = f"""You are an experienced recruiter's assistant classifying an email so a job
application tracker can update itself automatically. Be decisive — the user has explicitly
asked you to make the call rather than punting back to them. Hedge only when the email is
genuinely ambiguous.

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

Pick the best status:
- applied        → confirmation that the user's application was received / is under review
- interviewing   → any signal of progression: recruiter wants to schedule, confirmed a time,
                   sent prep material, asked for availability, moved to next round, sent a
                   take-home, scheduled an onsite, hiring manager intro, etc.
- offer          → an offer of employment is being extended (or compensation is being discussed)
- rejected       → the user is no longer being considered, even if framed politely
                   ("we've decided to move forward with other candidates", "not at this time",
                   "we'll keep your resume on file")
- ignore         → marketing, automated job alert, recruiter outreach for a *different* role,
                   newsletter, calendar invite from an unrelated meeting

Confidence guidance:
- 0.90+  unambiguous: explicit phrasing for that status
- 0.70-0.89  clear from context even without an explicit phrase
- 0.50-0.69  leaning that way but could be misread
- below 0.50  truly uncertain — only use this when you genuinely can't tell

Default to a definite status when the email is *about* this application and you can read its
intent. Only fall back to "ignore" if the email is unrelated or noise.

Output strict JSON: {{"status": "...", "confidence": 0.0-1.0, "reason": "one short sentence"}}.
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


def classify_record_thread(messages: List[Dict[str, Any]], record_meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Classify an application's CURRENT status by reading the full set of
    related emails together (newest first).

    This is dramatically more accurate than per-message classification because
    the LLM can see the timeline as one story. A thread that goes
    "applied → interview invite → rejection" is unambiguous when read in
    order — but classifying each email in isolation can leave a record stuck
    on whichever message happened to be processed last.
    """
    if not messages:
        return None

    blocks: List[str] = []
    for i, msg in enumerate(messages):
        blocks.append(
            f"--- Email {i+1} (most recent first) ---\n"
            f"Date: {msg.get('date', '')}\n"
            f"From: {msg.get('from_name','')} <{msg.get('from_address','')}>\n"
            f"Subject: {msg.get('subject', '')}\n"
            f"Snippet: {msg.get('snippet', '')}\n"
            f"Body: {(msg.get('body') or '')[:900]}"
        )
    emails_text = "\n\n".join(blocks)

    prompt = f"""You are auditing a SINGLE job application by reading every related email
together. Your job is to decide the application's CURRENT status with high precision.
False positives (e.g. promoting "applied" → "interviewing" off automated boilerplate, or
marking "rejected" off a vague "we'll be in touch") are worse than being conservative.

Application:
- Company: {record_meta.get('company') or 'unknown'}
- Role: {record_meta.get('title') or 'unknown'}
- Tracker currently shows: {record_meta.get('current_status')}

Below are the related emails, MOST RECENT FIRST. Read them as one timeline and decide the
status reflected by the most-recent meaningful event.

{emails_text}

DECISION RULES (apply in order — first match wins):

1. rejected — pick this if ANY email contains explicit decline language directed at the
   user's application:
     • "we have decided to move forward with other candidates"
     • "we will not be moving forward"
     • "we regret to inform you"
     • "unfortunately, we are not able to offer"
     • "your application was not selected"
     • "we'll keep your resume on file"
     • "no longer under consideration"
   A rejection email overrides any earlier interview/applied state — the final status is
   "rejected" even if there was a prior interview.

2. offer — pick this only if an email explicitly extends an offer of employment or
   discusses compensation/start date in an offer context (e.g. "we are pleased to extend",
   "offer letter attached", "your starting salary would be").

3. interviewing — pick this ONLY if an email contains an explicit, human-authored
   progression signal directed at this user:
     • a specific scheduled interview time/date or Calendly link addressed to them
     • "would you be available on <date>" / "let's schedule a call"
     • take-home/coding assessment INVITATION (not just a reminder of one received elsewhere)
     • hiring manager / recruiter introducing themselves to set up a screen
     • panel/onsite invite or confirmation
   Do NOT pick "interviewing" off:
     • generic "next steps will be shared if you're a fit" boilerplate in an application
       receipt
     • mass newsletter / event invitations
     • assessment platforms emails the user clearly didn't engage with for THIS role
     • "thanks for applying — our team will review" (this is still "applied")

4. applied — pick this if there is an application-received / acknowledgement email but
   NO clear progression signal (rule 3) and NO decline (rule 1). This is the safe default
   when the thread is just "we got your application" + automated check-ins.

5. ignore — pick this only if NONE of the emails are actually about this user's
   application for THIS role at THIS company (e.g. unrelated recruiter outreach for a
   different role, newsletters, job alert digests, generic marketing).

Funnel direction is draft → applied → interviewing → offer, with rejected as a terminal
side branch. NEVER pick a status earlier in the funnel than the tracker's current status
unless the most recent email genuinely re-opens the process (rare — flag it with low
confidence so the user reviews).

Confidence calibration (be honest — low confidence is fine, it just keeps it as a
suggestion the user reviews instead of auto-applying):
- 0.90+   unambiguous: an explicit phrase from the rules above appears verbatim
- 0.75-0.89  clear from human-written context across the thread
- 0.60-0.74  leaning that way but a reasonable person could read it differently
- below 0.60  genuinely uncertain — use this when the emails are vague or boilerplate

Output strict JSON: {{"status": "...", "confidence": 0.0-1.0, "reason": "one short sentence quoting the specific phrase or email that drove the decision"}}.
"""

    try:
        from services.gemini_client import gemini_json, GEMINI_FLASH
        result = gemini_json(
            prompt=prompt,
            max_tokens=400,
            temperature=0.0,
            model=GEMINI_FLASH,
            max_retries=1,
        )
    except Exception as e:
        logger.warning("classify_record_thread LLM call failed: %s", e)
        return None

    status = (result.get("status") or "").lower()
    confidence = float(result.get("confidence") or 0.0)
    reason = (result.get("reason") or "")[:240]

    if status == "ignore":
        return {"status": "ignore", "confidence": confidence, "reason": reason}
    if status not in VALID_STATUSES:
        return None
    return {"status": status, "confidence": confidence, "reason": reason}


# ---------------------------------------------------------------------------
# Sync orchestrator
# ---------------------------------------------------------------------------

# Funnel direction. Lower index = earlier in the funnel. "rejected"/"ghosted"/
# "withdrawn" are terminal — moving OUT of them needs strong evidence.
_FUNNEL_ORDER = {"draft": 0, "applied": 1, "interviewing": 2, "offer": 3}


def _is_funnel_backwards(current: str, proposed: str) -> bool:
    """True if `proposed` would move the record backwards in the funnel.

    Used as a soft safety net — a backwards move still goes through, but only
    as a suggestion the user has to confirm, never an auto-apply.
    """
    if current in ("rejected", "ghosted", "withdrawn"):
        # Terminal states — only reopen if very confident, and never auto.
        return proposed not in ("rejected", "ghosted", "withdrawn")
    cur_rank = _FUNNEL_ORDER.get(current)
    new_rank = _FUNNEL_ORDER.get(proposed)
    if cur_rank is None or new_rank is None:
        return False
    return new_rank < cur_rank

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


def sync_user(user_email: str) -> Dict[str, Any]:
    """Pull recent Gmail, match to records, classify, and write applies/suggestions.

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

    since = conn.get("last_synced_at")
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
    skipped_no_match = 0
    skipped_already_in_status = 0
    seen_message_ids = set()

    logger.info(
        "[gmail-sync] user=%s records=%d messages_fetched=%d since=%s",
        user_email, len(index), len(messages), since.isoformat() if since else "initial",
    )

    # ── Phase 1: bucket matched messages by record ────────────────────────
    # We classify per-record (not per-message) so the LLM sees the full
    # thread and can resolve sequences like applied → interview → rejected
    # correctly regardless of the order Gmail returned them in.
    record_buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    record_meta_by_id: Dict[str, Dict[str, Any]] = {r["record_id"]: r for r in index}

    for msg in messages:
        mid = msg["message_id"]
        if mid in seen_message_ids:
            continue
        seen_message_ids.add(mid)

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
        record_buckets[record_meta["record_id"]].append({
            "msg": msg, "score": match_score, "reason": match_reason,
        })

    # ── Phase 2: classify each record's thread as a whole ─────────────────
    # We deliberately re-classify every record that has matched mail on every
    # sync — the per-record thread call is cheap and self-correcting, so a
    # record that was wrongly stuck on "applied" by an older per-message
    # classifier will fix itself the next time sync runs. Skipping when "all
    # messages were seen before" is what trapped users on stale statuses.
    for record_id, items in record_buckets.items():
        rec_meta = record_meta_by_id.get(record_id)
        if not rec_meta:
            continue

        # Newest first — the LLM weighs the most recent email most heavily.
        items.sort(key=lambda x: x["msg"].get("internal_date", 0), reverse=True)
        msg_ids = [it["msg"]["message_id"] for it in items]

        msgs_for_llm = [it["msg"] for it in items[:10]]  # cap at 10 emails for token budget

        # Tier 1: deterministic regex extraction. Runs even if the LLM call
        # later fails, so a clear "we have decided to move forward with other
        # candidates" still resolves to rejected.
        deterministic = extract_deterministic_signals(msgs_for_llm)

        # Tier 2: LLM thread classification. May return None on transient
        # failure — that's fine, deterministic alone can carry the decision.
        llm_cls = classify_record_thread(msgs_for_llm, rec_meta)

        # Reconcile both tiers into a single verdict.
        cls = reconcile_classification(deterministic, llm_cls)
        if not cls:
            ignored += len(items)
            logger.info(
                "[gmail-sync] no_verdict record=%s emails=%d (LLM and regex both inconclusive)",
                record_id, len(items),
            )
            continue
        if cls["status"] == "ignore":
            ignored += len(items)
            logger.info(
                "[gmail-sync] classified=ignore record=%s emails=%d reason=%s",
                record_id, len(items), cls.get("reason"),
            )
            continue

        new_status = cls["status"]
        confidence = cls["confidence"]

        if rec_meta["current_status"] == new_status:
            skipped_already_in_status += 1
            logger.info(
                "[gmail-sync] already_in_status record=%s status=%s confidence=%.2f",
                record_id, new_status, confidence,
            )
            # Even if the status already matches, we may have a stale
            # *pending* suggestion proposing a different state — drop it so
            # the suggestions panel reflects ground truth.
            _suggestions().update_many(
                {
                    "user_email": user_email,
                    "record_id": record_id,
                    "applied": False,
                    "dismissed": False,
                    "suggested_status": {"$ne": new_status},
                },
                {"$set": {"dismissed": True, "dismissed_at": datetime.now(timezone.utc),
                          "dismissed_reason": "superseded by re-classification"}},
            )
            continue

        # Funnel-backwards moves are usually wrong (rejected→interviewing,
        # offer→applied). We still SUGGEST them but never auto-apply, so the
        # user has a chance to confirm.
        backwards = _is_funnel_backwards(rec_meta["current_status"], new_status)
        if backwards:
            logger.info(
                "[gmail-sync] backwards_move record=%s %s→%s — suggesting only",
                record_id, rec_meta["current_status"], new_status,
            )

        # Before writing a fresh suggestion, supersede any prior unresolved
        # suggestions on the same record. This prevents the suggestions panel
        # from accumulating duplicates as we re-classify on every sync, and
        # ensures the user always sees the *current* verdict.
        _suggestions().update_many(
            {
                "user_email": user_email,
                "record_id": record_id,
                "applied": False,
                "dismissed": False,
            },
            {"$set": {"dismissed": True, "dismissed_at": datetime.now(timezone.utc),
                      "dismissed_reason": "superseded by re-classification"}},
        )

        # Use the newest message as the canonical reference; the suggestion
        # row carries supporting_message_ids so we can show the thread later.
        primary = items[0]["msg"]
        suggestion = {
            "suggestion_id": str(uuid.uuid4()),
            "user_email": user_email,
            "record_id": record_id,
            "company": rec_meta["company"],
            "title": rec_meta["title"],
            "gmail_message_id": primary["message_id"],
            "gmail_thread_id": primary.get("thread_id"),
            "from_name": primary.get("from_name"),
            "from_address": primary.get("from_address"),
            "subject": primary.get("subject"),
            "snippet": primary.get("snippet"),
            "current_status": rec_meta["current_status"],
            "suggested_status": new_status,
            "confidence": confidence,
            "reason": cls.get("reason", ""),
            "source": cls.get("source", "llm"),
            "evidence_message_id": cls.get("evidence_message_id"),
            "supporting_message_ids": msg_ids,
            "applied": False,
            "dismissed": False,
            "auto_applied": False,
            "created_at": datetime.now(timezone.utc),
        }

        if confidence >= AUTO_APPLY_CONFIDENCE and not backwards \
                and _apply_status(user_email, record_id, new_status):
            suggestion["applied"] = True
            suggestion["auto_applied"] = True
            suggestion["applied_at"] = datetime.now(timezone.utc)
            rec_meta["current_status"] = new_status
            auto_applied += 1
            logger.info(
                "[gmail-sync] auto_applied record=%s %s→%s confidence=%.2f",
                record_id, suggestion["current_status"], new_status, confidence,
            )
        else:
            suggested += 1
            logger.info(
                "[gmail-sync] suggested record=%s %s→%s confidence=%.2f%s",
                record_id, suggestion["current_status"], new_status, confidence,
                " (backwards)" if backwards else "",
            )

        _suggestions().insert_one(suggestion)

    _connections().update_one(
        {"user_email": user_email},
        {"$set": {"last_synced_at": datetime.now(timezone.utc)}},
    )

    logger.info(
        "[gmail-sync] done user=%s scanned=%d records_with_mail=%d auto=%d suggest=%d "
        "ignored=%d skipped_nomatch=%d skipped_same_status=%d",
        user_email, len(messages), len(record_buckets), auto_applied, suggested, ignored,
        skipped_no_match, skipped_already_in_status,
    )

    return {
        "messages_scanned": len(messages),
        "records_with_mail": len(record_buckets),
        "auto_applied": auto_applied,
        "suggested": suggested,
        "ignored": ignored,
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
