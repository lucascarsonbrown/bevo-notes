"""
/ingest — document ingestion pipeline
POST /ingest/text   — ingest plain text (lecture notes, custom notes)
POST /ingest/pdf    — ingest PDF bytes (syllabus, textbook)
DELETE /ingest      — remove all chunks for a material
"""

import os
import io
import uuid
import httpx
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from db.chroma import get_or_create_collection
from db.embeddings import embed_batch

router = APIRouter()

CHUNK_SIZE = 1000       # characters per chunk
CHUNK_OVERLAP = 150     # overlap between chunks


# ── Auth helper ────────────────────────────────────────────────────────────────

async def verify_internal(x_service_secret: str = Header(alias="x-service-secret")):
    """Next.js calls this service with a shared secret — not user JWTs."""
    expected = os.getenv("SERVICE_SECRET", "")
    if not expected or x_service_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── Chunking ───────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    if not text.strip():
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start += chunk_size - overlap
    return chunks


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
        return "\n\n".join(pages)
    except Exception as e:
        raise RuntimeError(f"PDF extraction failed: {e}")


# ── Schemas ────────────────────────────────────────────────────────────────────

class IngestTextRequest(BaseModel):
    user_id: str
    course_id: str
    material_id: str          # UUID for deduplication / deletion
    material_type: str        # "note" | "syllabus" | "textbook" | "custom_notes"
    unit_id: Optional[str] = None
    title: str
    text: str


class IngestPdfRequest(BaseModel):
    user_id: str
    course_id: str
    material_id: str
    material_type: str        # "syllabus" | "textbook"
    unit_id: Optional[str] = None
    title: str
    # PDF sent as base64 or fetched from a URL
    pdf_url: Optional[str] = None    # Supabase signed URL
    pdf_base64: Optional[str] = None


class DeleteRequest(BaseModel):
    user_id: str
    course_id: str
    material_id: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/text")
async def ingest_text(req: IngestTextRequest, x_service_secret: str = Header(alias="x-service-secret")):
    await verify_internal(x_service_secret)

    chunks = chunk_text(req.text)
    if not chunks:
        return {"chunks_added": 0}

    embeddings = await embed_batch(chunks)

    collection = get_or_create_collection(req.user_id, req.course_id)

    # Delete existing chunks for this material (re-ingest idempotent)
    try:
        collection.delete(where={"material_id": req.material_id})
    except Exception:
        pass

    ids = [f"{req.material_id}_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "material_id": req.material_id,
            "material_type": req.material_type,
            "unit_id": req.unit_id or "",
            "title": req.title,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]

    collection.add(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)

    return {"chunks_added": len(chunks)}


@router.post("/pdf")
async def ingest_pdf(req: IngestPdfRequest, x_service_secret: str = Header(alias="x-service-secret")):
    await verify_internal(x_service_secret)

    # Fetch PDF bytes
    if req.pdf_url:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(req.pdf_url)
            if not resp.is_success:
                raise HTTPException(status_code=400, detail="Failed to download PDF")
            pdf_bytes = resp.content
    elif req.pdf_base64:
        import base64
        pdf_bytes = base64.b64decode(req.pdf_base64)
    else:
        raise HTTPException(status_code=400, detail="Provide pdf_url or pdf_base64")

    try:
        text = extract_pdf_text(pdf_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not text.strip():
        raise HTTPException(status_code=422, detail="No text extracted from PDF")

    chunks = chunk_text(text)
    embeddings = await embed_batch(chunks)

    collection = get_or_create_collection(req.user_id, req.course_id)
    try:
        collection.delete(where={"material_id": req.material_id})
    except Exception:
        pass

    ids = [f"{req.material_id}_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "material_id": req.material_id,
            "material_type": req.material_type,
            "unit_id": req.unit_id or "",
            "title": req.title,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]

    collection.add(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)

    return {"chunks_added": len(chunks), "text_chars": len(text)}


@router.delete("/")
async def delete_material(req: DeleteRequest, x_service_secret: str = Header(alias="x-service-secret")):
    await verify_internal(x_service_secret)

    collection = get_or_create_collection(req.user_id, req.course_id)
    try:
        collection.delete(where={"material_id": req.material_id})
    except Exception:
        pass
    return {"deleted": True}
