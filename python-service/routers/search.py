"""
/search — semantic search over a user's course content
POST /search/query  — find top-k chunks relevant to a query
"""

import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from db.chroma import get_or_create_collection
from db.embeddings import embed_text

router = APIRouter()


async def verify_internal(x_service_secret: str = Header(alias="x-service-secret")):
    expected = os.getenv("SERVICE_SECRET", "")
    if not expected or x_service_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


class SearchRequest(BaseModel):
    user_id: str
    course_id: str
    query: str
    top_k: int = 10
    unit_ids: Optional[list[str]] = None          # filter to specific units
    material_types: Optional[list[str]] = None    # e.g. ["note", "textbook"]
    material_ids: Optional[list[str]] = None      # filter to specific materials


@router.post("/query")
async def semantic_search(req: SearchRequest, x_service_secret: str = Header(alias="x-service-secret")):
    await verify_internal(x_service_secret)

    query_embedding = await embed_text(req.query)

    collection = get_or_create_collection(req.user_id, req.course_id)

    # Build ChromaDB where filter
    where: dict = {}
    conditions = []

    if req.unit_ids:
        conditions.append({"unit_id": {"$in": req.unit_ids}})
    if req.material_types:
        conditions.append({"material_type": {"$in": req.material_types}})
    if req.material_ids:
        conditions.append({"material_id": {"$in": req.material_ids}})

    if len(conditions) == 1:
        where = conditions[0]
    elif len(conditions) > 1:
        where = {"$and": conditions}

    query_kwargs: dict = {
        "query_embeddings": [query_embedding],
        "n_results": min(req.top_k, 20),
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        query_kwargs["where"] = where

    try:
        results = collection.query(**query_kwargs)
    except Exception as e:
        # Collection empty or no matching docs
        return {"chunks": []}

    chunks = []
    if results["documents"] and results["documents"][0]:
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            chunks.append({
                "text": doc,
                "metadata": meta,
                "distance": dist,
            })

    return {"chunks": chunks}
