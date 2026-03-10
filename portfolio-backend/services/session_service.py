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
    
    def store_section_times(self, session_id: str, page: str,
                             total_time_ms: int, sections: dict,
                             timestamp: str = None):
        """
        Store section engagement time data for analytics.
        Upserts data for a session, so multiple flushes update the same doc.
        
        Args:
            session_id: The session ID
            page: The page being tracked (e.g., 'home')
            total_time_ms: Total time spent on the page in milliseconds
            sections: Dict of section_id -> { timeMs, visits }
            timestamp: ISO timestamp of when this data was recorded
        """
        try:
            analytics_collection = self.db.section_analytics
            
            # Build section update fields
            section_updates = {}
            for section_id, data in sections.items():
                time_ms = data.get('timeMs', 0) if isinstance(data, dict) else 0
                visits = data.get('visits', 0) if isinstance(data, dict) else 0
                section_updates[f"sections.{section_id}.timeMs"] = time_ms
                section_updates[f"sections.{section_id}.visits"] = visits
            
            update_doc = {
                "$set": {
                    "session_id": session_id,
                    "page": page,
                    "total_time_ms": total_time_ms,
                    "last_updated": datetime.utcnow(),
                    "client_timestamp": timestamp,
                    **section_updates
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow()
                }
            }
            
            analytics_collection.update_one(
                {"session_id": session_id, "page": page},
                update_doc,
                upsert=True
            )
            
            # Also update the session's last activity
            self.collection.update_one(
                {"session_id": session_id},
                {"$set": {"last_activity": datetime.utcnow(), 
                          "total_time_ms": total_time_ms}}
            )
            
            logger.debug(f"Section times stored for session {session_id}")
        except Exception as e:
            logger.error(f"Error storing section times: {e}")
    
    def get_section_analytics(self) -> Dict[str, Any]:
        """
        Aggregate section engagement data for the analytics dashboard.
        Returns average time, total visits, and engagement distribution per section.
        """
        try:
            analytics_collection = self.db.section_analytics
            total_docs = analytics_collection.count_documents({})
            
            if total_docs == 0:
                return {
                    "total_sessions": 0,
                    "sections": [],
                    "avg_total_time_ms": 0,
                    "engagement_over_time": []
                }
            
            section_ids = ['hero', 'about', 'skills', 'education', 'experience', 'projects', 'contact']
            section_labels = {
                'hero': 'Hero',
                'about': 'About Me',
                'skills': 'Skills',
                'education': 'Education',
                'experience': 'Experience',
                'projects': 'Projects',
                'contact': 'Contact'
            }
            
            sections_data = []
            total_engagement_ms = 0
            
            for sid in section_ids:
                pipeline = [
                    {"$match": {f"sections.{sid}": {"$exists": True}}},
                    {"$group": {
                        "_id": None,
                        "avg_time_ms": {"$avg": f"$sections.{sid}.timeMs"},
                        "total_time_ms": {"$sum": f"$sections.{sid}.timeMs"},
                        "total_visits": {"$sum": f"$sections.{sid}.visits"},
                        "session_count": {"$sum": 1},
                        "max_time_ms": {"$max": f"$sections.{sid}.timeMs"},
                        "min_time_ms": {"$min": f"$sections.{sid}.timeMs"}
                    }}
                ]
                
                result = list(analytics_collection.aggregate(pipeline))
                
                if result:
                    r = result[0]
                    avg_ms = round(r.get("avg_time_ms", 0) or 0)
                    total_ms = round(r.get("total_time_ms", 0) or 0)
                    total_engagement_ms += total_ms
                    
                    sections_data.append({
                        "id": sid,
                        "label": section_labels.get(sid, sid.title()),
                        "avg_time_ms": avg_ms,
                        "avg_time_sec": round(avg_ms / 1000, 1),
                        "total_time_ms": total_ms,
                        "total_visits": r.get("total_visits", 0),
                        "session_count": r.get("session_count", 0),
                        "max_time_ms": round(r.get("max_time_ms", 0) or 0),
                        "min_time_ms": round(r.get("min_time_ms", 0) or 0),
                    })
                else:
                    sections_data.append({
                        "id": sid,
                        "label": section_labels.get(sid, sid.title()),
                        "avg_time_ms": 0,
                        "avg_time_sec": 0,
                        "total_time_ms": 0,
                        "total_visits": 0,
                        "session_count": 0,
                        "max_time_ms": 0,
                        "min_time_ms": 0,
                    })
            
            # Calculate engagement percentages
            for s in sections_data:
                s["engagement_pct"] = round(
                    (s["total_time_ms"] / total_engagement_ms * 100) if total_engagement_ms > 0 else 0,
                    1
                )
            
            # Average total time on page
            avg_total_pipeline = [
                {"$group": {
                    "_id": None,
                    "avg_total_ms": {"$avg": "$total_time_ms"},
                    "total_sessions": {"$sum": 1}
                }}
            ]
            avg_total_result = list(analytics_collection.aggregate(avg_total_pipeline))
            avg_total_ms = round(avg_total_result[0].get("avg_total_ms", 0) or 0) if avg_total_result else 0
            
            # Engagement over time (last 7 days, grouped by day)
            from datetime import date
            engagement_over_time = []
            for i in range(6, -1, -1):
                day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
                day_end = day_start + timedelta(days=1)
                
                day_pipeline = [
                    {"$match": {
                        "last_updated": {"$gte": day_start, "$lt": day_end}
                    }},
                    {"$group": {
                        "_id": None,
                        "sessions": {"$sum": 1},
                        "avg_time_ms": {"$avg": "$total_time_ms"}
                    }}
                ]
                day_result = list(analytics_collection.aggregate(day_pipeline))
                
                engagement_over_time.append({
                    "date": day_start.strftime("%b %d"),
                    "sessions": day_result[0].get("sessions", 0) if day_result else 0,
                    "avg_time_sec": round((day_result[0].get("avg_time_ms", 0) or 0) / 1000, 1) if day_result else 0
                })
            
            # Top section (most avg time)
            top_section = max(sections_data, key=lambda x: x["avg_time_ms"]) if sections_data else None
            
            return {
                "total_sessions": total_docs,
                "sections": sections_data,
                "avg_total_time_ms": avg_total_ms,
                "avg_total_time_sec": round(avg_total_ms / 1000, 1),
                "engagement_over_time": engagement_over_time,
                "top_section": top_section["label"] if top_section else "N/A",
                "total_engagement_ms": total_engagement_ms
            }
            
        except Exception as e:
            logger.error(f"Error getting section analytics: {e}")
            return {
                "total_sessions": 0,
                "sections": [],
                "avg_total_time_ms": 0,
                "engagement_over_time": [],
                "error": str(e)
            }

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
