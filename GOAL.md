# Bevo Notes — Product Goal

## What We're Building

Bevo Notes is an AI-powered study platform for UT Austin students. It automatically generates lecture notes from UT Lectures Online, allows students to upload course materials (syllabi, textbooks), and quizzes them intelligently across all of their course content using multi-agent AI orchestration.

---

## Target User

UT Austin students who want a single place to capture lecture notes, organize course materials, and actively study — without switching between 10 different tools.

---

## Delivery Format

- **Chrome Extension** — captures lecture transcripts from lecturecapture.la.utexas.edu and triggers note generation
- **Web App** — dashboard for managing courses, materials, units, and quizzes
- Future consideration: evolve into a standalone desktop/mobile app

---

## Business Model

- **Freemium** — free tier to build habit, paid tiers to monetize
- **Standard Plan**: monthly subscription with a capped number of LLM calls per month (exact limit TBD after estimating real usage post-build)
- **Unlimited Plan**: significantly more expensive, uncapped LLM calls — marketed as a premium anchor to make Standard feel reasonable
- We manage the Gemini API key; users pay us, not Google directly
- Pricing to be finalized after building and profiling average user LLM consumption

### Free Tier Limits
| Feature | Free Allowance |
|---|---|
| Courses | 1 |
| Syllabus uploads | 1 |
| Textbook uploads | 0 |
| AI lecture notes | 6 |
| Quizzes | 5 |
| Custom note PDFs | 0 |

Free tier is designed to get a student through one full week of a real class and one solid quiz session — the conversion moment. Textbooks are excluded because large PDF processing is the most token-expensive operation.

---

## Core Features

### 1. Courses
- Courses map to **real UT Austin courses** pulled from the UT course catalog (e.g. CS 429 - Computer Architecture)
- Courses persist across semesters — a student's CS 429 notes from Fall 2024 stay in their history
- Each course contains multiple content types (see below)

### 2. Content Types (per course)
| Type | Source | How it gets in |
|---|---|---|
| Lecture Notes | UT Lectures Online | Chrome extension auto-generates from captions |
| Syllabus | PDF | User uploads |
| Textbook | PDF | User uploads (whole book) |
| Custom Notes | Freeform | User writes manually in app |

### 3. Units / Sections
- Each course is organized into **units or sections** (e.g. "Unit 1: Memory Management", "Midterm 2 Material")
- Users can create units manually, OR the AI can suggest unit breakdowns based on the uploaded syllabus
- All content (notes, textbook chapters, custom notes) can be tagged to a unit
- Units are the primary lens through which quizzes are generated

### 4. Quiz System
- Users initiate quizzes with natural language:
  - *"Quiz me on pointers"*
  - *"Quiz me on notes from last Tuesday"*
  - *"Quiz me on Unit 3"*
  - *"Give me an exam prep for the final"*
  - *"Generate a unit test for Unit 2"*
- **Quiz formats**: Flashcards, Multiple Choice, Free Response — all three supported
- **Quiz sources**: User specifies (notes, textbook, syllabus, or any combination)
- **AI grading**: Free-response answers are graded by AI with specific feedback and citations from source material
- **Special modes**:
  - **Unit Test Mode** — comprehensive quiz covering a full unit
  - **Exam Prep Mode** — broader, weighted quiz across multiple units or the whole course

---

## Technical Architecture

### Frontend
- **Next.js** (TypeScript + Tailwind CSS) — existing stack, keep it
- **Chrome Extension** (Manifest V3) — existing, extend for new content types

### Backend — Two-Layer
- **Next.js API Routes** — thin layer for auth, CRUD, and routing
- **Python FastAPI Service** — owns all AI orchestration, PDF processing, vector ops

### Database
- **Supabase (PostgreSQL)** — users, courses, notes, materials, quiz history
- **ChromaDB** — vector database for semantic search and RAG over all course materials

### AI Stack
- **Google Gemini API** — all LLM calls (note generation, quiz generation, grading)
- **LangGraph** — multi-agent orchestration for the quiz pipeline
- **Langfuse** — LLM observability: trace every call, monitor per-user cost and latency, track quality over time (critical for subscription pricing validation)

### Multi-Agent Quiz Pipeline (LangGraph)
```
User Query ("quiz me on Unit 2")
        ↓
  [Orchestrator Agent]  — interprets intent, selects sources, picks quiz format
        ↓
  [Retrieval Agent]     — semantic search over ChromaDB for relevant chunks
        ↓
  [Quiz Generator Agent] — produces flashcards / MCQ / free-response questions
        ↓
  [Evaluator Agent]     — grades answers, generates feedback with source citations
```

### Document Ingestion Pipeline
```
PDF Upload (syllabus / textbook)
        ↓
  [Chunker Agent]       — splits PDF into logical chunks
        ↓
  [Embedder Agent]      — generates embeddings via Gemini
        ↓
  ChromaDB              — stores chunks + metadata (course, unit, doc type)
```

### Observability (Langfuse)
- Trace every LLM call end-to-end
- Track token usage and cost per user
- Monitor latency per agent node
- Use data to validate subscription tier limits and pricing

---

## Data Model (High Level)

```
User
 └── Courses (linked to UT catalog)
      └── Units / Sections
           └── Lecture Notes
           └── Syllabus
           └── Textbook Chapters
           └── Custom Notes
           └── Quizzes
                └── Questions
                └── Attempts + Graded Responses
```

---

## Out of Scope (for now)
- Local model deployment (no Ollama)
- Mobile app
- Non-UT universities
- Spaced repetition / Anki-style scheduling
- Social / collaborative features
- Analytics per UT course (future: aggregate anonymized data across students in same course)

---

## Future Possibilities
- Per-course analytics (how are students in CS 429 performing on Unit 3?)
- Shared textbook/syllabus bank per UT course — upload once, available to all students in that course
- Evolve into a standalone desktop or mobile application
- Expand to other universities
