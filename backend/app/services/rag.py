from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import CurriculumChunk
from app.domain.catalog import LESSON_CONTEXT


class CurriculumRetriever:
    async def retrieve(self, session: AsyncSession, skill_id: str, question: str) -> tuple[str, str]:
        if settings.llm_api_key:
            try:
                from litellm import aembedding

                response = await aembedding(model=settings.embedding_model, input=[question], api_key=settings.llm_api_key)
                vector = response.data[0]["embedding"]
                if len(vector) == settings.embedding_dimensions:
                    distance = CurriculumChunk.embedding.cosine_distance(vector)
                    result = await session.scalars(
                        select(CurriculumChunk)
                        .where(CurriculumChunk.skill_id == skill_id, CurriculumChunk.embedding.is_not(None))
                        .order_by(distance)
                        .limit(3)
                    )
                    chunks = list(result)
                    if chunks:
                        return "\n".join(chunk.content for chunk in chunks), "pgvector"
            except Exception:
                pass
        return LESSON_CONTEXT.get(skill_id, "Relis la consigne et repère les informations utiles."), "curriculum-fallback"
