from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
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

# Only log to file if NOT running in Lambda/Cloud
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
    Application factory for the Auth microservice.

    Registers only the auth blueprint for authentication endpoints.
    """
    app = Flask(__name__)

    # Configuration
    app.config['JWT_SECRET_KEY'] = AppConfig.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = AppConfig.JWT_ACCESS_TOKEN_EXPIRES

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
    jwt = JWTManager(app)

    # X-Ray instrumentation (only in Lambda / production)
    if os.getenv('USE_SSM_SECRETS', 'false').lower() == 'true':
        try:
            from aws_xray_sdk.core import xray_recorder, patch_all
            from aws_xray_sdk.ext.flask.middleware import XRayMiddleware
            xray_recorder.configure(service='auth-service')
            XRayMiddleware(app, xray_recorder)
            patch_all()  # Auto-instruments pymongo, boto3, requests
            logger.info("X-Ray SDK initialized — Flask, PyMongo, boto3, requests instrumented")
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

    # Register only the auth blueprint
    from blueprints.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    # Health check endpoint
    @app.route('/api/health')
    def health():
        """Health check endpoint for monitoring"""
        return {
            'status': 'healthy',
            'service': 'auth-service',
            'version': '2.0.0'
        }, 200

    logger.info("Auth service initialized with auth blueprint registered")
    return app


if __name__ == '__main__':
    app = create_app()
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=5000)
