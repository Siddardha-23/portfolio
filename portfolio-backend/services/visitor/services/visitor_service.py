"""
Visitor Service - Core business logic for visitor tracking

This service handles:
- Visitor data collection and storage
- Integration with session and IP services
- Visitor analytics and statistics
- Fingerprint-based deduplication (same browser = one visitor)
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from pymongo.errors import DuplicateKeyError
from utils.db_connect import DBConnect
from services.session_service import get_session_service
from services.ip_service import get_ip_service

logger = logging.getLogger(__name__)


class VisitorService:
    """Service for managing visitor tracking and analytics"""
    
    def __init__(self):
        self.db = DBConnect().get_db()
        self.collection = self.db.visitor_info
        self.session_service = get_session_service()
        self.ip_service = get_ip_service()
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Ensure proper indexes exist for performance"""
        try:
            # Compound index for common queries
            self.collection.create_index([
                ("session_id", 1),
                ("timestamp", -1)
            ])
            # Index for IP-based queries
            self.collection.create_index("ip_address")
            # Index for time-based queries
            self.collection.create_index("timestamp")
            # Sparse index for fingerprint-based deduplication (cross-session same browser)
            self.collection.create_index("fingerprint_hash", unique=True, sparse=True)
        except Exception as e:
            logger.warning(f"Index creation warning (may already exist): {e}")
    
    def track_visitor(self, session_id: str, ip_address: str,
                      client_ip: str = None, user_agent: str = None,
                      page: str = 'unknown', referrer: str = 'direct',
                      raw_data: dict = None, fingerprint_hash: str = None) -> Dict[str, Any]:
        """
        Track a visitor with session-based and fingerprint-based deduplication.
        If fingerprint_hash is provided and already exists, updates that visitor's
        last_activity and visit_count instead of creating a duplicate.

        Args:
            session_id: Client session ID
            ip_address: Server-detected IP address
            client_ip: Client-reported IP address (from frontend)
            user_agent: Browser user agent string
            page: Page being visited
            referrer: Referrer URL
            raw_data: Additional fingerprint/browser data
            fingerprint_hash: Stable browser fingerprint hash for cross-session dedup

        Returns:
            Result dictionary with tracking status (new, existing, or error)
        """
        try:
            effective_ip = self._get_effective_ip(ip_address, client_ip)

            self.session_service.create_or_get_session(
                session_id, effective_ip, user_agent
            )
            self.session_service.add_page_visit(session_id, page)

            # Fingerprint-based dedup: same browser across sessions = one visitor
            if fingerprint_hash:
                existing = self.collection.find_one({"fingerprint_hash": fingerprint_hash})
                if existing:
                    self.collection.update_one(
                        {"fingerprint_hash": fingerprint_hash},
                        {
                            "$set": {"last_activity": datetime.utcnow(), "page": page},
                            "$inc": {"visit_count": 1}
                        }
                    )
                    logger.info(f"Returning visitor by fingerprint: {fingerprint_hash[:12]}...")
                    return {
                        "status": "existing",
                        "message": "Visitor already tracked (same browser)",
                        "session_id": session_id,
                        "ip": effective_ip
                    }

            # Session-based dedup: same tab/session = one visitor entry per session
            if not self.session_service.should_track_visitor(session_id):
                logger.info(f"Session {session_id} already tracked, skipping duplicate entry")
                return {
                    "status": "existing",
                    "message": "Session already tracked",
                    "session_id": session_id,
                    "ip": effective_ip
                }

            ip_info = self.ip_service.get_ip_info(effective_ip)
            ua_data = self._parse_user_agent(user_agent) if user_agent else {}

            visitor_doc = {
                "session_id": session_id,
                "ip_address": effective_ip,
                "client_reported_ip": client_ip,
                "ip_info": ip_info,
                "user_agent_raw": user_agent,
                "browser": ua_data.get("browser"),
                "os": ua_data.get("os"),
                "device": ua_data.get("device"),
                "page": page,
                "referrer": referrer,
                "timestamp": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "visit_count": 1,
                "raw_data": raw_data or {},
                "geo": {
                    "city": ip_info.get("city"),
                    "region": ip_info.get("region"),
                    "country": ip_info.get("country"),
                    "country_name": ip_info.get("country_name"),
                    "timezone": ip_info.get("timezone"),
                    "org": ip_info.get("org")
                }
            }
            if fingerprint_hash:
                visitor_doc["fingerprint_hash"] = fingerprint_hash

            try:
                result = self.collection.insert_one(visitor_doc)
            except DuplicateKeyError:
                # Race: another request with same fingerprint_hash inserted first
                self.collection.update_one(
                    {"fingerprint_hash": fingerprint_hash},
                    {
                        "$set": {"last_activity": datetime.utcnow(), "page": page},
                        "$inc": {"visit_count": 1}
                    }
                )
                return {
                    "status": "existing",
                    "message": "Visitor already tracked (same browser)",
                    "session_id": session_id,
                    "ip": effective_ip
                }

            if result.inserted_id:
                self.session_service.mark_session_tracked(
                    session_id,
                    str(result.inserted_id)
                )
                logger.info(
                    f"New visitor tracked: {session_id} from "
                    f"{ip_info.get('city', 'Unknown')}, {ip_info.get('country', 'Unknown')}"
                )
                return {
                    "status": "created",
                    "message": "Visitor tracked successfully",
                    "session_id": session_id,
                    "ip": effective_ip,
                    "location": {
                        "city": ip_info.get("city"),
                        "country": ip_info.get("country_name")
                    }
                }

            return {
                "status": "error",
                "message": "Failed to insert visitor document"
            }

        except Exception as e:
            logger.error(f"Error tracking visitor: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def _get_effective_ip(self, server_ip: str, client_ip: str) -> str:
        """
        Determine the effective IP address to use.
        Prefer client IP if it's valid and different from local addresses.
        """
        local_ips = ['127.0.0.1', 'localhost', '::1', None, '']
        
        # If client provided an IP and server is local, use client IP
        if server_ip in local_ips and client_ip and client_ip not in local_ips:
            return client_ip.split(',')[0].strip()
        
        # Otherwise prefer server-detected IP
        if server_ip and server_ip not in local_ips:
            return server_ip.split(',')[0].strip()
        
        # Fallback to client IP
        if client_ip and client_ip not in local_ips:
            return client_ip.split(',')[0].strip()
        
        return server_ip or '127.0.0.1'
    
    def _parse_user_agent(self, user_agent: str) -> Dict[str, str]:
        """Parse user agent string to extract browser, OS, device info"""
        try:
            from ua_parser import user_agent_parser
            parsed = user_agent_parser.Parse(user_agent)
            return {
                "browser": parsed.get('user_agent', {}).get('family'),
                "browser_version": '.'.join(filter(None, [
                    str(parsed.get('user_agent', {}).get('major', '')),
                    str(parsed.get('user_agent', {}).get('minor', ''))
                ])),
                "os": parsed.get('os', {}).get('family'),
                "os_version": '.'.join(filter(None, [
                    str(parsed.get('os', {}).get('major', '')),
                    str(parsed.get('os', {}).get('minor', ''))
                ])),
                "device": parsed.get('device', {}).get('family')
            }
        except Exception as e:
            logger.error(f"Error parsing user agent: {e}")
            return {}
    
    def get_visitor_by_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get visitor info by session ID"""
        try:
            visitor = self.collection.find_one({"session_id": session_id})
            if visitor:
                visitor['_id'] = str(visitor['_id'])
            return visitor
        except Exception as e:
            logger.error(f"Error getting visitor by session: {e}")
            return None
    
    def get_visitors_by_ip(self, ip_address: str) -> List[Dict[str, Any]]:
        """Get all visitors from a specific IP address"""
        try:
            visitors = list(self.collection.find(
                {"ip_address": ip_address}
            ).sort("timestamp", -1))
            for v in visitors:
                v['_id'] = str(v['_id'])
            return visitors
        except Exception as e:
            logger.error(f"Error getting visitors by IP: {e}")
            return []

    def get_unique_visitor_count(self) -> int:
        """
        Count unique visitors: distinct fingerprint_hash count plus legacy
        documents without a fingerprint_hash (each counted as one).
        """
        try:
            distinct_hashes = self.collection.distinct("fingerprint_hash")
            unique_by_fingerprint = len([h for h in distinct_hashes if h])
            legacy_count = self.collection.count_documents({
                "$or": [
                    {"fingerprint_hash": {"$exists": False}},
                    {"fingerprint_hash": None},
                    {"fingerprint_hash": ""}
                ]
            })
            return unique_by_fingerprint + legacy_count
        except Exception as e:
            logger.error(f"Error getting unique visitor count: {e}")
            return 0

    def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive visitor statistics"""
        try:
            now = datetime.utcnow()
            
            # Basic counts
            total_visitors = self.collection.count_documents({})
            unique_ips = len(self.collection.distinct('ip_address'))
            
            # Time-based stats
            last_24h = self.collection.count_documents({
                "timestamp": {"$gte": now - timedelta(hours=24)}
            })
            last_7d = self.collection.count_documents({
                "timestamp": {"$gte": now - timedelta(days=7)}
            })
            last_30d = self.collection.count_documents({
                "timestamp": {"$gte": now - timedelta(days=30)}
            })
            
            # Geographic distribution
            country_pipeline = [
                {"$group": {"_id": "$geo.country_name", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10}
            ]
            top_countries = list(self.collection.aggregate(country_pipeline))
            
            city_pipeline = [
                {"$match": {"geo.city": {"$ne": None, "$ne": "Unknown"}}},
                {"$group": {"_id": "$geo.city", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10}
            ]
            top_cities = list(self.collection.aggregate(city_pipeline))
            
            # Page views
            page_pipeline = [
                {"$group": {"_id": "$page", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 5}
            ]
            top_pages = list(self.collection.aggregate(page_pipeline))
            
            # Browser stats
            browser_pipeline = [
                {"$match": {"browser": {"$ne": None}}},
                {"$group": {"_id": "$browser", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 5}
            ]
            top_browsers = list(self.collection.aggregate(browser_pipeline))
            
            # Session stats
            session_stats = self.session_service.get_session_stats()
            
            return {
                "total_visitors": total_visitors,
                "unique_ips": unique_ips,
                "visitors_24h": last_24h,
                "visitors_7d": last_7d,
                "visitors_30d": last_30d,
                "top_countries": [
                    {"country": c["_id"] or "Unknown", "count": c["count"]} 
                    for c in top_countries
                ],
                "top_cities": [
                    {"city": c["_id"], "count": c["count"]} 
                    for c in top_cities
                ],
                "top_pages": [
                    {"page": p["_id"], "count": p["count"]} 
                    for p in top_pages
                ],
                "top_browsers": [
                    {"browser": b["_id"], "count": b["count"]} 
                    for b in top_browsers
                ],
                "sessions": session_stats
            }
        except Exception as e:
            logger.error(f"Error getting visitor statistics: {e}")
            return {}


# Singleton instance
_visitor_service = None

def get_visitor_service() -> VisitorService:
    """Get singleton instance of VisitorService"""
    global _visitor_service
    if _visitor_service is None:
        _visitor_service = VisitorService()
    return _visitor_service
