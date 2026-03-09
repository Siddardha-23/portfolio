"""
AWS Lambda Handler for Flask Application

This module wraps the Flask application with apig-wsgi to handle
AWS Lambda + API Gateway events. apig-wsgi translates API Gateway
HTTP API v2.0 payloads to WSGI requests that Flask understands.

Architecture:
    API Gateway (HTTP API) -> Lambda -> apig-wsgi -> Flask App -> MongoDB Atlas
"""

import logging
import os
import time as _time
import builtins

# Cold-start detection: module loads once per Lambda container
_module_load_time = _time.perf_counter()
_cold_start = True
# Persist cold start info for the /api/trace/pageload endpoint
# (by the time a user clicks "trace", the container is warm —
#  this preserves the original cold start timing)
_container_birth = {
    'cold_start_init_ms': 0,  # filled on first invocation
    'first_request_time': None,
    'container_id': None,
}

# Configure logging for Lambda
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s:%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)

# Lazy initialization to reduce cold start time
_app = None
_handler = None


def get_app():
    """
    Lazy initialization of Flask app.
    This helps reduce Lambda cold start time by only loading
    the application when needed.
    """
    global _app
    if _app is None:
        from app import create_app
        _app = create_app()
        logger.info("Flask application initialized for Lambda")
    return _app


def get_handler():
    """Get or create the apig-wsgi Lambda handler (lazy)."""
    global _handler
    if _handler is None:
        from apig_wsgi import make_lambda_handler
        _handler = make_lambda_handler(get_app(), binary_support=True)
    return _handler


def handler(event, context):
    """
    AWS Lambda handler function.

    Handles API Gateway HTTP API v2.0 events (normal web requests).

    Args:
        event: AWS Lambda event
        context: AWS Lambda context object

    Returns:
        dict: HTTP response in API Gateway format
    """
    try:
        global _cold_start
        _handler_start = _time.perf_counter()

        # Inject Lambda metadata so the /api/trace endpoint can read it
        init_duration = round((_handler_start - _module_load_time) * 1000, 2) if _cold_start else 0

        # Persist cold start info once (survives across warm invocations)
        if _cold_start:
            _container_birth['cold_start_init_ms'] = init_duration
            _container_birth['first_request_time'] = _handler_start
            _container_birth['container_id'] = getattr(context, 'aws_request_id', 'local') if context else 'local'

        builtins._lambda_meta = {
            'cold_start': _cold_start,
            'init_duration_ms': init_duration,
            'region': os.environ.get('AWS_REGION', 'local'),
            'memory_mb': int(os.environ.get('AWS_LAMBDA_MEMORY_SIZE', '0')),
            'function_name': os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'local-dev'),
            'request_id': getattr(context, 'aws_request_id', 'local') if context else 'local',
            'handler_start': _handler_start,
        }
        builtins._container_birth = _container_birth
        _cold_start = False

        # ── Async job invocation (from Lambda invoking itself) ──
        if event.get("async_job"):
            from services.resume_service import process_async_job
            process_async_job(event)
            return {"statusCode": 200, "body": "OK"}

        # ── Normal API Gateway request ──
        # Log request info (be careful about sensitive data in production)
        if os.getenv('ENVIRONMENT') != 'prod':
            logger.info(
                f"Incoming request: {event.get('requestContext', {}).get('http', {}).get('method')} "
                f"{event.get('rawPath')}"
            )

        return get_handler()(event, context)

    except Exception as e:
        logger.error(f"Lambda handler error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': os.getenv('ALLOWED_ORIGINS', 'https://manneharshithsiddardha.com').split(',')[0]
            },
            'body': '{"error": "Internal server error"}'
        }


# For local testing with SAM CLI or direct invocation
if __name__ == "__main__":
    # Test event for health check
    test_event = {
        "version": "2.0",
        "requestContext": {
            "http": {
                "method": "GET",
                "path": "/api/health"
            }
        },
        "rawPath": "/api/health",
        "isBase64Encoded": False
    }

    result = handler(test_event, None)
    print(f"Test result: {result}")
