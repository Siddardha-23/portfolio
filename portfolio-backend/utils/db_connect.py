import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from .config import DBConfig

logging.basicConfig(
    filename='db.log',
    level=logging.INFO,
    format='%(asctime)s:%(levelname)s:%(message)s'
)

class DBConnect:
    """MongoDB connection manager"""
    _client = None

    def __init__(self):
        self.config = DBConfig.DATABASE_CONFIG
        self.mongo_uri = self.config['mongo_uri']
        self.db_name = self.config['db_name']

    def _connect(self):
        """Establish MongoDB connection if not already connected"""
        if DBConnect._client is None:
            try:
                DBConnect._client = MongoClient(self.mongo_uri)
                # Verify connection
                DBConnect._client.admin.command('ping')
                logging.info("MongoDB successfully connected")
            except ConnectionFailure as e:
                logging.error(f"MongoDB connection failed: {e}")
                raise
            except Exception as e:
                logging.error(f"MongoDB initialization error: {e}")
                raise
        return DBConnect._client

    def get_db(self):
        """Get database instance"""
        client = self._connect()
        return client[self.db_name]

    def get_collection(self, collection_name):
        """Get a specific collection"""
        db = self.get_db()
        return db[collection_name]
