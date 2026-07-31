import os
import logging
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("Soundboard Logger")

_client = None

def get_db():
    """Returns the MongoDB database instance if USE_DB is true, else None."""
    global _client
    
    if os.getenv("USE_DB", "true").lower() != "true":
        logger.info("MongoDB disabled via USE_DB env variable")
        return None
        
    if _client is None:
        uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        _client = MongoClient(uri)
        
    db_name = os.getenv("MONGO_DB_NAME", "family_soundboard_db")
    return _client[db_name]

def test_connection():
    """Verification ping for server startup."""
    db = get_db()
    if db is None:
        print("USE_DB is disabled.")
        return False
    try:
        db.command('ping')
        print(f"Successfully connected to MongoDB: {db.name}")
        return True
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return False