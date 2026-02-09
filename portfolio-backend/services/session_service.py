"""
Session Service - Manages visitor sessions to prevent duplicate database entries

This service handles:
- Session ID generation and validation
- Session-based deduplication of visitor entries
- Session expiry management
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from utils.db_connect import DBConnect

logger = logging.getLogger(__name__)


class SessionService:
    """Service for managing visitor sessions"""
    
    # Session expiry time in hours (configurable)
    SESSION_EXPIRY_HOURS = 24
    
    def __init__(self):
        self.db = DBConnect().get_db()
        self.collection = self.db.sessions
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Ensure proper indexes exist for performance"""
        try:
            # Index on session_id for fast lookups
            self.collection.create_index("session_id", unique=True)
            # TTL index for automatic session cleanup
            self.collection.create_index(
                "created_at", 
                expireAfterSeconds=self.SESSION_EXPIRY_HOURS * 3600
            )
        except Exception as e:
            logger.warning(f"Index creation warning (may already exist): {e}")
    
    def validate_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Validate a session ID and return session data if valid.
        
        Args:
            session_id: The session ID to validate
            
        Returns:
            Session document if valid, None otherwise
        """
        if not session_id:
            return None
            
        try:
            session = self.collection.find_one({"session_id": session_id})
            if session:
                # Check if session is still valid (within expiry window)
                expiry_time = session['created_at'] + timedelta(hours=self.SESSION_EXPIRY_HOURS)
                if datetime.utcnow() < expiry_time:
                    return session
            return None
        except Exception as e:
            logger.error(f"Error validating session: {e}")
            return None
    
    def create_or_get_session(self, session_id: str, ip_address: str, 
                               user_agent: str = None) -> Dict[str, Any]:
        """
        Create a new session or return existing one.
        
        Args:
            session_id: Client-provided session ID
            ip_address: Visitor's IP address
            user_agent: Browser user agent string
            
        Returns:
            Session document
        """
        try:
            existing = self.validate_session(session_id)
            if existing:
                # Update last activity
                self.collection.update_one(
                    {"session_id": session_id},
                    {
                        "$set": {"last_activity": datetime.utcnow()},
                        "$inc": {"page_views": 1}
                    }
                )
                return {**existing, "is_new": False}
            
            # Create new session
            session_doc = {
                "session_id": session_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "created_at": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "page_views": 1,
                "pages_visited": [],
                "is_tracked": False  # Flag to prevent duplicate visitor entries
            }
            
            self.collection.insert_one(session_doc)
            logger.info(f"New session created: {session_id}")
            return {**session_doc, "is_new": True}
            
        except Exception as e:
            logger.error(f"Error creating/getting session: {e}")
            # Return a temporary session on error
            return {
                "session_id": session_id,
                "is_new": True,
                "error": str(e)
            }
    
    def should_track_visitor(self, session_id: str) -> bool:
        """
        Check if this session should create a new visitor entry.
        Returns True only for first-time tracking of this session.
        
        Args:
            session_id: The session ID to check
            
        Returns:
            True if visitor should be tracked, False if already tracked
        """
        try:
            session = self.collection.find_one({"session_id": session_id})
            if session and session.get("is_tracked"):
                return False
            return True
        except Exception as e:
            logger.error(f"Error checking session tracking status: {e}")
            return True  # Default to tracking on error
    
    def mark_session_tracked(self, session_id: str, visitor_id: str = None):
        """
        Mark a session as having been tracked in visitor_info.
        
        Args:
            session_id: The session ID to mark
            visitor_id: Optional reference to the visitor document
        """
        try:
            self.collection.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "is_tracked": True,
                        "tracked_at": datetime.utcnow(),
                        "visitor_id": visitor_id
                    }
                }
            )
            logger.info(f"Session {session_id} marked as tracked")
        except Exception as e:
            logger.error(f"Error marking session as tracked: {e}")
    
    def add_page_visit(self, session_id: str, page: str):
        """
        Add a page to the session's visited pages list.
        
        Args:
            session_id: The session ID
            page: The page name/path visited
        """
        try:
            self.collection.update_one(
                {"session_id": session_id},
                {
                    "$addToSet": {"pages_visited": page},
                    "$set": {"last_activity": datetime.utcnow()},
                    "$inc": {"page_views": 1}
                }
            )
        except Exception as e:
            logger.error(f"Error adding page visit: {e}")
    
    def get_session_stats(self) -> Dict[str, Any]:
        """Get overall session statistics"""
        try:
            total_sessions = self.collection.count_documents({})
            active_sessions = self.collection.count_documents({
                "last_activity": {"$gte": datetime.utcnow() - timedelta(hours=1)}
            })
            tracked_sessions = self.collection.count_documents({"is_tracked": True})
            
            return {
                "total_sessions": total_sessions,
                "active_sessions_1h": active_sessions,
                "tracked_sessions": tracked_sessions
            }
        except Exception as e:
            logger.error(f"Error getting session stats: {e}")
            return {}


# Singleton instance
_session_service = None

def get_session_service() -> SessionService:
    """Get singleton instance of SessionService"""
    global _session_service
    if _session_service is None:
        _session_service = SessionService()
    return _session_service
