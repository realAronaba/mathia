from dataclasses import dataclass


STAGES = ("welcome", "recall", "guided_practice", "independent_practice", "reflection", "complete")
MAX_LEARNING_STEP = len(STAGES) - 2


@dataclass
class LearningSessionState:
    step: int
    wrong_count: int
    help_level: int
    pending_advance: bool

    @property
    def stage(self) -> str:
        return STAGES[min(self.step, len(STAGES) - 1)]

    @property
    def can_advance(self) -> bool:
        return self.step == 0 or self.pending_advance


def request_help(state: LearningSessionState, kind: str) -> int:
    increments = {"hint": 1, "confused": 2, "alternate": 1, "reasoning": 1}
    state.help_level = min(4, state.help_level + increments.get(kind, 0))
    return state.help_level


def record_answer(state: LearningSessionState, correct: bool) -> None:
    if correct:
        state.pending_advance = True
        return
    state.pending_advance = False
    state.wrong_count += 1
    state.help_level = min(4, max(1, state.help_level + 1))


def advance(state: LearningSessionState) -> None:
    if not state.can_advance:
        raise ValueError("Une réponse correcte est nécessaire avant de changer d’étape.")
    if state.step >= MAX_LEARNING_STEP:
        state.step = len(STAGES) - 1
        state.pending_advance = False
        return
    state.step += 1
    state.pending_advance = False
    state.wrong_count = 0
    state.help_level = 0
