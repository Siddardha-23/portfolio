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


def _handle_async_resume_tailor(event):
    """Process a resume tailoring task invoked asynchronously."""
    task_id = event['task_id']
    jd_text = event['jd_text']
    logger.info(f"Async resume tailor task started: {task_id}")

    # Bootstrap Flask app so DB connections and config are available
    get_app()

    from services.resume_service import get_resume_service
    svc = get_resume_service()
    try:
        result = svc.full_tailor_pipeline(jd_text, task_id=task_id)
        svc.update_task(task_id, status='completed', result=result)
        logger.info(f"Async resume tailor task completed: {task_id}")
    except Exception as e:
        logger.error(f"Async resume tailor task failed ({task_id}): {e}", exc_info=True)
        svc.update_task(task_id, status='failed', error=str(e))

    return {'statusCode': 200}


def handler(event, context):
    """
    AWS Lambda handler function.

    Handles two types of invocations:
    1. API Gateway HTTP API v2.0 events (normal web requests)
    2. Async task events (fire-and-forget from Lambda self-invocation)

    Args:
        event: AWS Lambda event
        context: AWS Lambda context object

    Returns:
        dict: HTTP response in API Gateway format, or simple status for async tasks
    """
    # Route async task events before touching API Gateway handler
    if event.get('_async_task') == 'resume_tailor':
        return _handle_async_resume_tailor(event)

    try:
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
