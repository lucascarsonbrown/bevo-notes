# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Bevo Notes is an AI study platform for UT Austin students. One repo, **three independently deployed pieces**:

| Piece | Location | Deploy target |
|---|---|---|
| Next.js 16 web app + API layer | `app/`, `components/`, `lib/` | Vercel |
| Python FastAPI RAG service | `python-service/` | Railway (Docker) |
| Chrome extension (MV3) | `LectureNoteTaker/` | Loaded unpacked / Chrome Web Store |

`docs/architecture.md` is the long-form reference (request flows, DB tables, Stripe webhook table, env var tables). Read it before any cross-service change. `GOAL.md` holds product intent.

## Commands

```bash
npm run dev            # Next.js dev server on :3000
npm run build          # production build (also the only type-check — tsconfig is noEmit)
npm run lint           # eslint (flat config, next core-web-vitals + typescript)

# FastAPI service
cd python-service && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

There is **no test suite and no test runner** in this repo. Verification is `npm run build` + manual exercise of the app. Don't invent a test command.

Chrome extension: load `LectureNoteTaker/` unpacked at `chrome://extensions/` with Developer mode on. After editing extension files, hit refresh on the extension card *and* reload the lecture page (the content script only injects on fresh page load).

## Architecture notes that aren't obvious from the file tree

**The browser never holds privileged credentials.** All Gemini, Supabase-admin, and Stripe calls go through `app/api/*` route handlers. The Chrome extension is just another client of those same routes — it authenticates by sending the web app's session cookie (`credentials: 'include'` in `LectureNoteTaker/auth.js`), so a user must log in on the web app first.

**Every mutating API route follows the same shape:**
```ts
const supabase = await createClient();            // lib/supabase/server.ts, cookie-based
const { data: { user } } = await supabase.auth.getUser();
if (!user) return 401;
const check = await checkLimit(supabase, user.id, 'notes');   // lib/usage.ts
if (!check.allowed) return 403 with limitErrorResponse(...);
```
Never bypass `checkLimit` when adding a route that creates a course, note, quiz, or material — it is the only enforcement point for the freemium model. Free tier is *lifetime* counts; Pro is unlimited except a monthly quiz cap.

**Gemini is called with raw `fetch` against the REST endpoint**, not an SDK, with the model URL hardcoded per-route. `gemini-2.0-flash` for generation-heavy work, `gemini-2.0-flash-lite` for grading/intent/notes. Key comes from `process.env.GEMINI_API_KEY` — the platform owns it; there is no user-supplied-key path (see Legacy below).

**FastAPI is optional by design.** `lib/fastapi.ts` exposes `isFastapiAvailable()` (3s `/health` probe); routes that use RAG call it first and fall back to a direct Gemini call over raw text from Supabase. Any new FastAPI-backed feature must keep a working fallback, or the app breaks whenever Railway is down. Next.js ↔ FastAPI auth is a shared `SERVICE_SECRET` sent as the `x-service-secret` header; the Python side checks it per-router (`verify_internal`).

**ChromaDB is embedded in the FastAPI process** on a persistent local dir (`CHROMA_PERSIST_DIR`) — it is not a separate service, and the data does not survive a container without a mounted volume. One collection per user+course, named `u{user_id[:16]}_c{course_id[:16]}` (dashes stripped) via `db/chroma.py:collection_name`.

**Quiz generation is a LangGraph graph** in `python-service/agents/quiz_pipeline.py`: Orchestrator (rewrite query) → Retrieval (embed + Chroma query with unit/material filters) → Generator (Gemini → JSON array). Grading is a separate standalone `grade_answer()`, not part of the graph.

**Database migrations are hand-run SQL.** `supabase-schema-v2.sql`, then `supabase-schema-v3.sql`, pasted into the Supabase SQL editor in order. There is no migration tool — a schema change means adding a new `supabase-schema-vN.sql` and telling the user to run it. RLS is on for every table.

**Stripe tier state lives in the `users` table** and is synced only by `/api/stripe/webhook`. Price ID → tier mapping is `STRIPE_PRO_PRICE_ID` → `'pro'`; anything else falls through. `lib/stripe.ts` lazily constructs the client (module-level construction would break builds without the env var) — use `getStripe()` inside handlers.

## Gotchas / current state

- **No root `middleware.ts` exists.** `lib/supabase/middleware.ts` exports `updateSession()` but nothing imports it, so Supabase sessions are not refreshed at the edge. If you touch auth, that's the missing wiring, not a bug in the helper.
- `app/layout.tsx` still has the create-next-app default `metadata` title/description.
- Theming is `lib/hooks/useTheme.ts` (localStorage key `bevo-theme`), applied per-component — there is no global theme provider or `dark:` class on `<html>`.
- `LectureNoteTaker/config.js` has an `IS_PRODUCTION` boolean that must be flipped before shipping the extension; `PROD_URL` is still a placeholder Vercel URL.
- `LectureNoteTaker/CLAUDE.md` and `LectureNoteTaker/README.md` are **stale**: they describe an OpenAI-powered, hardcoded-API-key, standalone extension. The extension now calls this repo's backend. Treat this file as authoritative and fix those when working in that directory.

### Legacy / dead code — don't build on it
- `app/api/user/api-key/route.ts` returns HTTP 410 for all methods; the BYOK system was removed and the columns dropped in v3.
- `lib/utils/encryption.ts` (and `ENCRYPTION_KEY`) is unreferenced — it existed to encrypt user Gemini keys.
- `LectureNoteTaker/auth.js:checkApiKeyStatus()` still calls the retired `/api/user/api-key/status` endpoint.
- `LectureNoteTaker.zip` (72 MB) is a committed build artifact.

## Environment

`.env.local` for Next.js, `python-service/.env` for FastAPI (see `.env.example`). Both need the same `GEMINI_API_KEY` and the same `SERVICE_SECRET`. Full variable tables are in `docs/architecture.md`.
