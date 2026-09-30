import base64

import httpx

from app.core.config import settings


class MathpixOCR:
    async def recognize(self, image: bytes, content_type: str) -> str:
        if not settings.enable_external_ocr or not settings.mathpix_app_id or not settings.mathpix_app_key:
            raise RuntimeError("La reconnaissance photo est désactivée. Tu peux saisir l’exercice en texte.")
        encoded = base64.b64encode(image).decode("ascii")
        async with httpx.AsyncClient(timeout=20) as client:
            try:
                response = await client.post(
                    "https://api.mathpix.com/v3/text",
                    headers={"app_id": settings.mathpix_app_id, "app_key": settings.mathpix_app_key},
                    json={"src": f"data:{content_type};base64,{encoded}", "formats": ["text"], "data_options": {"include_asciimath": True}},
                )
                response.raise_for_status()
                payload = response.json()
                return str(payload.get("text", "")).strip()
            except httpx.HTTPError as exc:
                raise RuntimeError("La reconnaissance OCR est momentanément indisponible.") from exc
