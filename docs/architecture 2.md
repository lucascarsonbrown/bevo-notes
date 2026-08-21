# Bevo Notes — Platform Architecture

## Overview

Bevo Notes is an AI-powered study platform for students. Users upload course materials (syllabi, textbooks), generate structured lecture notes with AI, and create study tools (flashcards, multiple choice, free response) from that content. The platform manages all AI API keys — users never supply their own.

---

## System Map

```
Browser (Next.js frontend)
        │
        ▼
Vercel (Next.js App Router)
  ├── Pages & UI
  └── API Routes (/app/api/...)
        │
        ├──────────────────────────────► Supabase
        │   auth, user data, notes,      (Postgres + Auth + Storage)
        │   courses, materials, quizzes
        │
        ├──────────────────────────────► Gemini API (Google)
        │   note generation,             (platform key, not user-supplied)
        │   fallback quiz generation,
        │   material text extraction
        │
        ├──────────────────────────────► Stripe
        │   subscription checkout,       (payments + webhooks)
        │   billing portal,
        │   webhook sync
        │
        └──────────────────────────────► FastAPI Service (Railway)
            RAG quiz generation,         (Python, ChromaDB, LangGraph)
            semantic search,
            content ingestion
```

---

## Services

### 1. Next.js on Vercel
The main application. Handles all frontend rendering and acts as the API layer between the browser and external services. Every sensitive operation (AI calls, DB writes, Stripe) goes through Next.js API routes — the browser never calls Gemini or Supabase directly with privileged credentials.

**Key pages:**
- `/dashboard` — course overview, usage stats
- `/courses/[id]` — course detail, units, materials
- `/notes/[id]` — rich text note editor
- `/courses/[id]/study/[toolId]` — flashcard/quiz interface
- `/pricing` — plan selection
- `/settings` — account, subscription management

---

### 2. Supabase
Handles authentication and the primary database.

**Auth:** Email/password via Supabase Auth. Session cookies managed server-side with `@supabase/ssr`. The `/auth/callback` route handles OAuth redirects.

**Database tables:**
| Table | Purpose |
|-------|---------|
| `users` | Profile, subscription tier, Stripe customer/subscription IDs |
| `courses` | Top-level course containers |
| `units` | Subdivisions of a course (Week 1, Chapter 2, etc.) |
| `notes` | AI-generated lecture notes, stored as HTML |
| `materials` | Uploaded files (syllabus, textbook) with extracted text |
| `quizzes` | Generated study tools (questions stored as JSON) |
| `folders` | Optional note organization |

**Row-level security (RLS)** is enabled on all tables — users can only read/write their own data.

---

### 3. Gemini API (Google)
The platform's AI backbone. A single `GEMINI_API_KEY` is set server-side — users never see or manage it.

**Used for:**
- **Note generation** (`/api/notes/generate`) — converts raw lecture text into structured HTML notes using `gemini-2.0-flash`
- **Quiz generation fallback** (`/api/study/generate`) — when the FastAPI RAG service is unavailable, generates questions directly from raw note text
- **Quiz grading fallback** (`/api/study/grade`) — scores free-response answers when FastAPI is unavailable
- **Material text extraction** (`/api/materials/[id]/process`) — extracts readable text from uploaded syllabi and textbooks
- **Unit suggestion** (`/api/courses/[id]/units/suggest`) — suggests unit structure from a syllabus

**Models used:**
- `gemini-2.0-flash` — primary, used for note generation and quiz generation
- `gemini-2.0-flash-lite` — lightweight, used for grading and intent parsing

---

### 4. Stripe
Handles all payment and subscription logic.

**Flow:**
1. User clicks "Get Pro" on `/pricing`
2. Frontend POSTs to `/api/stripe/checkout` → creates a Stripe Checkout Session → redirects user to Stripe-hosted payment page
3. On success, Stripe redirects to `/dashboard?upgraded=1`
4. Stripe sends a `checkout.session.completed` webhook to `/api/stripe/webhook`
5. Webhook retrieves the subscription, maps the price ID to `pro` tier, updates the `users` table in Supabase

**Webhook events handled:**
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Retrieve subscription, sync tier to DB |
| `customer.subscription.created` | Sync tier to DB |
| `customer.subscription.updated` | Sync tier to DB (handles plan changes) |
| `customer.subscription.resumed` | Sync tier to DB |
| `customer.subscription.deleted` | Reset user to `free` tier |
| `customer.subscription.paused` | Reset user to `free` tier |

**Billing portal:** Paid users can manage/cancel via Stripe's hosted portal, accessed from `/settings` → calls `/api/stripe/portal` → redirects to Stripe.

**Plans:**
| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 1 course, 6 notes, 5 quizzes (all lifetime) |
| Pro | $10/mo | Unlimited everything, 100 quizzes/month soft cap |

---

### 5. FastAPI Service on Railway (Python)
A separate Python microservice that handles semantic search and AI-powered quiz generation via a RAG (Retrieval Augmented Generation) pipeline. Deployed independently from the Next.js app.

**Authentication:** All requests require an `x-service-secret` header matching the `SERVICE_SECRET` env var shared between Next.js and Railway.

**Components:**

#### ChromaDB (vector database)
- Runs embedded within the FastAPI process (persistent local directory)
- Stores text chunks as vector embeddings
- One collection per user+course: `u{user_id[:16]}_c{course_id[:16]}`
- Used to retrieve semantically relevant content before generating quizzes

#### Embeddings
- Uses Gemini `text-embedding-004` REST API
- Text is chunked into ~1000 character segments with 150 character overlap before embedding

#### LangGraph Quiz Pipeline
Runs as a directed graph with three nodes:

```
Orchestrator → Retrieval → Generator → END
```

- **Orchestrator** — parses the user's intent and rewrites their query into a search-optimized form using `gemini-2.0-flash-lite`
- **Retrieval** — embeds the refined query, queries ChromaDB with optional unit/material filters, returns top-k relevant chunks
- **Generator** — builds a context string from retrieved chunks (capped at 40k chars), calls `gemini-2.0-flash` to produce a JSON array of questions

**Grading:** A standalone `grade_answer()` function retrieves 5 relevant context chunks and uses Gemini to score the student's answer (0–100) with source citations.

**API endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check (used by Next.js before every RAG call) |
| POST | `/ingest/text` | Chunk, embed, and store text content in ChromaDB |
| POST | `/ingest/pdf` | Download PDF, extract text, chunk, embed, store |
| DELETE | `/ingest/` | Remove all chunks for a given material |
| POST | `/search/query` | Semantic search with optional filters |
| POST | `/quiz/generate` | Run LangGraph pipeline, return questions |
| POST | `/quiz/grade` | Grade a student answer with citations |

---

## Request Flows

### Generating a Lecture Note
```
User pastes lecture text in browser
  → POST /api/notes/generate
  → Supabase: verify auth, check limit (free tier lifetime cap)
  → Gemini flash: generate structured HTML notes
  → Supabase: save note to `notes` table
  → Return HTML to browser → render in editor
```

### Generating a Quiz (with RAG)
```
User selects units/materials, clicks Generate
  → POST /api/study/generate
  → Supabase: verify auth, check quiz limit (free lifetime / pro monthly)
  → GET FastAPI /health (3s timeout)
      ├── FastAPI available:
      │     POST /quiz/generate → LangGraph pipeline
      │     Orchestrator refines query → Retrieval pulls chunks from ChromaDB
      │     Generator produces questions from retrieved context
      │     Return questions to Next.js
      └── FastAPI unavailable:
            Fetch notes + material text from Supabase
            POST to Gemini directly with raw text
            Parse JSON response
  → Supabase: save quiz to `quizzes` table
  → Return questions to browser
```

### Stripe Subscription
```
User clicks "Get Pro" on /pricing
  → POST /api/stripe/checkout
  → Supabase: look up stripe_customer_id
  → Stripe: create customer if new, create Checkout Session
  → Redirect browser to Stripe hosted checkout
  → User pays
  → Stripe: POST to /api/stripe/webhook (checkout.session.completed)
  → Webhook: retrieve subscription, map price_id → 'pro'
  → Supabase: update users SET subscription_tier = 'pro'
  → User lands on /dashboard?upgraded=1
```

---

## Environment Variables

### Next.js (Vercel)
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Production URL (e.g. https://www.bevonotes.com) |
| `GEMINI_API_KEY` | Google Gemini platform key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe price ID for the Pro plan |
| `FASTAPI_URL` | URL of the Railway FastAPI service |
| `SERVICE_SECRET` | Shared secret for Next.js ↔ FastAPI auth |

### FastAPI (Railway)
| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini platform key (same as Next.js) |
| `SERVICE_SECRET` | Must match Next.js `SERVICE_SECRET` |
| `CHROMA_PERSIST_DIR` | Directory for ChromaDB storage (default: `/data/chroma`) |
| `ALLOWED_ORIGINS` | CORS origins (set to your Vercel URL) |

---

## Graceful Degradation

The FastAPI service is optional. Every route that calls FastAPI first checks `/health` with a 3-second timeout. If the service is down or not yet deployed, the system falls back to calling Gemini directly with raw text from Supabase. This means:

- Quiz generation always works (just without semantic retrieval)
- Grading always works (just without source citations)
- The app can be deployed and used before Railway is set up

---

## Subscription & Usage Enforcement

Usage limits are checked server-side in every relevant API route via `checkLimit()` in `lib/usage.ts`.

- **Free tier:** Lifetime counts — once a user hits the cap on notes, quizzes, etc., they must upgrade. Counts never reset.
- **Pro tier:** Monthly quiz cap (100/month, resets on the 1st). Everything else is unlimited.
- **Unlimited tier check:** `subscription_tier` is read from the `users` table on every request. Stripe webhooks keep this in sync in real time.
