import os
import logging
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("Soundboard Logger")

_client = None

def get_db():
    """Returns the MongoDB database instance if USE_DB is true, else None."""
    global _client
    
    if os.getenv("USE_DB", "true").lower() != "true":
        logger.info("[DB] MongoDB disabled via USE_DB env variable")
        return None
        
    if _client is None:
        uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        logger.info(f"[DB] Initializing new MongoClient connection...")
        try:
            # tlsCAFile=certifi.where() injects trusted CA certs to pass SSL handshakes on cloud hosts
            _client = MongoClient(
                uri, 
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=10000  # 10s timeout instead of hanging 30s
            )
            logger.info("[DB] MongoClient instantiated successfully.")
        except Exception as e:
            logger.error(f"[DB ERROR] Failed to instantiate MongoClient: {e}", exc_info=True)
            return None
        
    db_name = os.getenv("MONGO_DB_NAME", "family_soundboard_db")
    return _client[db_name]

def test_connection():
    """Verification ping for server startup."""
    logger.info("[DB] Running startup database connectivity test...")
    db = get_db()
    if db is None:
        logger.warning("[DB WARN] USE_DB is disabled or client initialization failed.")
        return False
    try:
        db.command('ping')
        logger.info(f"[DB SUCCESS] Successfully connected and pinged MongoDB: '{db.name}'")
        return True
    except Exception as e:
        logger.error(f"[DB ERROR] MongoDB startup ping failed: {e}", exc_info=True)
        return False