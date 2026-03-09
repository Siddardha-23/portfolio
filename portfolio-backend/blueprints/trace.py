"""
Trace blueprint — real-time distributed tracing endpoint.

Returns server-side timing instrumentation so the frontend can render
a waterfall diagram of the full request path:
    Browser → CloudFront → API Gateway → Lambda → Flask → MongoDB

When running on Lambda with X-Ray Active, the endpoint also returns the
X-Ray trace ID and a deep link to the AWS X-Ray console.
"""

from flask import Blueprint, jsonify, request
import uuid
import time
import os
import logging
from datetime import datetime, timezone

trace_bp = Blueprint('trace', __name__)
logger = logging.getLogger(__name__)


@trace_bp.route('', methods=['GET'])
def trace_request():
    """
    Instrument and return timing data for a single request hop-by-hop.

    The frontend merges this with browser Resource Timing API data
    (DNS, TCP/TLS, TTFB, download) to produce a full waterfall.
    """
    t_start = time.perf_counter()
    trace_id = str(uuid.uuid4())

    # ── Lambda metadata (injected by lambda_handler.py) ──
    import builtins
    lambda_meta = getattr(builtins, '_lambda_meta', None)

    cold_start = False
    lambda_init_ms = 0
    region = os.environ.get('AWS_REGION', 'local')
    memory_mb = int(os.environ.get('AWS_LAMBDA_MEMORY_SIZE', '0'))
    function_name = os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'local-dev')
    request_id = 'local'

    if lambda_meta:
        cold_start = lambda_meta.get('cold_start', False)
        lambda_init_ms = lambda_meta.get('init_duration_ms', 0)
        region = lambda_meta.get('region', region)
        memory_mb = lambda_meta.get('memory_mb', memory_mb)
        function_name = lambda_meta.get('function_name', function_name)
        request_id = lambda_meta.get('request_id', request_id)

    # ── Flask routing time (time from start to here) ──
    t_after_routing = time.perf_counter()
    flask_routing_ms = round((t_after_routing - t_start) * 1000, 2)

    # ── MongoDB ping (real round-trip to Atlas) ──
    db_ping_ms = 0
    db_status = 'ok'
    try:
        from utils.db_connect import DBConnect
        db = DBConnect()
        t_db_start = time.perf_counter()
        db.get_db().command('ping')
        t_db_end = time.perf_counter()
        db_ping_ms = round((t_db_end - t_db_start) * 1000, 2)
    except Exception as e:
        db_status = f'error: {str(e)[:80]}'
        logger.warning(f"Trace DB ping failed: {e}")

    # ── X-Ray trace ID (set by Lambda runtime when X-Ray Active) ──
    xray_trace_id = os.environ.get('_X_AMZN_TRACE_ID', '')
    xray_trace_id_clean = ''
    xray_console_url = ''

    if xray_trace_id:
        # Format: Root=1-xxxxx-xxxxxxxxxxxx;Parent=xxxx;Sampled=1
        parts = dict(p.split('=', 1) for p in xray_trace_id.split(';') if '=' in p)
        root = parts.get('Root', '')
        if root:
            xray_trace_id_clean = root
            xray_console_url = (
                f"https://console.aws.amazon.com/xray/home"
                f"?region={region}#/traces/{root}"
            )

    # ── Total server time ──
    t_end = time.perf_counter()
    total_ms = round((t_end - t_start) * 1000, 2)

    response_data = {
        'trace_id': trace_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'cold_start': cold_start,
        'server': {
            'total_ms': total_ms,
            'lambda_init_ms': lambda_init_ms,
            'flask_routing_ms': flask_routing_ms,
            'db_ping_ms': db_ping_ms,
            'db_status': db_status,
        },
        'lambda': {
            'region': region,
            'memory_mb': memory_mb,
            'function_name': function_name,
            'request_id': request_id,
        },
        'xray': {
            'trace_id': xray_trace_id_clean,
            'console_url': xray_console_url,
            'enabled': bool(xray_trace_id),
        },
    }

    resp = jsonify(response_data)
    resp.headers['X-Trace-Id'] = trace_id
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return resp, 200


@trace_bp.route('/deep', methods=['GET'])
def trace_deep_request():
    """
    Deep trace: runs real MongoDB aggregation queries used to power the
    portfolio's data sections (visitor counts, org stats, LinkedIn profiles,
    map locations).  Returns individual timing for each DB operation so the
    frontend can render a realistic waterfall showing actual data-layer
    latency.
    """
    t_start = time.perf_counter()
    trace_id = str(uuid.uuid4())

    # ── Lambda metadata ──
    import builtins
    lambda_meta = getattr(builtins, '_lambda_meta', None)

    cold_start = False
    lambda_init_ms = 0
    region = os.environ.get('AWS_REGION', 'local')
    memory_mb = int(os.environ.get('AWS_LAMBDA_MEMORY_SIZE', '0'))
    function_name = os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'local-dev')
    request_id = 'local'

    if lambda_meta:
        cold_start = lambda_meta.get('cold_start', False)
        lambda_init_ms = lambda_meta.get('init_duration_ms', 0)
        region = lambda_meta.get('region', region)
        memory_mb = lambda_meta.get('memory_mb', memory_mb)
        function_name = lambda_meta.get('function_name', function_name)
        request_id = lambda_meta.get('request_id', request_id)

    t_after_routing = time.perf_counter()
    flask_routing_ms = round((t_after_routing - t_start) * 1000, 2)

    # ── Real DB queries (mirrors org-stats endpoint) ──
    queries = []
    data_results = {}

    try:
        from utils.db_connect import DBConnect
        from services.visitor_service import get_visitor_service
        db = DBConnect().get_db()

        # 1. Unique visitor count (fingerprint dedup)
        t0 = time.perf_counter()
        visitor_service = get_visitor_service()
        unique_visitors = visitor_service.get_unique_visitor_count()
        t1 = time.perf_counter()
        queries.append({
            'name': 'Unique Visitors',
            'collection': 'visitor_info',
            'operation': 'distinct + count',
            'ms': round((t1 - t0) * 1000, 2),
            'result': unique_visitors,
        })
        data_results['unique_visitors'] = unique_visitors

        # 2. Registered visitor count
        t0 = time.perf_counter()
        total_registered = db.registered_visitors.count_documents({})
        t1 = time.perf_counter()
        queries.append({
            'name': 'Registered Count',
            'collection': 'registered_visitors',
            'operation': 'count_documents',
            'ms': round((t1 - t0) * 1000, 2),
            'result': total_registered,
        })
        data_results['total_registered'] = total_registered

        # 3. Organization aggregation pipeline
        t0 = time.perf_counter()
        org_pipeline = [
            {"$match": {"email": {"$exists": True, "$regex": "@", "$ne": ""}}},
            {"$addFields": {"_email_domain": {"$toLower": {"$arrayElemAt": [{"$split": [{"$ifNull": ["$email", ""]}, "@"]}, 1]}}}},
            {"$addFields": {
                "org_key": {"$cond": [
                    {"$and": [{"$ne": ["$organization", None]}, {"$gt": [{"$strLenCP": {"$ifNull": ["$organization", ""]}}, 0]}]},
                    {"$toLower": {"$ifNull": ["$organization", ""]}},
                    None
                ]}
            }},
            {"$match": {"org_key": {"$nin": [None, ""]}}},
            {"$group": {"_id": "$org_key", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        org_results = list(db.registered_visitors.aggregate(org_pipeline))
        t1 = time.perf_counter()
        queries.append({
            'name': 'Org Aggregation',
            'collection': 'registered_visitors',
            'operation': 'aggregate (group by org)',
            'ms': round((t1 - t0) * 1000, 2),
            'result': len(org_results),
        })
        data_results['organizations'] = len(org_results)

        # 4. LinkedIn profiles found
        t0 = time.perf_counter()
        linkedin_found = db.linkedin_profiles.count_documents({"found": True})
        t1 = time.perf_counter()
        queries.append({
            'name': 'LinkedIn Profiles',
            'collection': 'linkedin_profiles',
            'operation': 'count_documents (found=true)',
            'ms': round((t1 - t0) * 1000, 2),
            'result': linkedin_found,
        })
        data_results['linkedin_found'] = linkedin_found

        # 5. Map locations aggregation (heaviest query)
        t0 = time.perf_counter()
        map_pipeline = [
            {"$match": {"geo.country": {"$exists": True, "$nin": [None, ""]}}},
            {"$group": {
                "_id": {"country": "$geo.country", "city": {"$ifNull": ["$geo.city", ""]}},
                "count": {"$sum": 1},
                "lat": {"$first": "$ip_info.latitude"},
                "lng": {"$first": "$ip_info.longitude"}
            }},
            {"$sort": {"count": -1}}
        ]
        map_results = list(db.registered_visitors.aggregate(map_pipeline))
        t1 = time.perf_counter()
        queries.append({
            'name': 'Map Locations',
            'collection': 'registered_visitors',
            'operation': 'aggregate (geo grouping)',
            'ms': round((t1 - t0) * 1000, 2),
            'result': len(map_results),
        })
        data_results['map_locations'] = len(map_results)

        db_status = 'ok'
    except Exception as e:
        db_status = f'error: {str(e)[:80]}'
        logger.warning(f"Deep trace DB queries failed: {e}")

    # ── X-Ray trace ID ──
    xray_trace_id = os.environ.get('_X_AMZN_TRACE_ID', '')
    xray_trace_id_clean = ''
    xray_console_url = ''
    if xray_trace_id:
        parts = dict(p.split('=', 1) for p in xray_trace_id.split(';') if '=' in p)
        root = parts.get('Root', '')
        if root:
            xray_trace_id_clean = root
            xray_console_url = (
                f"https://console.aws.amazon.com/xray/home"
                f"?region={region}#/traces/{root}"
            )

    t_end = time.perf_counter()
    total_ms = round((t_end - t_start) * 1000, 2)
    total_db_ms = round(sum(q['ms'] for q in queries), 2)

    response_data = {
        'trace_id': trace_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'cold_start': cold_start,
        'server': {
            'total_ms': total_ms,
            'lambda_init_ms': lambda_init_ms,
            'flask_routing_ms': flask_routing_ms,
            'total_db_ms': total_db_ms,
            'db_status': db_status,
        },
        'queries': queries,
        'data': data_results,
        'lambda': {
            'region': region,
            'memory_mb': memory_mb,
            'function_name': function_name,
            'request_id': request_id,
        },
        'xray': {
            'trace_id': xray_trace_id_clean,
            'console_url': xray_console_url,
            'enabled': bool(xray_trace_id),
        },
    }

    resp = jsonify(response_data)
    resp.headers['X-Trace-Id'] = trace_id
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return resp, 200
