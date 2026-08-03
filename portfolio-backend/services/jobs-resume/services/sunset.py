"""AI feature sunset — Resume Tailor moved to Aspirely (https://aspirely.me).

The portfolio's AI resume tooling is retired. Bedrock InvokeModel has been
revoked from the Lambda execution role, so any call that would have reached a
model now fails at the IAM layer with an opaque AccessDenied. This module
turns that into one deliberate, honest answer everywhere.

Two layers, on purpose:

  1. **Route guard** (`sunset_guard`, wired as a `before_request` on the jobs
     and resume blueprints). Retired endpoints answer 410 immediately — no
     Lambda fan-out, no async job row, no polling loop that ends in a generic
     "failed". This is what the UI actually renders.

  2. **Provider guard** (`llm_providers.claude` raises `AIFeatureSunsetError`).
     Backstop for any AI path not named in `RETIRED_ENDPOINTS`. The app-level
     error handler renders it with the same payload as layer 1, so a missed
     route degrades to the correct message rather than a 500.

What deliberately still works: job discovery (Workday, Career Pages, daily
pipeline, saved jobs, match scores — all deterministic, no model calls), and
full read/download access to every resume and tailoring record already stored.
Nobody loses data; they just can't generate new AI output here.
"""
from flask import jsonify

NEW_PRODUCT_NAME = "Aspirely"
NEW_PRODUCT_URL = "https://aspirely.me"

#: Machine-readable discriminator. The frontend switches on this to render the
#: migration card instead of a generic error toast.
SUNSET_CODE = "ai_features_moved"

#: One sentence, shown as the card headline.
SUNSET_TITLE = "AI resume tailoring has moved to Aspirely"

#: The body. Says what stopped, what didn't, and where to go — in that order,
#: because "did I lose my data?" is the first thing anyone will wonder.
SUNSET_MESSAGE = (
    "This portfolio no longer tailors resumes. Your resumes, tailored versions, "
    "and application history are all still here and still downloadable — nothing "
    "was deleted. Job search also still works. "
    f"Tailoring, cover letters, ATS scoring, interview prep and auto-apply now live "
    f"on {NEW_PRODUCT_NAME} — {NEW_PRODUCT_URL}"
)

#: Rendered as a checklist on the migration card. Sourced from the live
#: Aspirely nav (jobs / resume / apply / grow) so it doesn't overpromise.
NEW_PRODUCT_HIGHLIGHTS = [
    "Matched jobs from employer career sites, with fit reasons and sponsorship signals",
    "Resume tailoring and batch tailoring against many roles at once",
    "Auto-Apply — queue roles and let Aspirely fill the application forms",
    "Application tracker, managed inbox, and interview prep",
    "Career Copilot, learning sprints, and referral network tools",
]


class AIFeatureSunsetError(Exception):
    """Raised when code reaches an LLM call that no longer exists.

    Intentionally NOT a subclass of `LLMRetriesExhaustedError`. Several
    callers (match_gap_reporter, filter_suggester) catch that type and quietly
    fall back to a degraded-but-plausible result — correct behaviour for a
    transient model outage, wrong here, where the honest answer is "this
    feature is gone, go to Aspirely". Keeping the types separate means the
    error propagates to the handler instead of being swallowed.
    """

    code = SUNSET_CODE


def sunset_payload() -> dict:
    """The response body shared by the route guard and the error handler."""
    return {
        "error": SUNSET_CODE,
        "code": SUNSET_CODE,
        "title": SUNSET_TITLE,
        "message": SUNSET_MESSAGE,
        "moved_to": NEW_PRODUCT_URL,
        "product": NEW_PRODUCT_NAME,
        "highlights": NEW_PRODUCT_HIGHLIGHTS,
        "data_retained": True,
        "still_available": [
            "Job search (Workday, Career Pages, daily pipeline)",
            "Downloading resumes and tailored versions you already have",
            "Application tracker history",
        ],
    }


def sunset_response():
    """410 Gone + the migration payload.

    410 rather than 404 (the route existed) or 503 (nothing is coming back
    up). Clients that only look at status get a correct signal; clients that
    read the body get the full story.
    """
    return jsonify(sunset_payload()), 410


# ---------------------------------------------------------------------------
# Retired endpoints
# ---------------------------------------------------------------------------
# Flask endpoint names ("<blueprint>.<view_func>"). Anything listed here used
# to call a model to GENERATE something. Read, list, download, delete and
# job-discovery endpoints are deliberately absent — they still work.
RETIRED_ENDPOINTS = frozenset({
    # ── Tailoring core ────────────────────────────────────────────────────
    "resume.extract_jd",
    "resume.tailor",
    "resume.tailor_with_jd",
    "resume.regenerate",
    "resume.rewrite_bullet",
    "resume.ats_scores",
    "resume.cover_letter",
    "resume.cover_letter_download",
    "resume.batch_tailor",
    # Uploading a NEW base resume runs the LLM parser, so it goes too.
    # Existing parsed resumes are untouched and still served by /status,
    # /versions, /generated and /download-file.
    "resume.upload",
    # ── Interview prep (all generative) ───────────────────────────────────
    "resume.generate_interview_prep",
    "resume.practice_question",
    "resume.interview_chat",
    "resume.mock_evaluate",
    # ── Career Copilot — generative surfaces only. The CRUD underneath
    #    (contacts, offers, memory, momentum, timeline) stays readable.
    "resume.career_copilot_chat",
    "resume.career_copilot_behavior",
    "resume.career_copilot_playground_start",
    "resume.career_copilot_playground_advance",
    "resume.career_copilot_playground_quiz",
    "resume.career_copilot_playground_evaluate",
    "resume.career_copilot_outreach_generate_sequence",
    "resume.career_copilot_intelligence_followup",
    "resume.career_copilot_intelligence_reframe",
    "resume.career_copilot_intelligence_rejection_insights",
    "resume.career_copilot_intelligence_weekly_digest",
    "resume.career_copilot_network_generate_intro",
    "resume.career_copilot_network_insights",
    "resume.career_copilot_offers_negotiate",
    # ── Beta lab (model-backed experiments) ───────────────────────────────
    "resume.beta_morning_brief",
    "resume.beta_similar_roles",
    # ── Gmail classification pass ─────────────────────────────────────────
    # Linking, listing and dismissing suggestions still work; only the sync
    # that runs messages through a model is retired.
    "resume.gmail_sync",
    # ── Jobs blueprint — generative helpers. Search / pipeline / catalogs
    #    are deterministic and stay live.
    "jobs.analyze",
    "jobs.tailor_resume",
    "jobs.draft_outreach_route",
    "jobs.suggest_pipeline_filters",
    "jobs.upload_resume",
    # ── Apply (Chrome extension answer generation) ────────────────────────
    "apply.generate_answer",
})


def sunset_guard():
    """`before_request` hook: 410 on retired endpoints, pass through otherwise.

    Returning None lets the request continue, which is what every kept
    endpoint does. CORS preflight is never blocked — OPTIONS has to succeed or
    the browser reports a CORS failure and the UI can't read our 410 body.
    """
    from flask import request

    if request.method == "OPTIONS":
        return None
    if request.endpoint in RETIRED_ENDPOINTS:
        return sunset_response()
    return None
