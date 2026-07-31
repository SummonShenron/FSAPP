import os
import logging
import sys

def setup_logging():
    logger = logging.getLogger("Soundboard Logger")
    
    if not logger.handlers:
        env_log_level = os.getenv("LOG_LEVEL")
        
        if env_log_level:
            level = getattr(logging, env_log_level.upper(), logging.INFO)
        else:
            is_local = (
                os.getenv("LOCAL_DEV", "false").lower() == "true" or 
                os.getenv("DEV_MODE", "false").lower() == "true"
            )
            level = logging.DEBUG if is_local else logging.INFO

        logger.setLevel(level)
        
        formatter = logging.Formatter('%(levelname)s - %(message)s')
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
        logger.propagate = False
        
        # Mute third-party noise
        noisy_loggers = ["uvicorn.access", "httpx", "httpcore", "h11", "anyio", "asyncio"]
        for name in noisy_loggers:
            logging.getLogger(name).setLevel(logging.CRITICAL)
            
        logging.getLogger("uvicorn.error").setLevel(logging.ERROR)
        logging.getLogger("uvicorn").setLevel(logging.ERROR)
        
    return logger