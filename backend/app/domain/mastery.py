import math
from datetime import datetime, timezone


def update_mastery(
    knowledge: float,
    correct: bool,
    *,
    guess: float = 0.2,
    slip: float = 0.1,
    learn: float = 0.12,
) -> float:
    """Bayesian Knowledge Tracing update; the model never controls stage changes."""
    prior = min(0.999, max(0.001, knowledge))
    if correct:
        posterior = prior * (1 - slip) / (prior * (1 - slip) + (1 - prior) * guess)
    else:
        posterior = prior * slip / (prior * slip + (1 - prior) * (1 - guess))
    return min(0.999, max(0.001, posterior + (1 - posterior) * learn))


def decay_mastery(knowledge: float, last_evidence_at: datetime | None, now: datetime | None = None) -> float:
    """Return a confidence-decayed probability with a 120-day half-life."""
    if last_evidence_at is None:
        return knowledge
    current = now or datetime.now(timezone.utc)
    days = max(0.0, (current - last_evidence_at).total_seconds() / 86400)
    retained = math.exp(-math.log(2) * days / 120)
    return 0.1 + (knowledge - 0.1) * retained
