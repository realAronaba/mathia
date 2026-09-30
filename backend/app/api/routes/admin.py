from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.profiles import get_or_create_user
from app.core.security import Principal, Role, require_roles
from app.db.models import AuditEvent, ConsentRecord, CurriculumChunk, ExerciseAttempt, StudentProfile, TutorSession
from app.db.session import get_session
from app.schemas import CurriculumChunkCreate

router = APIRouter(prefix="/admin", tags=["administration"])


@router.get("/overview")
async def overview(
    _principal: Principal = Depends(require_roles(Role.ADMIN, Role.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_session),
):
    profiles = await db.scalar(select(func.count()).select_from(StudentProfile))
    sessions = await db.scalar(select(func.count()).select_from(TutorSession))
    attempts = await db.scalar(select(func.count()).select_from(ExerciseAttempt))
    consents = await db.scalar(select(func.count()).select_from(ConsentRecord).where(ConsentRecord.accepted.is_(True), ConsentRecord.revoked_at.is_(None)))
    return {"profiles": profiles or 0, "sessions": sessions or 0, "attempts": attempts or 0, "active_consents": consents or 0}


@router.post("/curriculum/chunks", status_code=201)
async def add_curriculum_chunk(
    request: CurriculumChunkCreate,
    principal: Principal = Depends(require_roles(Role.ADMIN, Role.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_session),
):
    actor = await get_or_create_user(db, principal)
    chunk = CurriculumChunk(
        source_id=request.source_id,
        skill_id=request.skill_id,
        school_level=request.school_level,
        content=request.content,
        embedding=request.embedding,
    )
    db.add(chunk)
    db.add(AuditEvent(
        action="curriculum_chunk_created",
        actor_user_id=actor.id,
        resource_type="curriculum_chunk",
        resource_id=request.source_id,
        details={"skill_id": request.skill_id, "school_level": request.school_level},
    ))
    await db.commit()
    return {"id": str(chunk.id), "source_id": chunk.source_id, "indexed": chunk.embedding is not None}
