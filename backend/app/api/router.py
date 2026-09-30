from fastapi import APIRouter

from .routes import admin, auth, health, ocr, parent, profiles, tutor

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(profiles.router)
api_router.include_router(parent.router)
api_router.include_router(tutor.router)
api_router.include_router(ocr.router)
api_router.include_router(admin.router)
