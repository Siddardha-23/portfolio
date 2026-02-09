import os
from datetime import timedelta

# Load environment variables from .env file if available (local development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, use system env vars


def _get_config_value(key: str, default: str = None) -> str:
    """
    Get configuration value from SSM Parameter Store or environment variable.
    
    Priority:
    1. SSM Parameter Store (when USE_SSM_SECRETS=true, i.e., Lambda)
    2. Environment variable
    3. Default value
    """
    use_ssm = os.getenv('USE_SSM_SECRETS', 'false').lower() == 'true'
    
    if use_ssm:
        try:
            from utils.ssm_config import ssm_config
            value = getattr(ssm_config, key, None)
            if value:
                return value
        except Exception as e:
            import logging
            logging.warning(f"SSM config failed for {key}: {e}")
    
    # Fallback to environment variable
    return os.getenv(key, default)


class DBConfig(object):
    """Database configuration - supports both local and AWS Lambda environments."""
    
    @property
    def mongo_uri(self):
        return _get_config_value('MONGODB_URI', os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
    
    @property
    def db_name(self):
        return os.getenv('DB_NAME', 'portfolio_db')
    
    # For backward compatibility
    DATABASE_CONFIG = property(lambda self: {
        'mongo_uri': self.mongo_uri,
        'db_name': self.db_name,
    })


# Singleton instance for DBConfig
_db_config = DBConfig()


class DBConfigMeta(type):
    """Metaclass to make DBConfig work as both class and instance."""
    @property
    def DATABASE_CONFIG(cls):
        return {
            'mongo_uri': _get_config_value('MONGODB_URI', os.getenv('MONGO_URI', 'mongodb://localhost:27017/')),
            'db_name': os.getenv('DB_NAME', 'portfolio_db'),
        }


class DBConfig(object, metaclass=DBConfigMeta):
    """Database configuration - supports both local and AWS Lambda environments."""
    pass


class AppConfig(object):
    """Application configuration."""
    
    @classmethod
    @property
    def JWT_SECRET_KEY(cls):
        return _get_config_value('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)


class IPInfoConfig(object):
    """Configuration for ipinfo.io API
    
    Get a free token at: https://ipinfo.io/signup
    Free tier: 50,000 requests/month
    """
    
    @classmethod
    @property
    def IPINFO_TOKEN(cls):
        return _get_config_value('IPINFO_TOKEN', '')
