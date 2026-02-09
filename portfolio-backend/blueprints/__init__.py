"""
Blueprints Package - Route handlers organized by feature/domain

This package contains Flask blueprints organized in a microservice-like pattern:

- auth.py: Authentication and user management
    POST /api/auth/login
    POST /api/auth/register
    GET  /api/auth/profile
    GET  /api/auth/verify

- contact.py: Contact form handling
    POST /api/contact
    GET  /api/contact/messages (protected)

- info.py: Visitor tracking and analytics
    POST /api/info
    POST /api/info/register-visitor
    GET  /api/info/stats (protected)
    GET  /api/info/org-stats

- session.py: Session management
    POST /api/session/validate
    POST /api/session/track-page
    GET  /api/session/stats (protected)

- geolocation.py: IP geolocation services
    POST /api/geo/lookup
    GET  /api/geo/my-ip
    GET  /api/geo/stats (protected)
"""

from .auth import auth_bp
from .contact import contact_bp
from .info import info_bp
from .session import session_bp
from .geolocation import geo_bp

__all__ = ['auth_bp', 'contact_bp', 'info_bp', 'session_bp', 'geo_bp']
