import os
import jwt
import requests
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()
_cached_jwks = None

def get_clerk_public_key():
    global _cached_jwks
    if _cached_jwks is None:
        issuer = os.environ.get("CLERK_ISSUER")
        if not issuer:
            raise RuntimeError("CLERK_ISSUER environment variable is not set")
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json" #[cite: 4]
        try:
            response = requests.get(jwks_url) #[cite: 4]
            response.raise_for_status()
            _cached_jwks = response.json() #[cite: 4]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch Clerk JWKS: {str(e)}")
    return _cached_jwks

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Strict Clerk JWT validation.
    Returns the decoded JWT payload containing the Clerk 'sub' (user_id).
    """
    token = credentials.credentials

    try:
        # Extract header to match the key ID (kid)[cite: 4]
        header = jwt.get_unverified_header(token) #[cite: 4]
        jwks = get_clerk_public_key() #[cite: 4]
        
        key_data = next((k for k in jwks['keys'] if k['kid'] == header['kid']), None) #[cite: 4]
        if not key_data:
            raise HTTPException(status_code=401, detail="Invalid token key ID")

        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data) #[cite: 4]

        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        ) #[cite: 4]
        
        return payload  # payload["sub"] is the Clerk user ID
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")