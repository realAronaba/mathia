from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, Role, require_roles
from app.db.models import AuditEvent, ConsentRecord, StudentProfile, User
from app.db.session import get_session
from app.schemas import ProfileCreate, ProfileResponse

router = APIRouter(prefix="/profiles", tags=["profiles"])


async def get_or_create_user(db: AsyncSession, principal: Principal) -> User:
    user = await db.scalar(select(User).where(User.auth_subject == principal.subject))
    if user:
        user.role = principal.role.value
        return user
    user = User(auth_subject=principal.subject, role=principal.role.value)
    db.add(user)
    await db.flush()
    return user


@router.post("", response_model=ProfileResponse, status_code=201)
async def create_profile(
    request: ProfileCreate,
    principal: Principal = Depends(require_roles(Role.PARENT)),
    db: AsyncSession = Depends(get_session),
):
    if not request.consent_accepted:
        raise HTTPException(status_code=400, detail="Le consentement du parent est requis pour créer un profil élève.")
    parent = await get_or_create_user(db, principal)
    profile = StudentProfile(
        parent_user_id=parent.id,
        pseudonym=request.pseudonym.strip(),
        school_level=request.school_level,
    )
    db.add(profile)
    await db.flush()
    db.add(ConsentRecord(
        student_profile_id=profile.id,
        parent_user_id=parent.id,
        accepted=True,
        consent_version=request.consent_version,
    ))
    db.add(AuditEvent(
        actor_user_id=parent.id,
        action="parental_consent_recorded",
        resource_type="student_profile",
        resource_id=str(profile.id),
        details={"consent_version": request.consent_version},
    ))
    await db.commit()
    await db.refresh(profile)
    return ProfileResponse(id=profile.id, pseudonym=profile.pseudonym, school_level=profile.school_level, status=profile.status)


@router.get("", response_model=list[ProfileResponse])
async def list_profiles(
    principal: Principal = Depends(require_roles(Role.PARENT, Role.ADMIN, Role.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_session),
):
    query = select(StudentProfile)
    if principal.role == Role.PARENT:
        parent = await get_or_create_user(db, principal)
        query = query.where(StudentProfile.parent_user_id == parent.id)
    profiles = (await db.scalars(query.order_by(StudentProfile.created_at.desc()))).all()
    return [ProfileResponse(id=p.id, pseudonym=p.pseudonym, school_level=p.school_level, status=p.status) for p in profiles]
