"""
Shared Gemini REST helper for the agent pipeline.
Uses the platform API key from env — no user key.
"""

import os
import httpx
from typing import Optional

FLASH_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
FLASH_LITE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"


async def call_gemini(
    prompt: str,
    system: str,
    *,
    model: str = "flash",
    temperature: float = 0.4,
    max_tokens: int = 8192,
) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not configured")

    url = FLASH_LITE_URL if model == "flash-lite" else FLASH_URL

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{url}?key={api_key}",
            json={
                "system_instruction": {"parts": [{"text": system}]},
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens,
                },
            },
        )
        if not resp.is_success:
            raise RuntimeError(f"Gemini error {resp.status_code}: {resp.text}")

    data = resp.json()
    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
    if not text:
        raise RuntimeError("Empty Gemini response")
    return text
