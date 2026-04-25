"""
Local development gateway — runs ALL microservices as a single Flask app.

Usage:
    python local.py

All routes available at http://localhost:5000/api/*
"""

import sys
import os
from pathlib import Path

# ── Path setup ──────────────────────────────────────────────────────
# Add shared code (utils, models) and each service directory to sys.path.
# Python 3.12 namespace packages allow `blueprints` and `services` to span
# multiple directories, so `from blueprints.info import info_bp` finds the
# right file regardless of which service directory it lives in.

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir / 'shared' / 'python'))
for svc in ['visitor', 'auth', 'chat', 'infra', 'jobs-resume']:
    sys.path.insert(0, str(backend_dir / 'services' / svc))

# ── Load .env ───────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(backend_dir / '.env')

# ── Flask app ───────────────────────────────────────────────────────
import logging
from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from utils.config import AppConfig

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s:%(levelname)s:%(name)s:%(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)

    # JWT
    app.config['JWT_SECRET_KEY'] = AppConfig.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = AppConfig.JWT_ACCESS_TOKEN_EXPIRES

    # CORS
    allowed_origins = os.getenv(
        'ALLOWED_ORIGINS',
        'http://localhost:5173,http://localhost:5174,http://localhost:3000,http://127.0.0.1:5173'
    ).split(',')
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
    JWTManager(app)

    # Security headers
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '0'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    # ── Register ALL blueprints ─────────────────────────────────────
    # Namespace packages span all service dirs, so these imports just work.

    from blueprints.info import info_bp
    app.register_blueprint(info_bp, url_prefix='/api/info')

    from blueprints.contact import contact_bp
    app.register_blueprint(contact_bp, url_prefix='/api/contact')

    from blueprints.session import session_bp
    app.register_blueprint(session_bp, url_prefix='/api/session')

    from blueprints.geolocation import geo_bp
    app.register_blueprint(geo_bp, url_prefix='/api/geo')

    from blueprints.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    from blueprints.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    from blueprints.jobs import jobs_bp
    app.register_blueprint(jobs_bp, url_prefix='/api/jobs')

    from blueprints.resume import resume_bp
    app.register_blueprint(resume_bp, url_prefix='/api/resume')

    from blueprints.tech_chronicle import tech_chronicle_bp
    app.register_blueprint(tech_chronicle_bp, url_prefix='/api/tech-chronicle')

    from blueprints.chat import chat_bp
    app.register_blueprint(chat_bp, url_prefix='/api/chat')

    from blueprints.agent import agent_bp
    app.register_blueprint(agent_bp, url_prefix='/api/agent')

    from blueprints.infra import infra_bp
    app.register_blueprint(infra_bp, url_prefix='/api/infra')

    from blueprints.trace import trace_bp
    app.register_blueprint(trace_bp, url_prefix='/api/trace')

    # Health check
    @app.route('/api/health')
    def health():
        return {'status': 'healthy', 'service': 'local-gateway', 'version': '2.0.0'}, 200

    # API docs
    @app.route('/api')
    def api_docs():
        return {
            'name': 'Portfolio Backend API',
            'version': '2.0.0',
            'mode': 'local-development',
            'endpoints': {
                'auth':    '/api/auth',
                'info':    '/api/info',
                'contact': '/api/contact',
                'session': '/api/session',
                'geo':     '/api/geo',
                'chat':    '/api/chat',
                'jobs':    '/api/jobs',
                'resume':  '/api/resume',
                'tech-chronicle': '/api/tech-chronicle',
                'trace':   '/api/trace',
                'infra':   '/api/infra',
                'admin':   '/api/admin',
            }
        }, 200

    logger.info("Local gateway initialized - all blueprints registered")
    return app


if __name__ == '__main__':
    app = create_app()
    debug = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'
    port = int(os.getenv('PORT', '5000'))
    app.run(debug=debug, host='0.0.0.0', port=port)
