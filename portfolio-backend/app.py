from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from utils.config import AppConfig
import logging
import os

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Configure logging
# Configure logging
handlers = [logging.StreamHandler()]

# Only log to file if NOT running in Lambda/Cloud (or if explicitly enabled)
# Assuming local dev doesn't set USE_SSM_SECRETS (or sets it to false)
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
    Application factory pattern.
    
    This is the entry point for the Flask application.
    All services are organized in a microservice-like architecture:
    
    - blueprints/: Route handlers organized by feature
        - auth.py: Authentication endpoints
        - contact.py: Contact form handling
        - info.py: Visitor tracking and analytics
        - session.py: Session management
        - geolocation.py: IP geolocation services
        - chat.py: AI chatbot (Gemini)
    
    - services/: Business logic layer (service classes)
        - session_service.py: Session management logic
        - ip_service.py: IP geolocation with ipinfo.io
        - visitor_service.py: Visitor tracking logic
    
    - models/: Data models
    - utils/: Configuration and utilities
    """
    app = Flask(__name__)
    
    # Configuration
    app.config['JWT_SECRET_KEY'] = AppConfig.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = AppConfig.JWT_ACCESS_TOKEN_EXPIRES
    
    # Security: Restrict CORS to specific origins in production
    allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',')
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
            xray_recorder.configure(service='portfolio-backend')
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

    # Register blueprints - organized by feature/domain
    
    # Authentication module
    from blueprints.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    # Visitor tracking module
    from blueprints.info import info_bp
    app.register_blueprint(info_bp, url_prefix='/api/info')
    
    # Contact form module
    from blueprints.contact import contact_bp
    app.register_blueprint(contact_bp, url_prefix='/api/contact')
    
    # Session management module
    from blueprints.session import session_bp
    app.register_blueprint(session_bp, url_prefix='/api/session')
    
    # IP Geolocation module
    from blueprints.geolocation import geo_bp
    app.register_blueprint(geo_bp, url_prefix='/api/geo')

    # AI Chatbot module
    from blueprints.chat import chat_bp
    app.register_blueprint(chat_bp, url_prefix='/api/chat')

    # Job Search module
    from blueprints.jobs import jobs_bp
    app.register_blueprint(jobs_bp, url_prefix='/api/jobs')

    # Resume Tailor module
    from blueprints.resume import resume_bp
    app.register_blueprint(resume_bp, url_prefix='/api/resume')

    # Request tracing module
    from blueprints.trace import trace_bp
    app.register_blueprint(trace_bp, url_prefix='/api/trace')

    # Health check endpoint
    @app.route('/api/health')
    def health():
        """Health check endpoint for monitoring"""
        return {
            'status': 'healthy',
            'service': 'portfolio-backend',
            'version': '2.0.0'
        }, 200
    
    # API documentation endpoint
    @app.route('/api')
    def api_docs():
        """List available API endpoints"""
        return {
            'name': 'Portfolio Backend API',
            'version': '2.0.0',
            'endpoints': {
                'auth': {
                    'prefix': '/api/auth',
                    'description': 'Authentication and user management'
                },
                'info': {
                    'prefix': '/api/info',
                    'description': 'Visitor tracking and analytics'
                },
                'contact': {
                    'prefix': '/api/contact',
                    'description': 'Contact form handling'
                },
                'session': {
                    'prefix': '/api/session',
                    'description': 'Session management and validation'
                },
                'geo': {
                    'prefix': '/api/geo',
                    'description': 'IP geolocation services'
                },
                'chat': {
                    'prefix': '/api/chat',
                    'description': 'AI chatbot powered by Gemini'
                },
                'jobs': {
                    'prefix': '/api/jobs',
                    'description': 'Job search dashboard'
                },
                'resume': {
                    'prefix': '/api/resume',
                    'description': 'Resume tailoring and ATS analysis'
                },
                'trace': {
                    'prefix': '/api/trace',
                    'description': 'Distributed request tracing with X-Ray integration'
                }
            }
        }, 200
    
    logger.info("Application initialized with all blueprints registered")
    return app


if __name__ == '__main__':
    app = create_app()
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=5000)
