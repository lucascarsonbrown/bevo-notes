"""
LangGraph multi-agent quiz pipeline.

Graph:
  orchestrator → retrieval → generator → END

The evaluator (grading) is a separate callable, not in this graph,
since grading happens per-answer at quiz-take time, not at generation time.
"""

import json
import re
from typing import Optional, TypedDict, Annotated
from langgraph.graph import StateGraph, END
from agents.gemini import call_gemini
from db.chroma import get_or_create_collection
from db.embeddings import embed_text


# ── State ──────────────────────────────────────────────────────────────────────

class QuizState(TypedDict):
    # Inputs
    user_id: str
    course_id: str
    query: str
    format: str            # "flashcard" | "multiple_choice" | "free_response"
    count: int
    unit_ids: list[str]
    material_ids: list[str]
    mode: str              # "standard" | "unit_test" | "exam_prep"

    # Intermediate
    intent: str            # orchestrator's parsed intent summary
    source_chunks: list[dict]  # retrieved chunks

    # Output
    questions: list[dict]
    error: Optional[str]


# ── Node: Orchestrator ─────────────────────────────────────────────────────────

ORCHESTRATOR_SYSTEM = """You are the orchestrator for a student quiz system.

Given a user's quiz request, produce a concise JSON object with:
{
  "intent": "<one sentence describing what the student wants to study>",
  "refined_query": "<a search-optimized version of the request, 1-2 sentences with key concepts>",
  "focus_topics": ["topic1", "topic2"]  // 3-5 likely topics based on the request
}

Output ONLY the JSON object, no markdown."""


async def orchestrator_node(state: QuizState) -> dict:
    prompt = f"""User query: "{state['query']}"
Format: {state['format']}
Count: {state['count']}
Mode: {state['mode']}"""

    try:
        raw = await call_gemini(prompt, ORCHESTRATOR_SYSTEM, temperature=0.2, model="flash-lite")
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        parsed = json.loads(cleaned)
        intent = parsed.get("intent", state["query"])
        refined_query = parsed.get("refined_query", state["query"])
    except Exception:
        intent = state["query"]
        refined_query = state["query"]

    return {"intent": intent, "query": refined_query}


# ── Node: Retrieval ────────────────────────────────────────────────────────────

async def retrieval_node(state: QuizState) -> dict:
    query_embedding = await embed_text(state["query"])
    collection = get_or_create_collection(state["user_id"], state["course_id"])

    # Determine how many chunks to pull based on mode
    n_results = {"unit_test": 30, "exam_prep": 40}.get(state["mode"], 20)

    where: dict = {}
    conditions = []
    if state["unit_ids"]:
        conditions.append({"unit_id": {"$in": state["unit_ids"]}})
    if state["material_ids"]:
        conditions.append({"material_id": {"$in": state["material_ids"]}})

    if len(conditions) == 1:
        where = conditions[0]
    elif len(conditions) > 1:
        where = {"$and": conditions}

    query_kwargs: dict = {
        "query_embeddings": [query_embedding],
        "n_results": n_results,
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        query_kwargs["where"] = where

    try:
        results = collection.query(**query_kwargs)
    except Exception:
        return {"source_chunks": [], "error": "No indexed content found. Please ingest course materials first."}

    chunks = []
    if results["documents"] and results["documents"][0]:
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            chunks.append({"text": doc, "metadata": meta, "distance": dist})

    if not chunks:
        return {"source_chunks": [], "error": "No relevant content found for this query. Try selecting different units or materials."}

    return {"source_chunks": chunks, "error": None}


# ── Node: Generator ────────────────────────────────────────────────────────────

def _generator_system(fmt: str) -> str:
    if fmt == "flashcard":
        return """You are a study tool generator. Given source material, produce a JSON array of flashcard objects.
Each object: { "front": string, "back": string }
- "front": concise term, concept, or question
- "back": clear, complete explanation
Output ONLY the raw JSON array. No markdown, no code fences."""

    if fmt == "multiple_choice":
        return """You are a study tool generator. Given source material, produce a JSON array of MCQ objects.
Each object: { "question": string, "choices": string[], "answer": string, "explanation": string }
- "choices": exactly 4 options (e.g. "A) The stack pointer")
- "answer": full correct choice string matching one of choices exactly
- "explanation": why the answer is correct with reference to the material
Output ONLY the raw JSON array. No markdown, no code fences."""

    return """You are a study tool generator. Given source material, produce a JSON array of free response objects.
Each object: { "question": string, "model_answer": string }
- "question": open-ended question requiring explanation
- "model_answer": thorough model answer based strictly on the provided material
Output ONLY the raw JSON array. No markdown, no code fences."""


async def generator_node(state: QuizState) -> dict:
    if state.get("error"):
        return {"questions": [], "error": state["error"]}

    # Build context from retrieved chunks (cap at ~40k chars)
    context_parts = []
    total = 0
    for chunk in state["source_chunks"]:
        text = chunk["text"]
        title = chunk["metadata"].get("title", "")
        unit = chunk["metadata"].get("unit_id", "")
        part = f"[{title}]\n{text}"
        if total + len(part) > 40000:
            break
        context_parts.append(part)
        total += len(part)

    context = "\n\n---\n\n".join(context_parts)
    focus = state.get("intent", state["query"])

    prompt = f"""Generate exactly {state['count']} {state['format'].replace('_', ' ')} items.

Study focus: {focus}

SOURCE MATERIAL:
{context}"""

    system = _generator_system(state["format"])

    try:
        raw = await call_gemini(prompt, system, temperature=0.5, max_tokens=8192)
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        questions = json.loads(cleaned)
        if not isinstance(questions, list):
            raise ValueError("Not an array")
    except Exception as e:
        return {"questions": [], "error": f"Quiz generation failed: {e}"}

    return {"questions": questions, "error": None}


# ── Build graph ────────────────────────────────────────────────────────────────

def build_quiz_graph():
    graph = StateGraph(QuizState)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("generator", generator_node)

    graph.set_entry_point("orchestrator")
    graph.add_edge("orchestrator", "retrieval")
    graph.add_edge("retrieval", "generator")
    graph.add_edge("generator", END)

    return graph.compile()


# ── Evaluator (standalone, called at grade time) ───────────────────────────────

EVALUATOR_SYSTEM = """You are a university exam grader. Grade the student's answer.

Return a JSON object:
{
  "score": 0-10,
  "feedback": "specific feedback on what was correct and what was missing",
  "citations": ["relevant excerpts from source material supporting the correct answer"]
}

Be fair but rigorous. Reference the model answer and source material in your feedback.
Output ONLY the JSON object."""


async def grade_answer(
    question: str,
    model_answer: str,
    student_answer: str,
    source_chunks: list[dict],
) -> dict:
    context = "\n\n".join(c["text"] for c in source_chunks[:5])

    prompt = f"""Question: {question}

Model Answer: {model_answer}

Student Answer: {student_answer}

Source Material:
{context}"""

    try:
        raw = await call_gemini(prompt, EVALUATOR_SYSTEM, temperature=0.1, model="flash-lite")
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        return json.loads(cleaned)
    except Exception as e:
        return {"score": 0, "feedback": f"Grading failed: {e}", "citations": []}


_quiz_graph = None


def get_quiz_graph():
    global _quiz_graph
    if _quiz_graph is None:
        _quiz_graph = build_quiz_graph()
    return _quiz_graph
