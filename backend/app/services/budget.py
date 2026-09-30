from datetime import datetime, timezone
from hashlib import sha256

from redis.exceptions import RedisError

from app.core.config import settings


async def reserve_llm_request(redis, subject: str) -> bool:
    """Reserve one daily tutoring generation; fail closed if quota storage is unavailable."""
    subject_hash = sha256(subject.encode("utf-8")).hexdigest()[:24]
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"llm-quota:{subject_hash}:{day}"
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 172800)
        return count <= settings.llm_requests_per_user_per_day
    except RedisError:
        return False
