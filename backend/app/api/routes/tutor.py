from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import Principal, Role, require_roles
from app.db.models import ConsentRecord, ExerciseAttempt, SkillProgress, StudentProfile, TutorSession
from app.db.session import get_session
from app.domain.catalog import DEMO_EXERCISES
from app.domain.mastery import decay_mastery, update_mastery
from app.domain.state_machine import LearningSessionState, STAGES, advance as advance_state, record_answer, request_help
from app.schemas import SessionResponse, TutorAnswer, TutorAnswerResponse, TutorSessionCreate
from app.services.pipeline import tutor_pipeline
from app.services.budget import reserve_llm_request

router = APIRouter(prefix="/tutor", tags=["tutoring"])
HINTS = (
    "Relis la consigne et repère ce que représente chaque dénominateur.",
    "Cherche des parts de même taille avant de faire le calcul.",
    "Écris une fraction équivalente pour chaque terme.",
    "Additionne les numérateurs et vérifie ton résultat avec une fraction équivalente.",
)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


async def _owned_session(db: AsyncSession, session_id: UUID, principal: Principal) -> tuple[TutorSession, StudentProfile]:
    tutor_session = await db.get(TutorSession, session_id)
    if not tutor_session:
        raise HTTPException(status_code=404, detail="Séance introuvable")
    profile = await db.get(StudentProfile, tutor_session.student_profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profil introuvable")
    if profile.status != "active":
        raise HTTPException(status_code=403, detail="Le profil élève est en pause")
    consent = await db.scalar(select(ConsentRecord).where(
        ConsentRecord.student_profile_id == profile.id,
        ConsentRecord.accepted.is_(True),
        ConsentRecord.revoked_at.is_(None),
    ).limit(1))
    if not consent:
        raise HTTPException(status_code=403, detail="L’accord parental n’est plus actif")
    if principal.demo:
        return tutor_session, profile
    if profile.student_subject != principal.subject:
        raise HTTPException(status_code=403, detail="Cette séance n’appartient pas à ce compte élève")
    return tutor_session, profile


def _state(session: TutorSession) -> LearningSessionState:
    return LearningSessionState(
        step=session.stage,
        wrong_count=session.wrong_count,
        help_level=session.help_level,
        pending_advance=session.pending_advance,
    )


def _response(session: TutorSession) -> SessionResponse:
    exercise = DEMO_EXERCISES[session.exercise_id]
    state = _state(session)
    return SessionResponse(
        id=session.id,
        exercise_id=session.exercise_id,
        expression=exercise.expression,
        skill_id=exercise.skill_id,
        stage=state.stage,
        step=session.stage,
        can_advance=state.can_advance,
    )


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    request: TutorSessionCreate,
    principal: Principal = Depends(require_roles(Role.STUDENT)),
    db: AsyncSession = Depends(get_session),
):
    exercise = DEMO_EXERCISES.get(request.exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercice indisponible")
    profile = await db.get(StudentProfile, request.profile_id)
    if not profile or profile.status != "active":
        raise HTTPException(status_code=404, detail="Profil élève indisponible")
    if not principal.demo and profile.student_subject != principal.subject:
        raise HTTPException(status_code=403, detail="Profil non rattaché à ce compte élève")
    consent = await db.scalar(
        select(ConsentRecord).where(
            ConsentRecord.student_profile_id == profile.id,
            ConsentRecord.accepted.is_(True),
            ConsentRecord.revoked_at.is_(None),
        ).limit(1)
    )
    if not consent:
        raise HTTPException(status_code=403, detail="Un accord parental actif est nécessaire")

    session = TutorSession(student_profile_id=profile.id, exercise_id=exercise.id, skill_id=exercise.skill_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _response(session)


@router.post("/sessions/{session_id}/advance", response_model=SessionResponse)
async def advance_session(
    session_id: UUID,
    principal: Principal = Depends(require_roles(Role.STUDENT)),
    db: AsyncSession = Depends(get_session),
):
    session, _profile = await _owned_session(db, session_id, principal)
    state = _state(session)
    try:
        # The deterministic orchestrator owns all stage transitions.
        advance_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    session.stage = state.step
    session.wrong_count = state.wrong_count
    session.help_level = state.help_level
    session.pending_advance = state.pending_advance
    if state.stage == "complete":
        session.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return _response(session)


async def _submit_answer(
    session: TutorSession,
    profile: StudentProfile,
    principal: Principal,
    db: AsyncSession,
    http_request: Request,
    answer: str,
    image: bytes | None = None,
    image_content_type: str | None = None,
) -> TutorAnswerResponse:
    if session.stage == 0 or session.stage >= len(STAGES) - 1:
        raise HTTPException(status_code=409, detail="Aucune réponse n’est attendue à cette étape")
    if session.pending_advance:
        raise HTTPException(status_code=409, detail="Passe à l’étape suivante avant de répondre à nouveau")
    exercise = DEMO_EXERCISES[session.exercise_id]
    allow_external_llm = True
    if settings.llm_provider == "litellm" and settings.llm_api_key:
        allow_external_llm = await reserve_llm_request(http_request.app.state.redis, principal.subject)
    try:
        result = await tutor_pipeline.answer(
            db,
            exercise=exercise,
            student_answer=answer,
            subject=principal.subject,
            session_id=str(session.id),
            allow_external_llm=allow_external_llm,
            image=image,
            image_content_type=image_content_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    state = _state(session)
    record_answer(state, result.correct)
    session.wrong_count = state.wrong_count
    session.help_level = state.help_level
    session.pending_advance = state.pending_advance

    db.add(ExerciseAttempt(
        tutor_session_id=session.id,
        student_profile_id=profile.id,
        skill_id=exercise.skill_id,
        is_correct=result.correct,
        help_level=session.help_level,
    ))
    progress = await db.scalar(
        select(SkillProgress).where(
            SkillProgress.student_profile_id == profile.id,
            SkillProgress.skill_id == exercise.skill_id,
        )
    )
    now = datetime.now(timezone.utc)
    if progress is None:
        progress = SkillProgress(student_profile_id=profile.id, skill_id=exercise.skill_id, mastery_probability=0.1)
        db.add(progress)
        await db.flush()
    else:
        progress.mastery_probability = decay_mastery(progress.mastery_probability, progress.last_evidence_at, now)
    progress.mastery_probability = update_mastery(progress.mastery_probability, result.correct)
    progress.evidence_count += 1
    progress.last_evidence_at = now
    await db.commit()

    return TutorAnswerResponse(
        correct=result.correct,
        explanation=result.explanation,
        pipeline=result.stages,
        stage=state.stage,
        step=state.step,
        can_advance=state.can_advance,
        mastery_probability=progress.mastery_probability,
    )


@router.post("/sessions/{session_id}/answer", response_model=TutorAnswerResponse)
async def answer_session(
    session_id: UUID,
    request: TutorAnswer,
    http_request: Request,
    principal: Principal = Depends(require_roles(Role.STUDENT)),
    db: AsyncSession = Depends(get_session),
):
    session, profile = await _owned_session(db, session_id, principal)
    return await _submit_answer(session, profile, principal, db, http_request, request.answer)


@router.post("/sessions/{session_id}/photo-answer", response_model=TutorAnswerResponse)
async def answer_session_with_photo(
    session_id: UUID,
    http_request: Request,
    answer: str = Form(..., min_length=1, max_length=80),
    image: UploadFile = File(...),
    principal: Principal = Depends(require_roles(Role.STUDENT)),
    db: AsyncSession = Depends(get_session),
):
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Utilise une image JPEG, PNG ou WebP.")
    payload = await image.read(MAX_IMAGE_BYTES + 1)
    await image.close()
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="La photo doit faire moins de 5 Mo.")
    session, profile = await _owned_session(db, session_id, principal)
    return await _submit_answer(session, profile, principal, db, http_request, answer, payload, image.content_type)


@router.post("/sessions/{session_id}/hint")
async def request_session_hint(
    session_id: UUID,
    kind: str = "hint",
    principal: Principal = Depends(require_roles(Role.STUDENT)),
    db: AsyncSession = Depends(get_session),
):
    session, _profile = await _owned_session(db, session_id, principal)
    state = _state(session)
    level = request_help(state, kind)
    session.help_level = state.help_level
    await db.commit()
    return {"level": level, "hint": HINTS[min(max(level - 1, 0), len(HINTS) - 1)], "stage": state.stage}
