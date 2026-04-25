"""
Career Copilot — multi-agent-style RAG over the user's resume + stateful learning playground.

- Retrieval: simple chunk + lexical overlap (no vector DB) over `user_resumes.raw_text`.
- Synthesis: single Gemini 2.5 Pro structured call that emits pipeline steps (visible "agents"),
  grounded reply, suggestions, and adaptive next actions.
- State: `career_copilot_state` collection (per user_email).
"""

from __future__ import annotations

import json
import re
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Curated learning tracks: theory → practice, basic → advanced.
PLAYGROUND_TRACKS: List[Dict[str, Any]] = [
    {
        "id": "cold_outreach",
        "title": "Cold outreach that gets replies",
        "description": "From research to follow-ups across email and LinkedIn (ethical, non-spammy).",
        "steps": [
            {
                "title": "Map the funnel",
                "type": "theory",
                "body": "Define your ICP (role, company size, stage), your proof (1–2 assets), and a single CTA. "
                "Outreach is a system: research → note → connect → add value → follow up.",
            },
            {
                "title": "Draft 3 message variants",
                "type": "practice",
                "body": "Write: (1) 80-word cold email, (2) LinkedIn connect note ≤300 chars, (3) follow-up #48h. "
                "Use specifics from the company’s recent post or product page — no generic praise.",
            },
            {
                "title": "Personalization hooks",
                "type": "theory",
                "body": "Good hooks: shared stack, a blog post, a launch, a mutual problem. "
                "Bad hooks: 'I am passionate about' with no evidence.",
            },
            {
                "title": "A/B your subject lines",
                "type": "practice",
                "body": "List 5 subject lines. Score each for curiosity vs clarity. "
                "Pick two and role-play the recipient — which would you open?",
            },
            {
                "title": "Cadence & limits",
                "type": "theory",
                "body": "Respect platform ToS, avoid bulk automation, and cap follow-ups. "
                "Build a 14-day touch pattern you can sustain.",
            },
        ],
    },
    {
        "id": "system_design_interview",
        "title": "System design interview (practical path)",
        "description": "Progressive drills from requirements to tradeoffs, tailored to your background.",
        "steps": [
            {
                "title": "Clarify requirements",
                "type": "theory",
                "body": "Functional (features), non-functional (scale, latency, consistency), and constraints. "
                "List 5 questions you’d ask before drawing a box.",
            },
            {
                "title": "5-minute high-level",
                "type": "practice",
                "body": "Pick a system you know (e.g. URL shortener, chat). Sketch API + data model in bullets only — no diagram yet.",
            },
            {
                "title": "Capacity + bottlenecks",
                "type": "theory",
                "body": "Back-of-napkin QPS, storage, hot keys, fan-out. Name the first bottleneck you’d measure in prod.",
            },
            {
                "title": "Deep dive one component",
                "type": "practice",
                "body": "Take one component (e.g. cache, DB, queue) and list failure modes + mitigations.",
            },
            {
                "title": "Tradeoff close",
                "type": "theory",
                "body": "Practice saying: 'We choose X over Y because … at our scale … accepting downside Z.'",
            },
        ],
    },
    {
        "id": "portfolio_project",
        "title": "Ship a portfolio project end-to-end",
        "description": "Idea to README to demo, with milestones you can show in an interview.",
        "steps": [
            {
                "title": "Problem + user",
                "type": "theory",
                "body": "One sentence problem, one primary user, one 'why now'. If you can’t name the user, narrow the scope.",
            },
            {
                "title": "One-page spec",
                "type": "practice",
                "body": "Outcomes, non-goals, 3 user stories, stack proposal, 1-week slice for MVP.",
            },
            {
                "title": "Milestone plan",
                "type": "theory",
                "body": "Break into demoable chunks: data → API → UI → deploy → story in README.",
            },
            {
                "title": "Build the smallest slice",
                "type": "practice",
                "body": "Ship one vertical slice (e.g. read path + one mutation). No extra features until this works in prod or CI.",
            },
            {
                "title": "Tell the story",
                "type": "theory",
                "body": "Write README: what/why, architecture diagram, how to run, what you’d do next. "
                "This is what recruiters skim.",
            },
        ],
    },
]

_CHUNK_SIZE = 1400
_CHUNK_OVERLAP = 200
_MAX_CHUNKS = 4
_HISTORY_CAP = 24


def _tokenize(s: str) -> set:
    return set(re.findall(r"[a-z0-9#+]{2,}", (s or "").lower()))


def _chunk_text(text: str) -> List[Dict[str, Any]]:
    t = (text or "").strip()
    if not t:
        return []
    chunks: List[Dict[str, Any]] = []
    i = 0
    idx = 0
    n = len(t)
    while i < n:
        j = min(i + _CHUNK_SIZE, n)
        piece = t[i:j].strip()
        if piece:
            chunks.append({"id": f"c{idx}", "text": piece})
            idx += 1
        if j >= n:
            break
        i = j - _CHUNK_OVERLAP
    return chunks


def _rank_chunks(user_message: str, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    q = _tokenize(user_message)
    if not q:
        return chunks[:_MAX_CHUNKS]
    scored: List[Tuple[float, Dict[str, Any]]] = []
    for c in chunks:
        ct = _tokenize(c["text"])
        inter = len(q & ct)
        union = len(q | ct) or 1
        score = inter / union + min(len(c["text"]), 5000) * 1e-9
        scored.append((score, c))
    scored.sort(key=lambda x: -x[0])
    return [c for _, c in scored[:_MAX_CHUNKS]]


def get_resume_rag_context(user_email: str, user_message: str) -> Tuple[str, List[Dict[str, str]]]:
    """Return formatted context + citation snippets from lexical RAG over stored resume text."""
    from services.resume_service import get_resume_service

    svc = get_resume_service()
    doc = None
    try:
        doc = svc.parser.ensure_structured_resume(user_email)
    except Exception as e:
        logger.warning("ensure_structured_resume failed: %s", e)

    raw = (doc or {}).get("raw_text") or ""
    if not raw and (doc or {}).get("structured"):
        # Fallback: compact JSON-ish summary
        try:
            raw = json.dumps((doc or {}).get("structured"), default=str)[:8000]
        except Exception:
            raw = str((doc or {}).get("structured"))[:8000]

    chunks = _chunk_text(raw)
    picked = _rank_chunks(user_message, chunks) if chunks else []
    if not picked:
        return ("", [])

    lines: List[str] = []
    cites: List[Dict[str, str]] = []
    for c in picked:
        snip = c["text"][:500].replace("\n", " ")
        if len(c["text"]) > 500:
            snip += "…"
        lines.append(f"[{c['id']}] {c['text']}")
        cites.append({"id": c["id"], "snippet": snip})

    return ("\n\n---\n\n".join(lines), cites)


COPILOT_SYSTEM = """You are the lead orchestrator for a multi-agent career copilot. You must behave as if these specialists collaborated (do not name yourself as a single monolith in the user-facing reply):

- Memory & RAG: uses the user's own resume text chunks (cited) — never invent employers, dates, or credentials.
- Career strategist: job search, positioning, negotiation framing.
- Resume & JD tailor: line-level tailoring, keywords, impact metrics.
- Interview coach: behavioral/technical plans, STAR, drills.
- Outreach & GTM: cold email, LinkedIn, follow-ups — always ethical: no spam, no fabricated connections, respect platform ToS, honest subject lines.
- Project & deliverables: scoping, milestones, PPT/storyline, PDF/one-pager outlines (describe structure; do not claim files were written unless the product actually creates them).

Rules:
1) Ground every claim about the USER in the RESUME_CONTEXT chunks. If a chunk is missing, say you don't have that info and ask for a paste.
2) reply: main answer in markdown. Be concise by default; expand on request. Include bullet lists where helpful.
3) pipeline: 3–6 steps, each with agent id (one of: memory, strategist, tailor, interview, outreach, project), short label, and one-sentence summary of that agent's contribution THIS turn.
4) rag_grounding: 1-2 sentences on which chunk themes you used, or "No resume on file" if context empty.
5) suggested_prompts: exactly 3 short follow-ups the user can tap.
6) next_best_actions: 2–3 adaptive suggestions tied to the user's message and their stage (e.g. upload resume, paste JD, practice pitch, draft outreach). Reasons must be one line.
7) compliance: one sentence reminding ethical outreach and honesty.

Language: match the user's language if clearly not English; otherwise English."""


def _get_state_collection():
    from utils.db_connect import DBConnect
    return DBConnect().get_db().career_copilot_state


def get_copilot_state(user_email: str) -> Dict[str, Any]:
    col = _get_state_collection()
    doc = col.find_one({"user_email": user_email})
    if doc:
        doc.pop("_id", None)
    return doc or {}


def get_messages_for_api(user_email: str) -> List[Dict[str, Any]]:
    st = get_copilot_state(user_email)
    return _serialize_messages(list(st.get("messages") or []))


def upsert_copilot_state(user_email: str, patch: Dict[str, Any]) -> None:
    col = _get_state_collection()
    patch["user_email"] = user_email
    patch["updated_at"] = datetime.now(timezone.utc)
    col.update_one(
        {"user_email": user_email},
        {"$set": patch, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


def _trim_history(msgs: List[Dict]) -> List[Dict]:
    return msgs[-_HISTORY_CAP:]


def run_career_copilot(
    user_email: str,
    message: str,
    jd_paste: str = "",
    reset: bool = False,
) -> Dict[str, Any]:
    from services.gemini_client import gemini_json, GEMINI_PRO, GEMINI_FLASH, LLMRetriesExhaustedError

    col = _get_state_collection()
    if reset:
        col.update_one(
            {"user_email": user_email},
            {"$set": {
                "messages": [],
                "updated_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        return {"ok": True, "cleared": True}

    st = get_copilot_state(user_email)
    history: List[Dict] = st.get("messages") or []

    # Behavior: infer primary intent for analytics (no extra model call)
    text_l = message.lower()
    if any(k in text_l for k in ("linkedin", "dm", "cold email", "recruiter", "outreach")):
        _bump_topic(user_email, "outreach")
    if any(k in text_l for k in ("interview", "star", "behavioral", "system design")):
        _bump_topic(user_email, "interview")
    if any(k in text_l for k in ("resume", "bullet", "tailor", "ats", "jd", "job description")):
        _bump_topic(user_email, "tailor")

    resume_ctx, citations = get_resume_rag_context(user_email, message)

    # History as plain text
    convo = []
    for m in _trim_history(history):
        role = m.get("role")
        if role in ("user", "assistant") and m.get("content"):
            convo.append(f"{'User' if role == 'user' else 'Assistant'}: {m['content'][:4000]}")

    jd_block = ""
    if (jd_paste or "").strip():
        jd_block = f"\n\nPASTED_JOB_DESCRIPTION (truncated):\n{(jd_paste or '')[:12000]}\n"

    prompt = (
        f"{COPILOT_SYSTEM}\n\n"
        f"RESUME_CONTEXT (RAG; cite themes, do not copy verbatim long stretches):\n"
        f"{(resume_ctx or 'NO RESUME TEXT ON FILE — ask user to upload in Resume > My Resumes or paste summary.')}\n"
        f"{jd_block}\n"
        "RECENT_TRANSCRIPT (newest at bottom):\n"
        f"{('\n'.join(convo[-10:]) if convo else '(empty)')}\n\n"
        f"USER_MESSAGE:\n{message}\n"
    )

    try:
        out = gemini_json(
            prompt=prompt,
            max_tokens=8192,
            temperature=0.35,
            model=GEMINI_PRO,
            schema={
                "reply": str,
                "pipeline": [{"agent": str, "label": str, "summary": str}],
                "rag_grounding": str,
                "suggested_prompts": [str],
                "next_best_actions": [{"title": str, "reason": str}],
                "compliance": str,
            },
        )
    except (ValueError, LLMRetriesExhaustedError) as e:
        logger.exception("career_copilot primary failed, trying flash: %s", e)
        out = gemini_json(
            prompt=prompt,
            max_tokens=6000,
            temperature=0.4,
            model=GEMINI_FLASH,
            schema={
                "reply": str,
                "pipeline": [{"agent": str, "label": str, "summary": str}],
                "rag_grounding": str,
                "suggested_prompts": [str],
                "next_best_actions": [{"title": str, "reason": str}],
                "compliance": str,
            },
        )

    reply = (out or {}).get("reply") or "I could not generate a response — try again in a moment."
    now = datetime.now(timezone.utc)
    new_history = _trim_history(
        history
        + [
            {"role": "user", "content": message, "at": now, "id": uuid.uuid4().hex[:8]},
            {
                "role": "assistant",
                "content": reply,
                "at": now,
                "id": uuid.uuid4().hex[:8],
                "meta": {
                    "pipeline": (out or {}).get("pipeline"),
                    "citations": citations,
                },
            },
        ],
    )

    col.update_one(
        {"user_email": user_email},
        {
            "$set": {
                "messages": new_history,
                "last_reply_meta": {k: out.get(k) for k in ("suggested_prompts", "next_best_actions", "pipeline", "compliance", "rag_grounding") if (out or {}).get(k) is not None},
                "updated_at": now,
            },
            "$setOnInsert": {
                "user_email": user_email,
                "created_at": now,
            },
        },
        upsert=True,
    )
    _touch_behavior(user_email, "copilot")

    return {
        "ok": True,
        "reply": reply,
        "pipeline": (out or {}).get("pipeline") or [],
        "citations": citations,
        "rag_grounding": (out or {}).get("rag_grounding", ""),
        "suggested_prompts": (out or {}).get("suggested_prompts") or [],
        "next_best_actions": (out or {}).get("next_best_actions") or [],
        "compliance": (out or {}).get("compliance", ""),
        "messages": _serialize_messages(new_history),
    }


def _serialize_messages(msgs: List[Dict]) -> List[Dict]:
    out: List[Dict] = []
    for m in msgs:
        o = {**m}
        at = o.get("at")
        if hasattr(at, "isoformat"):
            o["at"] = at.isoformat()
        if "meta" in o and o["meta"] is not None and not isinstance(o["meta"], dict):
            o["meta"] = str(o["meta"])
        out.append(o)
    return out


def _touch_behavior(user_email: str, source_tab: str) -> None:
    col = _get_state_collection()
    col.update_one(
        {"user_email": user_email},
        {
            "$inc": {f"behavior.visits.{source_tab}": 1},
            "$set": {"behavior.last_tab": source_tab, "updated_at": datetime.now(timezone.utc)},
            "$setOnInsert": {
                "user_email": user_email,
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )


def _bump_topic(user_email: str, topic: str) -> None:
    col = _get_state_collection()
    col.update_one(
        {"user_email": user_email},
        {
            "$inc": {f"behavior.topics.{topic}": 1},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        upsert=True,
    )


def record_tab_event(user_email: str, tab: str) -> None:
    """Cross-tab behavior for adaptive dashboard."""
    if not tab:
        return
    _touch_behavior(user_email, tab)


def get_dashboard_bundle(user_email: str) -> Dict[str, Any]:
    """State + tracks + rule-based nudges (fast path, no model call on every load)."""
    st = get_copilot_state(user_email)
    from services.resume_service import get_resume_service
    has_resume = False
    try:
        doc = get_resume_service().parser.ensure_structured_resume(user_email)
        has_resume = bool((doc or {}).get("raw_text") or (doc or {}).get("structured"))
    except Exception:
        pass

    last_meta = st.get("last_reply_meta") or {}
    nba = last_meta.get("next_best_actions") or []
    if not nba:
        nba = []
        if not has_resume:
            nba.append({
                "title": "Upload your base resume",
                "reason": "RAG and tailoring work best with your full text on file.",
            })
        nba.append({
            "title": "Paste a job description",
            "reason": "I can align bullets, stories, and outreach to a specific role.",
        })
        topics = (st.get("behavior") or {}).get("topics") or {}
        if topics.get("outreach", 0) > topics.get("interview", 0):
            nba.append({
                "title": "Try the outreach play",
                "reason": "You’ve been asking about messaging — I can help sequence email + follow-ups.",
            })
        else:
            nba.append({
                "title": "Run a mock drill",
                "reason": "Use Interview Prep for role-specific practice; Copilot for strategy and framing.",
            })

    pg = st.get("playground") or {}
    return {
        "has_resume": has_resume,
        "last_tab": (st.get("behavior") or {}).get("last_tab"),
        "visits": (st.get("behavior") or {}).get("visits") or {},
        "topics": (st.get("behavior") or {}).get("topics") or {},
        "suggested_prompts": last_meta.get("suggested_prompts") or [
            "Tailor my resume to this JD (I’ll paste next)",
            "Write a 120-word cold email to a hiring manager for ___",
            "What should I improve first for senior SWE interviews?",
        ],
        "next_best_actions": nba[:4],
        "playground": pg,
        "tracks": PLAYGROUND_TRACKS,
    }


def start_playground_track(user_email: str, track_id: Optional[str], custom_topic: Optional[str]) -> Dict[str, Any]:
    if not (custom_topic and custom_topic.strip()) and not (track_id and str(track_id).strip()):
        return {"ok": False, "error": "Provide track_id or custom_topic"}
    if custom_topic and custom_topic.strip():
        from services.gemini_client import gemini_json, GEMINI_PRO, GEMINI_FLASH, LLMRetriesExhaustedError
        topic = custom_topic.strip()[:500]
        prompt = f"""You design a progressive learning + practice path (basic to advanced) for: {topic}
Return JSON with: title (str), steps: array of 5-7 items, each: title, type (theory or practice), body (2-4 sentences, actionable).
No markdown in strings."""
        try:
            plan = gemini_json(
                prompt=prompt,
                model=GEMINI_PRO,
                max_tokens=4096,
                temperature=0.4,
                schema={
                    "title": str,
                    "steps": [{"title": str, "type": str, "body": str}],
                },
            )
        except (ValueError, LLMRetriesExhaustedError):
            plan = gemini_json(
                prompt=prompt,
                model=GEMINI_FLASH,
                max_tokens=4096,
                temperature=0.4,
                schema={
                    "title": str,
                    "steps": [{"title": str, "type": str, "body": str}],
                },
            )
        custom_steps = (plan or {}).get("steps") or []
        bundle = {
            "active_track": "custom",
            "custom_title": (plan or {}).get("title") or "Custom track",
            "custom_topic": topic,
            "current_step": 0,
            "steps": custom_steps,
            "completed": [],
        }
    else:
        t = next((x for x in PLAYGROUND_TRACKS if x["id"] == track_id), None)
        if not t:
            return {"ok": False, "error": "Unknown track"}
        bundle = {
            "active_track": track_id,
            "custom_title": None,
            "custom_topic": None,
            "current_step": 0,
            "steps": t["steps"],
            "completed": [],
        }

    upsert_copilot_state(
        user_email,
        {
            "playground": bundle,
        },
    )
    return {"ok": True, "playground": bundle}


def complete_playground_step(user_email: str) -> Dict[str, Any]:
    st = get_copilot_state(user_email)
    pg = st.get("playground") or {}
    if not pg.get("steps"):
        return {"ok": False, "error": "No active track"}
    idx = int(pg.get("current_step") or 0)
    steps: List = pg.get("steps") or []
    done: List = list(pg.get("completed") or [])
    if idx < len(steps):
        done.append(idx)
        idx += 1
    pg["completed"] = done
    pg["current_step"] = idx
    if idx >= len(steps):
        pg["finished_at"] = datetime.now(timezone.utc).isoformat()
    upsert_copilot_state(user_email, {"playground": pg})
    return {"ok": True, "playground": pg}


def reset_playground(user_email: str) -> None:
    upsert_copilot_state(user_email, {"playground": {}})
