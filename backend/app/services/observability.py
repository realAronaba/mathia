from contextlib import asynccontextmanager
from hashlib import sha256

from app.core.config import settings


@asynccontextmanager
async def tutor_trace(subject: str, session_id: str, exercise_id: str):
    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        yield None
        return

    from langfuse import get_client

    client = get_client()
    subject_hash = sha256(subject.encode("utf-8")).hexdigest()[:20]
    with client.start_as_current_observation(
        as_type="span",
        name="mathia-tutor-pipeline",
        input={"exercise_id": exercise_id},
        metadata={"session_id": session_id, "student_hash": subject_hash},
    ) as span:
        yield span
