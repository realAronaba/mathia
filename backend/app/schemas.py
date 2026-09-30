from uuid import UUID

from pydantic import BaseModel, Field


class DemoTokenRequest(BaseModel):
    role: str = Field(pattern="^(student|parent|admin|super_admin)$")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileCreate(BaseModel):
    pseudonym: str = Field(min_length=2, max_length=24)
    school_level: str = Field(pattern="^(5e|4e|3e)$")
    consent_accepted: bool
    consent_version: str = Field(min_length=2, max_length=40)


class ProfileResponse(BaseModel):
    id: UUID
    pseudonym: str
    school_level: str
    status: str


class TutorSessionCreate(BaseModel):
    profile_id: UUID
    exercise_id: str = Field(min_length=4, max_length=80)


class TutorAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=80)


class SessionResponse(BaseModel):
    id: UUID
    exercise_id: str
    expression: str
    skill_id: str
    stage: str
    step: int
    can_advance: bool


class TutorAnswerResponse(BaseModel):
    correct: bool
    explanation: str
    pipeline: list[str]
    stage: str
    step: int
    can_advance: bool
    mastery_probability: float


class CurriculumChunkCreate(BaseModel):
    source_id: str = Field(min_length=2, max_length=120)
    skill_id: str = Field(min_length=2, max_length=80)
    school_level: str = Field(pattern="^(5e|4e|3e)$")
    content: str = Field(min_length=30, max_length=6000)
    embedding: list[float] | None = Field(default=None, min_length=1536, max_length=1536)
