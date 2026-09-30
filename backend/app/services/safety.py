import re


EMAIL = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
PHONE = re.compile(r"(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)")
PROMPT_OVERRIDE = re.compile(r"(?i)(ignore|oublie|contourne).{0,40}(instruction|règle|sécurité|prompt)")


class SafetyFilter:
    def filter_input(self, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) > 500:
            raise ValueError("Ta réponse est trop longue pour cet exercice.")
        if EMAIL.search(cleaned) or PHONE.search(cleaned):
            raise ValueError("N’écris pas d’adresse e-mail ni de numéro de téléphone dans le tutorat.")
        if PROMPT_OVERRIDE.search(cleaned):
            raise ValueError("Restons sur la question de mathématiques en cours.")
        return cleaned

    def filter_output(self, value: str, safe_fallback: str) -> str:
        if len(value) > 1200 or EMAIL.search(value) or PHONE.search(value):
            return safe_fallback
        return value.strip()
