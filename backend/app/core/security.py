import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from .config import settings


class Role(StrEnum):
    STUDENT = "student"
    PARENT = "parent"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


@dataclass(frozen=True)
class Principal:
    subject: str
    role: Role
    demo: bool = False


bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    if not settings.jwt_jwks_url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Managed authentication is not configured")
    return PyJWKClient(settings.jwt_jwks_url, cache_jwk_set=True, lifespan=300)


def create_demo_token(subject: str, role: Role) -> str:
    return jwt.encode(
        {"sub": subject, "role": role.value, "iss": "mathia-local-demo", "demo": True, "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        settings.jwt_secret,
        algorithm="HS256",
    )


async def current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise")

    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") == "HS256" and settings.environment == "development" and settings.allow_demo_auth:
            claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], issuer="mathia-local-demo")
            role = Role(claims["role"])
            return Principal(subject=str(claims["sub"]), role=role, demo=True)

        key = await asyncio.to_thread(_jwks_client().get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256", "ES256"],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"verify_aud": bool(settings.jwt_audience)},
        )
        metadata = claims.get("public_metadata") or claims.get("app_metadata") or {}
        role = Role(claims.get("role") or metadata.get("role"))
        return Principal(subject=str(claims["sub"]), role=role)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Jeton invalide ou rôle non autorisé") from exc


def require_roles(*roles: Role):
    async def dependency(principal: Principal = Depends(current_principal)) -> Principal:
        if principal.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rôle insuffisant pour cette action")
        return principal

    return dependency
