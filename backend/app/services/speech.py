import json
import re
from dataclasses import dataclass

from app.core.config import settings
from app.domain.math_engine import format_fraction


@dataclass(frozen=True)
class TutorSpeech:
    proposed_answer: str
    explanation: str
    provider: str


class TutorSpeechProvider:
    async def generate(self, expression: str, expected, student_answer: str, correct: bool, context: str, allow_external_llm: bool = True) -> TutorSpeech:
        if settings.llm_provider == "litellm" and settings.llm_api_key and allow_external_llm:
            try:
                return await self._litellm(expression, expected, student_answer, correct, context)
            except Exception:
                # A provider outage never blocks deterministic checking or changes the learning state.
                pass
        return self._demo(expected, correct)

    async def regenerate(self, expression: str, expected, student_answer: str, correct: bool, context: str) -> TutorSpeech:
        if settings.llm_provider == "litellm" and settings.llm_api_key:
            return await self._litellm(expression, expected, student_answer, correct, context, verification_retry=True)
        return self._demo(expected, correct)

    def _demo(self, expected, correct: bool) -> TutorSpeech:
        result = format_fraction(expected)
        if correct:
            explanation = f"Bien joué. Le moteur de calcul confirme {result}. Vérifie les parts équivalentes que tu as utilisées."
        else:
            explanation = "Cherche un dénominateur commun avant d’additionner. Les parts doivent avoir la même taille."
        return TutorSpeech(proposed_answer=result, explanation=explanation, provider="demo")

    async def _litellm(self, expression: str, expected, student_answer: str, correct: bool, context: str, verification_retry: bool = False) -> TutorSpeech:
        from litellm import acompletion

        result = format_fraction(expected)
        instruction = (
            "Réponds en français à un élève de collège. Tu ne décides ni de la correction ni de l’étape suivante; "
            "le moteur mathématique s’en charge. Renvoie un objet JSON avec proposed_answer et explanation. "
            "Ne demande aucune donnée personnelle."
        )
        if verification_retry:
            instruction += f" La proposition précédente était incohérente; proposed_answer doit être exactement {result}."
        if correct:
            task = f"L’élève a répondu juste à {expression}. Valeur vérifiée: {result}. Explique la méthode brièvement."
        else:
            task = f"L’élève a répondu {student_answer!r} à {expression}. Donne un indice, sans révéler le résultat {result}."

        async def request() -> tuple[TutorSpeech, dict[str, int]]:
            response = await acompletion(
                model=settings.llm_model,
                api_key=settings.llm_api_key,
                temperature=0.1,
                max_tokens=180,
                messages=[
                    {"role": "system", "content": instruction},
                    {"role": "user", "content": f"Leçon de référence: {context}\nExercice: {task}"},
                ],
            )
            raw = response.choices[0].message.content or ""
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            payload = json.loads(match.group(0)) if match else {}
            speech = TutorSpeech(
                proposed_answer=str(payload.get("proposed_answer", "")),
                explanation=str(payload.get("explanation", "")),
                provider="litellm",
            )
            usage = getattr(response, "usage", None)
            usage_details = {}
            if usage is not None:
                if getattr(usage, "prompt_tokens", None) is not None:
                    usage_details["input"] = int(usage.prompt_tokens)
                if getattr(usage, "completion_tokens", None) is not None:
                    usage_details["output"] = int(usage.completion_tokens)
            return speech, usage_details

        if settings.langfuse_public_key and settings.langfuse_secret_key:
            from langfuse import get_client

            client = get_client()
            with client.start_as_current_observation(
                as_type="generation",
                name="mathia-tutor-generation",
                model=settings.llm_model,
                input={"is_correct": correct, "verification_retry": verification_retry},
            ) as generation:
                speech, usage_details = await request()
                updates = {"output": {"proposal_present": bool(speech.proposed_answer), "explanation_length": len(speech.explanation)}}
                if usage_details:
                    updates["usage_details"] = usage_details
                generation.update(**updates)
                return speech

        speech, _usage_details = await request()
        return speech
