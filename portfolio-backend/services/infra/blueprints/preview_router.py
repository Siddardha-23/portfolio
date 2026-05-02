"""
Preview environment router.

The preview CloudFront distribution rewrites incoming /api/<path> from a
{slug}.preview.{domain} origin into /api/preview-route/<path>, then forwards
to the prod API Gateway. This blueprint handles those rewritten requests by
looking up the per-PR API Gateway endpoint in DynamoDB and proxying the
request to the correct preview Lambda.

Flow:
  Browser  -> https://{slug}.preview.{domain}/api/visitor/info
  CF func  -> sets X-Preview-Slug, rewrites uri to /api/preview-route/visitor/info
  CloudFront -> prod API Gateway (origin)
  prod API GW route ANY /api/preview-route/{proxy+} -> infra Lambda (this blueprint)
  blueprint -> DDB.get_item(branch_slug=<slug>) -> api_url
  blueprint -> requests.{method}(api_url + /api/visitor/info) -> per-PR API GW
  per-PR API GW -> per-PR visitor Lambda -> per-PR Mongo db
"""
from __future__ import annotations

import logging
import os
from urllib.parse import urlencode

import boto3
import requests
from flask import Blueprint, Response, request

logger = logging.getLogger(__name__)

preview_router_bp = Blueprint("preview_router", __name__)

# Headers that must not be forwarded (hop-by-hop or set by the proxied target).
_HOP_BY_HOP = frozenset({
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
})

_DDB_TABLE = os.getenv("PREVIEW_DDB_TABLE", "portfolio-ephemeral-envs")
_TIMEOUT_SECS = 28  # API GW caps at 30s; leave a small headroom.

_ddb = boto3.client("dynamodb", region_name=os.getenv("AWS_REGION_NAME", "us-east-1"))


def _resolve_api_url(slug: str) -> str | None:
    try:
        resp = _ddb.get_item(
            TableName=_DDB_TABLE,
            Key={"branch_slug": {"S": slug}},
            ProjectionExpression="api_url",
        )
    except Exception:
        logger.exception("DDB lookup failed for slug=%s", slug)
        return None
    item = resp.get("Item")
    if not item or "api_url" not in item:
        return None
    return item["api_url"]["S"]


def _filter_request_headers() -> dict[str, str]:
    return {k: v for k, v in request.headers.items() if k.lower() not in _HOP_BY_HOP}


def _filter_response_headers(headers) -> list[tuple[str, str]]:
    return [(k, v) for k, v in headers.items() if k.lower() not in _HOP_BY_HOP]


@preview_router_bp.route(
    "/<path:subpath>",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
def proxy(subpath: str):
    slug = request.headers.get("X-Preview-Slug")
    if not slug:
        return {"error": "Missing X-Preview-Slug header"}, 400

    api_url = _resolve_api_url(slug)
    if not api_url:
        return {"error": f"No active preview env for slug: {slug}"}, 404

    # api_url is the per-PR API GW endpoint, e.g. https://abc.execute-api.us-east-1.amazonaws.com.
    # subpath is the original path minus the /api/preview-route/ prefix, e.g. "visitor/info".
    # Reattach the /api/ prefix that the per-PR API GW expects.
    target = f"{api_url.rstrip('/')}/api/{subpath}"
    if request.query_string:
        target = f"{target}?{request.query_string.decode()}"

    try:
        upstream = requests.request(
            method=request.method,
            url=target,
            headers=_filter_request_headers(),
            data=request.get_data(),
            allow_redirects=False,
            timeout=_TIMEOUT_SECS,
            stream=True,
        )
    except requests.Timeout:
        logger.warning("Upstream timeout slug=%s target=%s", slug, target)
        return {"error": "preview upstream timed out"}, 504
    except requests.RequestException:
        logger.exception("Upstream proxy failed slug=%s target=%s", slug, target)
        return {"error": "preview upstream error"}, 502

    # Stream chunks instead of buffering whole body in memory. Note: API Gateway
    # HTTP API integrations buffer the full response before returning, so SSE /
    # text/event-stream endpoints will not stream incrementally end-to-end —
    # they'll arrive as one batch. Streaming here at least keeps memory bounded
    # and supports large response bodies.
    def _iter_body():
        try:
            for chunk in upstream.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    return Response(
        _iter_body(),
        status=upstream.status_code,
        headers=_filter_response_headers(upstream.headers),
    )
