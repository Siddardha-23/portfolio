"""
IP Geolocation Service - Fetches and caches IP information

This service handles:
- IP geolocation lookups using ipinfo.io (reliable and accurate)
- Caching of IP data to reduce API calls
- Fallback handling for API failures
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import requests
from utils.db_connect import DBConnect
from utils.config import IPInfoConfig

logger = logging.getLogger(__name__)


class IPService:
    """Service for IP geolocation lookups and caching"""
    
    # Cache expiry in days
    CACHE_EXPIRY_DAYS = 30
    
    # ipinfo.io API endpoint
    IPINFO_API_URL = "https://ipinfo.io/{ip}/json"
    
    def __init__(self):
        self.db = DBConnect().get_db()
        self.cache_collection = self.db.ip_cache
        self.api_token = IPInfoConfig.IPINFO_TOKEN
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Ensure proper indexes exist for performance"""
        try:
            # Index on IP for fast lookups
            self.cache_collection.create_index("ip", unique=True)
            # TTL index for automatic cache cleanup
            self.cache_collection.create_index(
                "cached_at", 
                expireAfterSeconds=self.CACHE_EXPIRY_DAYS * 24 * 3600
            )
        except Exception as e:
            logger.warning(f"Index creation warning (may already exist): {e}")
    
    def get_ip_info(self, ip_address: str, use_cache: bool = True) -> Dict[str, Any]:
        """
        Get geolocation information for an IP address.
        
        Args:
            ip_address: The IP address to lookup
            use_cache: Whether to use cached data if available
            
        Returns:
            Dictionary containing IP geolocation data
        """
        if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1']:
            return self._get_local_ip_info(ip_address)
        
        # Clean the IP (handle X-Forwarded-For format)
        ip_address = ip_address.split(',')[0].strip()
        
        # Check cache first
        if use_cache:
            cached = self._get_from_cache(ip_address)
            if cached:
                logger.debug(f"IP info cache hit for {ip_address}")
                return cached
        
        # Fetch from ipinfo.io API
        ip_info = self._fetch_from_ipinfo(ip_address)
        
        # Cache the result
        if ip_info and not ip_info.get('error'):
            self._save_to_cache(ip_address, ip_info)
        
        return ip_info
    
    def _get_local_ip_info(self, ip_address: str) -> Dict[str, Any]:
        """Return info for local/development IP addresses"""
        return {
            "ip": ip_address,
            "is_local": True,
            "city": "Local Development",
            "region": "Development",
            "country": "XX",
            "country_name": "Local",
            "org": "Development Environment",
            "timezone": "UTC",
            "cached_at": datetime.utcnow().isoformat()
        }
    
    def _get_from_cache(self, ip_address: str) -> Optional[Dict[str, Any]]:
        """Get IP info from cache if available and not expired"""
        try:
            cached = self.cache_collection.find_one({"ip": ip_address})
            if cached:
                # Remove MongoDB _id for JSON serialization
                cached.pop('_id', None)
                return cached
            return None
        except Exception as e:
            logger.error(f"Error reading from IP cache: {e}")
            return None
    
    def _fetch_from_ipinfo(self, ip_address: str) -> Dict[str, Any]:
        """Fetch IP info from ipinfo.io API"""
        try:
            url = self.IPINFO_API_URL.format(ip=ip_address)
            
            headers = {}
            if self.api_token:
                headers['Authorization'] = f'Bearer {self.api_token}'
            
            response = requests.get(url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                
                # Parse and enrich the data
                ip_info = {
                    "ip": ip_address,
                    "city": data.get('city', 'Unknown'),
                    "region": data.get('region', 'Unknown'),
                    "country": data.get('country', 'Unknown'),
                    "country_name": self._get_country_name(data.get('country', '')),
                    "postal": data.get('postal', ''),
                    "timezone": data.get('timezone', 'UTC'),
                    "org": data.get('org', 'Unknown'),
                    "loc": data.get('loc', ''),
                    "fetched_at": datetime.utcnow().isoformat(),
                    "source": "ipinfo.io"
                }
                
                # Parse coordinates if available
                if ip_info['loc']:
                    try:
                        lat, lon = ip_info['loc'].split(',')
                        ip_info['latitude'] = float(lat)
                        ip_info['longitude'] = float(lon)
                    except (ValueError, AttributeError):
                        pass
                
                logger.info(f"IP info fetched for {ip_address}: {ip_info['city']}, {ip_info['country']}")
                return ip_info
            
            elif response.status_code == 429:
                logger.warning(f"ipinfo.io rate limit exceeded for IP {ip_address}")
                return {
                    "ip": ip_address,
                    "error": "Rate limit exceeded",
                    "city": "Unknown",
                    "country": "Unknown"
                }
            
            else:
                logger.error(f"ipinfo.io API error: {response.status_code}")
                return {
                    "ip": ip_address,
                    "error": f"API error: {response.status_code}",
                    "city": "Unknown",
                    "country": "Unknown"
                }
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout fetching IP info for {ip_address}")
            return {
                "ip": ip_address,
                "error": "Timeout",
                "city": "Unknown",
                "country": "Unknown"
            }
        except Exception as e:
            logger.error(f"Error fetching IP info: {e}")
            return {
                "ip": ip_address,
                "error": str(e),
                "city": "Unknown",
                "country": "Unknown"
            }
    
    def _save_to_cache(self, ip_address: str, ip_info: Dict[str, Any]):
        """Save IP info to cache"""
        try:
            cache_doc = {
                **ip_info,
                "ip": ip_address,
                "cached_at": datetime.utcnow()
            }
            
            self.cache_collection.update_one(
                {"ip": ip_address},
                {"$set": cache_doc},
                upsert=True
            )
            logger.debug(f"IP info cached for {ip_address}")
        except Exception as e:
            logger.error(f"Error saving IP info to cache: {e}")
    
    def _get_country_name(self, country_code: str) -> str:
        """Convert country code to full country name"""
        country_names = {
            'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada',
            'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'IN': 'India',
            'JP': 'Japan', 'CN': 'China', 'BR': 'Brazil', 'MX': 'Mexico',
            'NL': 'Netherlands', 'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark',
            'FI': 'Finland', 'IE': 'Ireland', 'NZ': 'New Zealand', 'SG': 'Singapore',
            'HK': 'Hong Kong', 'KR': 'South Korea', 'IT': 'Italy', 'ES': 'Spain',
            'CH': 'Switzerland', 'AT': 'Austria', 'BE': 'Belgium', 'PL': 'Poland',
            'PT': 'Portugal', 'RU': 'Russia', 'ZA': 'South Africa', 'AE': 'UAE',
            'IL': 'Israel', 'TH': 'Thailand', 'MY': 'Malaysia', 'PH': 'Philippines',
            'ID': 'Indonesia', 'VN': 'Vietnam', 'TR': 'Turkey', 'EG': 'Egypt',
            'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru',
        }
        return country_names.get(country_code, country_code)
    
    def get_ip_stats(self) -> Dict[str, Any]:
        """Get statistics about IP lookups"""
        try:
            total_cached = self.cache_collection.count_documents({})
            
            # Get top countries
            pipeline = [
                {"$group": {"_id": "$country_name", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10}
            ]
            top_countries = list(self.cache_collection.aggregate(pipeline))
            
            # Get top cities
            pipeline = [
                {"$match": {"city": {"$ne": "Unknown"}}},
                {"$group": {"_id": "$city", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10}
            ]
            top_cities = list(self.cache_collection.aggregate(pipeline))
            
            return {
                "total_cached_ips": total_cached,
                "top_countries": [{"country": c["_id"], "count": c["count"]} for c in top_countries],
                "top_cities": [{"city": c["_id"], "count": c["count"]} for c in top_cities]
            }
        except Exception as e:
            logger.error(f"Error getting IP stats: {e}")
            return {}


# Singleton instance
_ip_service = None

def get_ip_service() -> IPService:
    """Get singleton instance of IPService"""
    global _ip_service
    if _ip_service is None:
        _ip_service = IPService()
    return _ip_service
