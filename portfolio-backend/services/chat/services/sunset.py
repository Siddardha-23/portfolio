"""AI sunset for the chat service — Concierge / Builder Agent retired.

`bedrock:InvokeModel` is revoked on the Lambda execution role, so every model
call in this service now fails at IAM. Rather than let visitors watch the
avatar spin and then say "Something glitched", each endpoint short-circuits to
a written answer that explains what happened and points at Aspirely.

Deliberately duplicated from `services/jobs-resume/services/sunset.py` instead
of hoisted into the shared layer: these are two independently-deployed
Lambdas, and five string constants are not worth coupling their release
cycles over.

Endpoints that still work untouched: /api/chat/diary, /api/chat/diary/latest
(the Now Building ticker reads stored entries — no model involved) and
/api/chat/specialists (static metadata).
"""

NEW_PRODUCT_NAME = "Aspirely"
NEW_PRODUCT_URL = "https://aspirely.me"

SUNSET_CODE = "ai_features_moved"

#: Spoken/rendered by the Concierge and the legacy chatbot. Written to be read
#: aloud by TTS as well as displayed, so: no URLs mid-sentence, no markdown.
SUNSET_REPLY = (
    "I've been retired from this site. The AI here — me, resume tailoring, "
    "cover letters, ATS scoring, interview prep — all moved to Aspirely, at "
    "aspirely dot me. Everything you'd saved is still safe, and job search on "
    "this portfolio still works. The rest of the portfolio is unchanged, so "
    "have a look around."
)

#: Short form for the caption line under the avatar.
SUNSET_CAPTION = f"AI features moved to {NEW_PRODUCT_URL}"


def concierge_envelope() -> dict:
    """Sunset turn in the Concierge's response shape.

    Returned with HTTP 200 and `success: True` on purpose — this is a real,
    intended answer, not a failure. A non-200 or `success: False` would make
    the frontend render its error state and hide the message we want read.
    """
    return {
        "spoken": SUNSET_REPLY,
        "caption": SUNSET_CAPTION,
        "intents": [],
        "display": None,
        "suggestions": [
            f"Open {NEW_PRODUCT_NAME}",
            "Browse the portfolio",
        ],
        "emotion": "thoughtful",
        "meta": {
            "sunset": True,
            "code": SUNSET_CODE,
            "moved_to": NEW_PRODUCT_URL,
        },
        "success": True,
    }
