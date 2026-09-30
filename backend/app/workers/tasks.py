import asyncio
from uuid import UUID

from celery import shared_task
from sqlalchemy import func, select

from app.db.models import ExerciseAttempt, ParentReport, SkillProgress, StudentProfile, TutorSession
from app.db.session import SessionFactory


async def _build_parent_report(profile_id: UUID) -> str | None:
    async with SessionFactory() as db:
        profile = await db.get(StudentProfile, profile_id)
        if not profile:
            return None
        session_count = await db.scalar(select(func.count()).select_from(TutorSession).where(TutorSession.student_profile_id == profile_id))
        attempt_count = await db.scalar(select(func.count()).select_from(ExerciseAttempt).where(ExerciseAttempt.student_profile_id == profile_id))
        rows = (await db.scalars(select(SkillProgress).where(SkillProgress.student_profile_id == profile_id))).all()
        report = ParentReport(
            student_profile_id=profile_id,
            summary={
                "pseudonym": profile.pseudonym,
                "sessions": session_count or 0,
                "attempts": attempt_count or 0,
                "skills": [{"skill_id": row.skill_id, "mastery_probability": row.mastery_probability} for row in rows],
            },
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
        return str(report.id)


@shared_task(name="mathia.rebuild_parent_report")
def rebuild_parent_report(profile_id: str) -> str | None:
    """Build an aggregate report without copying learner free-text or answer content."""
    return asyncio.run(_build_parent_report(UUID(profile_id)))
