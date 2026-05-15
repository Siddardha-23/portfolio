from flask import Flask, request
from flask_cors import CORS
from utils.config import AppConfig
import logging
import os

# Load environment variables
try:
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / '.env')
except ImportError:
    pass

# Configure logging
handlers = [logging.StreamHandler()]

if os.getenv('USE_SSM_SECRETS', 'false').lower() != 'true':
    handlers.append(logging.FileHandler('app.log'))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s:%(levelname)s:%(name)s:%(message)s',
    handlers=handlers
)

logger = logging.getLogger(__name__)


def create_app():
    """
    Application factory for the chat microservice.

    Registers only the chat blueprint (AI chatbot powered by Gemini).
    All chat endpoints are public — no JWT authentication required.
    """
    app = Flask(__name__)

    # Security: Restrict CORS to specific origins in production
    allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://localhost:3000').split(',')
    CORS(app, resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Disposition", "X-Trace-Id", "X-Amzn-Trace-Id", "Server-Timing"],
            "supports_credentials": True,
            "max_age": 3600
        }
    })

    # X-Ray instrumentation (only in Lambda / production)
    if os.getenv('USE_SSM_SECRETS', 'false').lower() == 'true':
        try:
            from aws_xray_sdk.core import xray_recorder, patch_all
            from aws_xray_sdk.ext.flask.middleware import XRayMiddleware
            xray_recorder.configure(service='chat-service')
            XRayMiddleware(app, xray_recorder)
            patch_all()
            logger.info("X-Ray SDK initialized — Flask, boto3, requests instrumented")
        except ImportError:
            logger.warning("aws-xray-sdk not installed, skipping X-Ray instrumentation")
        except Exception as e:
            logger.warning(f"X-Ray initialization failed: {e}")

    # Security headers on all responses
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '0'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    # Register legacy single-shot chat blueprint (kept for backwards compat)
    from blueprints.chat import chat_bp
    app.register_blueprint(chat_bp, url_prefix='/api/chat')

    # Register multi-agent orchestrator blueprint (SSE streaming + cloud diary)
    from blueprints.agent import agent_bp
    app.register_blueprint(agent_bp, url_prefix='/api/chat')

    # Register Concierge blueprint (animated avatar with tool calling).
    # Wrapped in try/except so a failure here can never kill the existing
    # /diary/latest, /specialists, or legacy /chat endpoints.
    try:
        from blueprints.concierge import concierge_bp
        app.register_blueprint(concierge_bp, url_prefix='/api/chat')
    except Exception as e:
        logger.error(f"Concierge blueprint failed to register (other endpoints unaffected): {e}", exc_info=True)

    # Health check endpoint
    @app.route('/api/health')
    def health():
        """Health check endpoint for monitoring"""
        return {
            'status': 'healthy',
            'service': 'chat-service',
            'version': '1.1.0'
        }, 200

    logger.info("Chat microservice initialized: legacy chat + multi-agent orchestrator")
    return app


if __name__ == '__main__':
    app = create_app()
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=5000)
