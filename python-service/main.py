"""
Bevo Notes — Python FastAPI service
Handles: ChromaDB ingestion, LangGraph quiz pipeline, semantic search
"""

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

from routers import ingest, quiz, search

app = FastAPI(title="Bevo Notes AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
app.include_router(search.router, prefix="/search", tags=["search"])


@app.get("/health")
def health():
    return {"status": "ok"}
