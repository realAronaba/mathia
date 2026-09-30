from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, Role, require_roles
from app.db.models import ConsentRecord, StudentProfile
from app.db.session import get_session
from app.services.ocr import MathpixOCR

router = APIRouter(prefix="/ocr", tags=["ocr"])
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/recognize")
async def recognize_exercise(
    profile_id: UUID = Form(...),
    image: UploadFile = File(...),
    principal: Principal = Depends(require_roles(Role.STUDENT)),
    db: AsyncSession = Depends(get_session),
):
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Utilise une image JPEG, PNG ou WebP.")
    profile = await db.get(StudentProfile, profile_id)
    if not profile or (not principal.demo and profile.student_subject != principal.subject):
        raise HTTPException(status_code=404, detail="Profil élève introuvable")
    consent = await db.scalar(select(ConsentRecord).where(
        ConsentRecord.student_profile_id == profile.id,
        ConsentRecord.accepted.is_(True),
        ConsentRecord.revoked_at.is_(None),
    ).limit(1))
    if not consent:
        raise HTTPException(status_code=403, detail="L’accord parental actif est nécessaire avant l’envoi d’une image.")
    payload = await image.read(MAX_IMAGE_BYTES + 1)
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="La photo doit faire moins de 5 Mo.")
    try:
        text = await MathpixOCR().recognize(payload, image.content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Le service de reconnaissance est momentanément indisponible.") from exc
    finally:
        await image.close()
    return {"recognized_text": text, "stored": False}
