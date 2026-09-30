from dataclasses import dataclass
from fractions import Fraction
import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalog import DemoExercise
from app.domain.math_engine import equivalent_answers, format_fraction, solve_fraction_expression
from .observability import tutor_trace
from .ocr import MathpixOCR
from .rag import CurriculumRetriever
from .safety import SafetyFilter
from .speech import TutorSpeechProvider


@dataclass(frozen=True)
class PipelineResult:
    correct: bool
    explanation: str
    expected: Fraction
    stages: list[str]


class SequentialTutorPipeline:
    """A fixed pipeline; only deterministic code can validate answers or advance a session."""

    def __init__(self) -> None:
        self.safety = SafetyFilter()
        self.retriever = CurriculumRetriever()
        self.speech = TutorSpeechProvider()

    async def answer(
        self,
        db: AsyncSession,
        *,
        exercise: DemoExercise,
        student_answer: str,
        subject: str,
        session_id: str,
        allow_external_llm: bool = True,
        image: bytes | None = None,
        image_content_type: str | None = None,
    ) -> PipelineResult:
        stages: list[str] = []
        async with tutor_trace(subject, session_id, exercise.id) as trace:
            safe_answer = self.safety.filter_input(student_answer)
            stages.append("Filtre d’entrée : autorisé")

            expression = exercise.expression
            if image is not None:
                if not image_content_type:
                    raise ValueError("Le type de la photo est manquant.")
                recognized = await MathpixOCR().recognize(image, image_content_type)
                recognized = self.safety.filter_input(recognized)
                recognized = re.sub(r"\\(?:d?frac)\s*\{(\d+)\}\s*\{(\d+)\}", r"\1/\2", recognized)
                recognized = re.sub(r"\s+", "", recognized).replace("−", "-")
                expected_expression = re.sub(r"\s+", "", exercise.expression).replace("−", "-")
                if recognized != expected_expression:
                    raise ValueError("La photo ne correspond pas à l’exercice choisi. Vérifie le cadrage ou saisis l’énoncé en texte.")
                expression = recognized
                stages.append("OCR / vision : énoncé reconnu et validé")
            else:
                stages.append("OCR / vision : ignoré, exercice texte")

            expected = solve_fraction_expression(expression)
            correct = equivalent_answers(safe_answer, expected)
            stages.append("Moteur SymPy : valeur exacte calculée")

            context, retrieval_mode = await self.retriever.retrieve(db, exercise.skill_id, exercise.expression)
            stages.append(f"LLM + RAG : contexte {retrieval_mode}")

            speech = await self.speech.generate(expression, expected, safe_answer, correct, context, allow_external_llm)
            stages[-1] = f"LLM + RAG : contexte {retrieval_mode}, tuteur {speech.provider}"

            # The LLM proposes text only. Its numeric proposal is checked and never controls correctness.
            model_answer_is_valid = equivalent_answers(speech.proposed_answer, expected)
            verification_status = "proposition cohérente"
            if not model_answer_is_valid:
                try:
                    regenerated = await self.speech.regenerate(expression, expected, safe_answer, correct, context)
                except Exception:
                    regenerated = self.speech._demo(expected, correct)
                if equivalent_answers(regenerated.proposed_answer, expected):
                    speech = regenerated
                    verification_status = "incohérence → régénération vérifiée"
                else:
                    speech = self.speech._demo(expected, correct)
                    verification_status = "incohérence → explication déterministe"
            stages.append(f"Vérification exacte : {verification_status}")

            safe_fallback = (
                f"Le moteur confirme {format_fraction(expected)}. Vérifie le dénominateur commun."
                if correct
                else "Cherche un dénominateur commun. Les parts doivent avoir la même taille avant l’addition."
            )
            explanation = self.safety.filter_output(speech.explanation, safe_fallback)
            if not correct and format_fraction(expected) in explanation:
                explanation = safe_fallback
            stages.append("Filtre de sortie : réponse contrôlée")

            if trace:
                trace.update(output={"correct": correct, "stages": len(stages), "provider": speech.provider})

        return PipelineResult(correct=correct, explanation=explanation, expected=expected, stages=stages)


tutor_pipeline = SequentialTutorPipeline()
