from fastapi import APIRouter, Request
from redis.exceptions import RedisError
from sqlalchemy import text

from app.db.session import SessionFactory

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def live():
    return {"status": "ok", "service": "mathia-api"}


@router.get("/health/ready")
async def ready(request: Request):
    checks = {"database": False, "redis": False}
    try:
        async with SessionFactory() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass
    try:
        checks["redis"] = bool(await request.app.state.redis.ping())
    except (AttributeError, RedisError):
        pass
    return {"status": "ready" if all(checks.values()) else "degraded", "checks": checks}
