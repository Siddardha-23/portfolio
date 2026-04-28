"""
Admin Environments blueprint - dashboard backend for ephemeral preview envs.

Endpoints (all require super-admin JWT):
  GET    /api/admin/environments                    -> list active preview envs
  GET    /api/admin/environments/<slug>             -> single env detail
  POST   /api/admin/environments/<slug>/teardown    -> trigger preview-down.yml

Source of truth:
  - DynamoDB row per slug (PREVIEW_DDB_TABLE) is the operational index.
  - With ?fresh=true, the list endpoint reconciles against AWS resource tags
    (ResourceGroupsTaggingAPI) so orphaned rows are surfaced.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from functools import wraps

import boto3
import requests
from botocore.exceptions import ClientError
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

logger = logging.getLogger(__name__)

admin_envs_bp = Blueprint("admin_environments", __name__)

SUPER_ADMIN_EMAIL = "mannesiddardha@gmail.com"
DDB_TABLE = os.getenv("PREVIEW_DDB_TABLE", "")
PREVIEW_ENABLED = os.getenv("PREVIEW_ENABLED", "false").lower() == "true"
AWS_REGION = os.getenv("AWS_REGION_NAME", "us-east-1")


def _super_admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if get_jwt_identity() != SUPER_ADMIN_EMAIL:
            return jsonify({"error": "Forbidden"}), 403
        if not PREVIEW_ENABLED:
            return jsonify({"error": "Preview envs are disabled"}), 503
        return fn(*args, **kwargs)
    return wrapper


def _ddb():
    return boto3.client("dynamodb", region_name=AWS_REGION)


def _ssm_value(env_var: str) -> str:
    name = os.getenv(env_var, "")
    if not name:
        return ""
    try:
        ssm = boto3.client("ssm", region_name=AWS_REGION)
        return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]
    except ClientError as e:
        logger.warning("ssm fetch failed for %s: %s", env_var, e)
        return ""


def _row_to_dict(item: dict) -> dict:
    """Flatten a DynamoDB AttributeValue map into plain JSON."""
    out: dict = {}
    for k, v in item.items():
        if "S" in v:
            out[k] = v["S"]
        elif "N" in v:
            try:
                out[k] = int(v["N"])
            except ValueError:
                out[k] = float(v["N"])
        elif "BOOL" in v:
            out[k] = v["BOOL"]
        elif "NULL" in v:
            out[k] = None
        else:
            out[k] = v
    return out


def _list_from_ddb() -> list[dict]:
    if not DDB_TABLE:
        return []
    rows: list[dict] = []
    paginator = _ddb().get_paginator("scan")
    for page in paginator.paginate(TableName=DDB_TABLE):
        for item in page.get("Items", []):
            rows.append(_row_to_dict(item))
    return rows


def _list_from_tags() -> list[dict]:
    """Use ResourceGroupsTaggingAPI as the source of truth for what exists."""
    client = boto3.client("resourcegroupstaggingapi", region_name=AWS_REGION)
    paginator = client.get_paginator("get_resources")
    by_slug: dict[str, dict] = {}
    for page in paginator.paginate(
        TagFilters=[{"Key": "Purpose", "Values": ["ephemeral-previews"]}]
    ):
        for r in page.get("ResourceTagMappingList", []):
            tags = {t["Key"]: t["Value"] for t in r.get("Tags", [])}
            slug = tags.get("EphemeralBranch")
            if not slug:
                continue
            entry = by_slug.setdefault(slug, {
                "branch_slug": slug,
                "pr_number": tags.get("PR"),
                "head_ref": tags.get("HeadRef"),
                "actor": tags.get("Actor"),
                "resource_arns": [],
            })
            entry["resource_arns"].append(r["ResourceARN"])
    return list(by_slug.values())


def _reconcile(rows: list[dict], tag_view: list[dict]) -> list[dict]:
    """Mark any DDB row missing from tag_view as 'orphaned' and add tag-only entries."""
    by_slug = {r["branch_slug"]: r for r in rows}
    tag_slugs = {t["branch_slug"] for t in tag_view}
    for slug, row in by_slug.items():
        if slug not in tag_slugs and row.get("status") != "destroyed":
            row["status"] = "orphaned-ddb"
    for t in tag_view:
        if t["branch_slug"] not in by_slug:
            t["status"] = "orphaned-aws"
            rows.append(t)
    return rows


@admin_envs_bp.route("", methods=["GET"])
@admin_envs_bp.route("/", methods=["GET"])
@_super_admin_required
def list_environments():
    fresh = request.args.get("fresh", "false").lower() == "true"
    rows = _list_from_ddb()
    if fresh:
        try:
            tag_view = _list_from_tags()
            rows = _reconcile(rows, tag_view)
        except ClientError as e:
            logger.warning("tag reconciliation failed: %s", e)
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return jsonify({"environments": rows, "count": len(rows)}), 200


@admin_envs_bp.route("/<slug>", methods=["GET"])
@_super_admin_required
def get_environment(slug):
    if not DDB_TABLE:
        return jsonify({"error": "DDB table not configured"}), 503
    resp = _ddb().get_item(
        TableName=DDB_TABLE,
        Key={"branch_slug": {"S": slug}},
    )
    item = resp.get("Item")
    if not item:
        return jsonify({"error": "not found"}), 404
    return jsonify(_row_to_dict(item)), 200


@admin_envs_bp.route("/<slug>/teardown", methods=["POST"])
@_super_admin_required
def teardown(slug):
    pat = _ssm_value("SSM_PREVIEW_GITHUB_PAT")
    repo = _ssm_value("SSM_PREVIEW_GITHUB_REPO")
    if not pat or not repo:
        return jsonify({"error": "GitHub PAT/repo not configured for teardown"}), 503

    url = f"https://api.github.com/repos/{repo}/actions/workflows/preview-down.yml/dispatches"
    payload = {
        "ref": "main",
        "inputs": {"branch_slug": slug},
    }
    headers = {
        "Authorization": f"Bearer {pat}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    r = requests.post(url, headers=headers, json=payload, timeout=10)
    if r.status_code >= 300:
        logger.error("workflow_dispatch failed: %s %s", r.status_code, r.text[:200])
        return jsonify({"error": "GitHub workflow_dispatch failed", "status": r.status_code}), 502

    # Optimistic local update
    try:
        _ddb().update_item(
            TableName=DDB_TABLE,
            Key={"branch_slug": {"S": slug}},
            UpdateExpression="SET #s = :s, last_seen_at = :t",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":s": {"S": "destroying"},
                ":t": {"S": datetime.now(timezone.utc).isoformat()},
            },
        )
    except ClientError as e:
        logger.warning("ddb status update failed: %s", e)

    return jsonify({"ok": True, "slug": slug, "status": "destroying"}), 202
