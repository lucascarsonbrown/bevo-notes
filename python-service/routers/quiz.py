"""
/quiz — quiz generation and grading via LangGraph pipeline
POST /quiz/generate  — run the full pipeline, return questions
POST /quiz/grade     — grade a single free-response answer
"""

import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from agents.quiz_pipeline import get_quiz_graph, grade_answer
from db.chroma import get_or_create_collection
from db.embeddings import embed_text

router = APIRouter()


async def verify_internal(x_service_secret: str = Header(alias="x-service-secret")):
    expected = os.getenv("SERVICE_SECRET", "")
    if not expected or x_service_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


class GenerateRequest(BaseModel):
    user_id: str
    course_id: str
    query: str
    format: str           # "flashcard" | "multiple_choice" | "free_response"
    count: int
    unit_ids: list[str] = []
    material_ids: list[str] = []
    mode: str = "standard"  # "standard" | "unit_test" | "exam_prep"


class GradeRequest(BaseModel):
    user_id: str
    course_id: str
    question: str
    model_answer: str
    student_answer: str
    unit_ids: list[str] = []


@router.post("/generate")
async def generate_quiz(req: GenerateRequest, x_service_secret: str = Header(alias="x-service-secret")):
    await verify_internal(x_service_secret)

    if req.format not in ("flashcard", "multiple_choice", "free_response"):
        raise HTTPException(status_code=400, detail="Invalid format")
    if req.count < 1 or req.count > 50:
        raise HTTPException(status_code=400, detail="count must be 1-50")

    graph = get_quiz_graph()

    initial_state = {
        "user_id": req.user_id,
        "course_id": req.course_id,
        "query": req.query,
        "format": req.format,
        "count": req.count,
        "unit_ids": req.unit_ids,
        "material_ids": req.material_ids,
        "mode": req.mode,
        "intent": "",
        "source_chunks": [],
        "questions": [],
        "error": None,
    }

    result = await graph.ainvoke(initial_state)

    if result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])

    return {
        "questions": result["questions"],
        "intent": result.get("intent", ""),
        "chunks_used": len(result.get("source_chunks", [])),
    }


@router.post("/grade")
async def grade_response(req: GradeRequest, x_service_secret: str = Header(alias="x-service-secret")):
    await verify_internal(x_service_secret)

    # Retrieve relevant context chunks for grading
    query_embedding = await embed_text(req.question)
    collection = get_or_create_collection(req.user_id, req.course_id)

    where: dict = {}
    if req.unit_ids:
        where = {"unit_id": {"$in": req.unit_ids}}

    query_kwargs: dict = {
        "query_embeddings": [query_embedding],
        "n_results": 5,
        "include": ["documents", "metadatas"],
    }
    if where:
        query_kwargs["where"] = where

    try:
        results = collection.query(**query_kwargs)
        chunks = [
            {"text": doc, "metadata": meta}
            for doc, meta in zip(results["documents"][0], results["metadatas"][0])
        ] if results["documents"] and results["documents"][0] else []
    except Exception:
        chunks = []

    result = await grade_answer(
        question=req.question,
        model_answer=req.model_answer,
        student_answer=req.student_answer,
        source_chunks=chunks,
    )

    return result
