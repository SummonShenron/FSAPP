import os
import jwt
import requests
from typing import Optional
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)
_cached_jwks = None

def get_clerk_public_key():
    global _cached_jwks
    if _cached_jwks is None:
        issuer = os.environ.get("CLERK_ISSUER")
        if not issuer:
            raise RuntimeError("CLERK_ISSUER environment variable is not set")
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        try:
            response = requests.get(jwks_url)
            response.raise_for_status()
            _cached_jwks = response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch Clerk JWKS: {str(e)}")
    return _cached_jwks

async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = credentials.credentials

    # GUEST BYPASS PATTERN: Intercept the sandbox token cleanly
    if token == "guest-sandbox-token":
        return {
            "sub": "guest_user_demo",
            "is_guest": True
        }

    # Standard Clerk token verification for normal users
    try:
        header = jwt.get_unverified_header(token)
        jwks = get_clerk_public_key()
        key_data = next((k for k in jwks['keys'] if k['kid'] == header['kid']), None)
        if not key_data:
            raise HTTPException(status_code=401, detail="Invalid token key ID")

        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
        payload = jwt.decode(token, public_key, algorithms=["RS256"], options={"verify_aud": False})
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")