from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.profiles import get_or_create_user
from app.core.security import Principal, Role, require_roles
from app.db.models import AuditEvent, ConsentRecord, ExerciseAttempt, ParentReport, SkillProgress, StudentProfile
from app.db.session import get_session
from app.workers.tasks import rebuild_parent_report

router = APIRouter(prefix="/parent", tags=["parent"])


async def _parent_profile(db: AsyncSession, principal: Principal, profile_id: UUID) -> StudentProfile:
    parent = await get_or_create_user(db, principal)
    profile = await db.scalar(select(StudentProfile).where(StudentProfile.id == profile_id, StudentProfile.parent_user_id == parent.id))
    if not profile:
        raise HTTPException(status_code=404, detail="Profil introuvable")
    return profile


@router.get("/profiles/{profile_id}/report")
async def profile_report(
    profile_id: UUID,
    principal: Principal = Depends(require_roles(Role.PARENT)),
    db: AsyncSession = Depends(get_session),
):
    profile = await _parent_profile(db, principal, profile_id)
    consent = await db.scalar(
        select(ConsentRecord).where(
            ConsentRecord.student_profile_id == profile.id,
            ConsentRecord.accepted.is_(True),
            ConsentRecord.revoked_at.is_(None),
        ).order_by(ConsentRecord.captured_at.desc())
    )
    attempts = await db.scalar(select(func.count()).select_from(ExerciseAttempt).where(ExerciseAttempt.student_profile_id == profile.id))
    skills = (await db.scalars(select(SkillProgress).where(SkillProgress.student_profile_id == profile.id))).all()
    return {
        "profile_id": str(profile.id),
        "pseudonym": profile.pseudonym,
        "school_level": profile.school_level,
        "consent_active": consent is not None,
        "attempt_count": attempts or 0,
        "skills": [{"skill_id": item.skill_id, "mastery_probability": item.mastery_probability, "evidence_count": item.evidence_count} for item in skills],
    }


@router.post("/profiles/{profile_id}/reports", status_code=202)
async def queue_parent_report(
    profile_id: UUID,
    principal: Principal = Depends(require_roles(Role.PARENT)),
    db: AsyncSession = Depends(get_session),
):
    profile = await _parent_profile(db, principal, profile_id)
    job = rebuild_parent_report.delay(str(profile.id))
    return {"task_id": job.id, "status": "queued"}


@router.post("/profiles/{profile_id}/consent/revoke")
async def revoke_consent(
    profile_id: UUID,
    principal: Principal = Depends(require_roles(Role.PARENT)),
    db: AsyncSession = Depends(get_session),
):
    profile = await _parent_profile(db, principal, profile_id)
    parent = await get_or_create_user(db, principal)
    consent = await db.scalar(select(ConsentRecord).where(
        ConsentRecord.student_profile_id == profile.id,
        ConsentRecord.accepted.is_(True),
        ConsentRecord.revoked_at.is_(None),
    ).order_by(ConsentRecord.captured_at.desc()).limit(1))
    if not consent:
        raise HTTPException(status_code=404, detail="Aucun consentement actif pour ce profil")
    consent.revoked_at = datetime.now(timezone.utc)
    profile.status = "paused"
    db.add(AuditEvent(
        actor_user_id=parent.id,
        action="parental_consent_revoked",
        resource_type="student_profile",
        resource_id=str(profile.id),
        details={"consent_version": consent.consent_version},
    ))
    await db.commit()
    return {"profile_id": str(profile.id), "consent_active": False, "profile_status": "paused"}


@router.get("/profiles/{profile_id}/reports/latest")
async def latest_parent_report(
    profile_id: UUID,
    principal: Principal = Depends(require_roles(Role.PARENT)),
    db: AsyncSession = Depends(get_session),
):
    profile = await _parent_profile(db, principal, profile_id)
    report = await db.scalar(select(ParentReport).where(ParentReport.student_profile_id == profile.id).order_by(ParentReport.created_at.desc()).limit(1))
    if not report:
        raise HTTPException(status_code=404, detail="Aucun rapport n’a encore été généré.")
    return {"id": str(report.id), "created_at": report.created_at, "summary": report.summary}
