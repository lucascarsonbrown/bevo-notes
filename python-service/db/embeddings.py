"""
Embedding helper — uses Gemini text-embedding-004 via REST.
Returns a list of floats for a given text string.
"""

import os
import httpx
from typing import List

GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"


async def embed_text(text: str) -> List[float]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{GEMINI_EMBED_URL}?key={api_key}",
            json={
                "model": "models/text-embedding-004",
                "content": {"parts": [{"text": text}]},
            },
        )
        if not resp.is_success:
            raise RuntimeError(f"Gemini embed error: {resp.text}")

    return resp.json()["embedding"]["values"]


async def embed_batch(texts: List[str]) -> List[List[float]]:
    """Embed multiple texts sequentially (Gemini batch embed not available for all models)."""
    results = []
    for t in texts:
        results.append(await embed_text(t))
    return results
