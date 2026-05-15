"""
WebSocket handler for the Concierge.

This module is invoked from lambda_handler.handler whenever the incoming
event is an API Gateway WebSocket event (detected by routeKey: $connect /
$disconnect / $default).

Protocol (single round-trip per turn):
    client → { "type": "turn", "message", "history", "current_section", "recruiter_mode" }
    server → { "type": "final", "envelope": ConciergeTurn }
    server → { "type": "error", "error": "<reason>" }

A "partial" message type is also supported for future progressive text
streaming (the model can be re-run with stream=True without changing the
client contract).

Why this matters:
    Even though the REST endpoint serves the same envelope, a persistent WS
    cuts ~80–150ms per turn of TLS+API Gateway+Lambda invoke overhead, which
    materially improves the avatar feel on slow networks. Frontend transport
    falls back to REST automatically if the WS handshake fails.

Infra:
    API Gateway WebSocket API with three routes ($connect, $disconnect,
    $default) all targeting this same chat Lambda. Connection metadata
    persists in DynamoDB (table name in WS_CONNECTIONS_TABLE) so we can fan
    out / cleanup, though the single-turn protocol does not require it.
"""
import json
import logging
import os
import time
from typing import Any, Dict, Optional

import boto3

logger = logging.getLogger(__name__)

_DDB = None
_APIGW_CACHE: Dict[str, Any] = {}


def _ddb():
    global _DDB
    if _DDB is None:
        _DDB = boto3.resource("dynamodb")
    return _DDB


def _table():
    name = os.getenv("WS_CONNECTIONS_TABLE")
    if not name:
        return None
    return _ddb().Table(name)


def _apigw_client(endpoint_url: str):
    if endpoint_url not in _APIGW_CACHE:
        _APIGW_CACHE[endpoint_url] = boto3.client(
            "apigatewaymanagementapi", endpoint_url=endpoint_url
        )
    return _APIGW_CACHE[endpoint_url]


def is_websocket_event(event: Dict[str, Any]) -> bool:
    if not isinstance(event, dict):
        return False
    rc = event.get("requestContext") or {}
    return "routeKey" in rc and "connectionId" in rc


def _management_endpoint(event: Dict[str, Any]) -> str:
    rc = event.get("requestContext", {})
    domain = rc.get("domainName")
    stage = rc.get("stage", "prod")
    return f"https://{domain}/{stage}"


def _send_to_connection(event: Dict[str, Any], payload: Dict[str, Any]) -> None:
    endpoint = _management_endpoint(event)
    conn_id = event["requestContext"]["connectionId"]
    client = _apigw_client(endpoint)
    try:
        client.post_to_connection(
            ConnectionId=conn_id,
            Data=json.dumps(payload).encode("utf-8"),
        )
    except client.exceptions.GoneException:
        # Client already disconnected; remove the stale row
        tbl = _table()
        if tbl is not None:
            try:
                tbl.delete_item(Key={"connection_id": conn_id})
            except Exception as e:
                logger.warning(f"failed to clean gone connection: {e}")
    except Exception as e:
        logger.error(f"post_to_connection failed: {e}")


def _on_connect(event: Dict[str, Any]) -> Dict[str, Any]:
    conn_id = event["requestContext"]["connectionId"]
    tbl = _table()
    if tbl is not None:
        try:
            tbl.put_item(Item={
                "connection_id": conn_id,
                "connected_at": int(time.time()),
                # TTL: 1 hour — cheap garbage collection for orphaned rows
                "ttl": int(time.time()) + 3600,
                "source_ip": (event.get("requestContext", {})
                              .get("identity", {})
                              .get("sourceIp", "")),
            })
        except Exception as e:
            logger.warning(f"DDB put on connect failed: {e}")
    return {"statusCode": 200, "body": "ok"}


def _on_disconnect(event: Dict[str, Any]) -> Dict[str, Any]:
    conn_id = event["requestContext"]["connectionId"]
    tbl = _table()
    if tbl is not None:
        try:
            tbl.delete_item(Key={"connection_id": conn_id})
        except Exception as e:
            logger.warning(f"DDB delete on disconnect failed: {e}")
    return {"statusCode": 200, "body": "ok"}


def _parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except Exception:
            raw = "{}"
    try:
        return json.loads(raw) or {}
    except json.JSONDecodeError:
        return {}


def _on_default(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle a turn request from the client."""
    data = _parse_body(event)
    msg_type = data.get("type")
    if msg_type != "turn":
        _send_to_connection(event, {"type": "error", "error": "unknown_message_type"})
        return {"statusCode": 400, "body": "bad message"}

    # Rate limit by sourceIp using the existing in-memory limiter
    try:
        from utils.security import get_rate_limiter, InputSanitizer
    except Exception:
        InputSanitizer = None  # type: ignore
        get_rate_limiter = None  # type: ignore

    source_ip = (event.get("requestContext", {})
                 .get("identity", {})
                 .get("sourceIp", "ws"))
    if get_rate_limiter is not None:
        limiter = get_rate_limiter()
        if limiter.is_rate_limited(f"concierge_ws:{source_ip}", max_requests=8, window_seconds=60):
            _send_to_connection(event, {"type": "error", "error": "rate_limited"})
            return {"statusCode": 429, "body": "rate limited"}

    # Sanitize inputs (mirror REST endpoint validation)
    raw_message = data.get("message", "")
    if InputSanitizer is None:
        message = str(raw_message)[:500]
    else:
        if InputSanitizer.check_nosql_injection(raw_message):
            _send_to_connection(event, {"type": "error", "error": "invalid_input"})
            return {"statusCode": 400, "body": "invalid"}
        message = InputSanitizer.sanitize_string(raw_message, max_length=500)
    if not message:
        _send_to_connection(event, {"type": "error", "error": "empty_message"})
        return {"statusCode": 400, "body": "empty"}

    history = []
    raw_hist = data.get("history") or []
    if isinstance(raw_hist, list):
        for entry in raw_hist[:16]:
            if not isinstance(entry, dict):
                continue
            r = entry.get("role"); c = entry.get("content")
            if r in ("user", "model") and isinstance(c, str):
                if InputSanitizer is not None:
                    c = InputSanitizer.sanitize_string(c, max_length=2000)
                if c:
                    history.append({"role": r, "content": c})

    section = str(data.get("current_section") or "")[:32] or None
    recruiter_mode = bool(data.get("recruiter_mode"))

    # Run the same service that the REST endpoint uses
    try:
        from services.concierge_service import (
            generate_concierge_turn,
            resolve_tailor_resume_intent,
        )
        envelope = generate_concierge_turn(
            message=message,
            history=history,
            current_section=section,
            recruiter_mode=recruiter_mode,
        )
        for it in envelope.get("intents", []):
            if it["name"] == "tailor_resume_to_jd":
                payload = resolve_tailor_resume_intent(it["args"].get("jd_text", ""))
                if payload:
                    envelope["display"] = {"type": "JDMatchCard", "payload": payload}
                break

        _send_to_connection(event, {"type": "final", "envelope": envelope})
        return {"statusCode": 200, "body": "ok"}
    except Exception as e:
        logger.exception(f"WS concierge error: {e}")
        _send_to_connection(event, {"type": "error", "error": "internal_error"})
        return {"statusCode": 200, "body": "ok"}


def handle(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Dispatch a WebSocket event to the right handler."""
    route = event.get("requestContext", {}).get("routeKey", "$default")
    if route == "$connect":
        return _on_connect(event)
    if route == "$disconnect":
        return _on_disconnect(event)
    return _on_default(event)
