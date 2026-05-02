from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
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
    Application factory for the infra microservice.

    Blueprints:
      - infra: AWS cost explorer, health dashboard, JD match, CI/CD sandbox
      - trace: Distributed request tracing with X-Ray integration
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
            xray_recorder.configure(service='infra-service')
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

    # Register blueprints

    # Infrastructure insights module (costs, health, JD match, sandbox)
    from blueprints.infra import infra_bp
    app.register_blueprint(infra_bp, url_prefix='/api/infra')

    # Request tracing module
    from blueprints.trace import trace_bp
    app.register_blueprint(trace_bp, url_prefix='/api/trace')

    # Preview environment proxy: routes /api/preview-route/<path> to the per-PR
    # API Gateway looked up in DynamoDB. Only useful when PREVIEW_ENABLED=true.
    if os.getenv('PREVIEW_ENABLED', 'false').lower() == 'true':
        from blueprints.preview_router import preview_router_bp
        app.register_blueprint(preview_router_bp, url_prefix='/api/preview-route')

    # JWT for admin endpoints (loaded lazily so local dev without JWT_SECRET still works)
    jwt_secret = os.getenv('JWT_SECRET_KEY')
    if not jwt_secret and os.getenv('SSM_JWT_SECRET') and os.getenv('USE_SSM_SECRETS', 'false').lower() == 'true':
        try:
            import boto3
            ssm = boto3.client('ssm', region_name=os.getenv('AWS_REGION_NAME', 'us-east-1'))
            jwt_secret = ssm.get_parameter(Name=os.getenv('SSM_JWT_SECRET'), WithDecryption=True)['Parameter']['Value']
        except Exception as e:
            logger.warning(f"Could not fetch JWT secret from SSM: {e}")
    if jwt_secret:
        app.config['JWT_SECRET_KEY'] = jwt_secret
        JWTManager(app)

    # Ephemeral preview env management (admin-gated)
    if os.getenv('PREVIEW_ENABLED', 'false').lower() == 'true':
        from blueprints.admin_environments import admin_envs_bp
        app.register_blueprint(admin_envs_bp, url_prefix='/api/admin/environments')

    # Health check endpoint
    @app.route('/api/health')
    def health():
        """Health check endpoint for monitoring"""
        return {
            'status': 'healthy',
            'service': 'infra-service',
            'version': '2.0.0'
        }, 200

    logger.info("Infra service initialized with infra and trace blueprints registered")
    return app


if __name__ == '__main__':
    app = create_app()
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=5000)
