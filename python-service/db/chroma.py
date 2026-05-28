"""
ChromaDB singleton — persistent local store, one collection per user+course.
Collection naming: bevo_{user_id}_{course_id}  (UUIDs without dashes)
"""

import chromadb
from chromadb.config import Settings
import os

_client: chromadb.PersistentClient | None = None


def get_chroma() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
        os.makedirs(persist_dir, exist_ok=True)
        _client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
    return _client


def collection_name(user_id: str, course_id: str) -> str:
    uid = user_id.replace("-", "")
    cid = course_id.replace("-", "")
    # ChromaDB collection names: 3-63 chars, alphanumeric + underscore/hyphen
    return f"u{uid[:16]}_c{cid[:16]}"


def get_or_create_collection(user_id: str, course_id: str):
    client = get_chroma()
    name = collection_name(user_id, course_id)
    return client.get_or_create_collection(
        name=name,
        metadata={"user_id": user_id, "course_id": course_id},
    )
