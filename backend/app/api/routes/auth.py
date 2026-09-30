from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.security import Role, create_demo_token
from app.schemas import DemoTokenRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/demo-token", response_model=TokenResponse)
async def demo_token(request: DemoTokenRequest):
    if settings.environment != "development" or not settings.allow_demo_auth:
        raise HTTPException(status_code=404, detail="Authentification de démonstration désactivée")
    role = Role(request.role)
    return TokenResponse(access_token=create_demo_token(f"demo-{role.value}", role))
