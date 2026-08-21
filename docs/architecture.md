# Bevo Notes — Platform Architecture

## Overview

Bevo Notes turns UT Austin lecture captions into structured study notes and practice material. **Every model call runs in the student's browser**, on their own GPU, through WebLLM. The platform holds no AI API keys, pays no per-token cost, and sends no lecture content to a third party.

---

## System Map

```
Chrome Extension (MV3)                     Browser (Next.js app)
  ├── content.js                             ├── Pages & UI
  │     reads VTT captions                   ├── lib/ai — WebLLM, RAG
  ├── background.js (service worker)         │     generation, grading
  │     owns offscreen lifecycle             └── IndexedDB vector store
  └── offscreen.js
        ├── WebLLM (WebGPU) ── generation
        └── vendor/bevo-ai.js (bundled lib/ai)
                    │
                    │  save / read only
                    ▼
        Vercel (Next.js App Router)
          └── API routes — persistence only, no inference
                    │
                    ▼
                 Supabase
        (Postgres + Auth + Storage, RLS on)
```

There is no AI service tier. There is no Python service. There is no external model provider.

---

## Where inference happens

| Task | Runs | Model |
|---|---|---|
| Lecture notes | Extension offscreen document | `Llama-3.2-1B-Instruct-q4f16_1-MLC` |
| Study tools | Web app | same |
| Free-response grading | Web app | same |
| Embeddings (RAG) | Web app | `snowflake-arctic-embed-s-q0f32-MLC-b4` |

A `full`-capability user downloads roughly 1.1 GB once, cached by the browser thereafter.

---

## The context budget

The binding constraint on the whole design: **4096 tokens, holding prompt and completion together.**

| | tokens |
|---|---|
| System prompt | ~350 |
| Output reserve | ~1000 |
| Transcript per pass | ~2400 (≈9,500 chars) |

A 50,000-character lecture becomes **~5 passes**. It does not merely overflow a single call — it exceeds the window about fivefold, so chunking is structural rather than an optimization.

### Note generation pipeline

1. **Capture** — `content.js` returns raw VTT so timings survive.
2. **Parse** — `lib/ai/chunk.ts` builds timestamped cues and collapses rolling-caption duplicates.
3. **Chunk** — split at the longest silence in the tail of each buffer. Professors pause at topic transitions, so silence is a free topic boundary; fixed-width cuts split proofs mid-derivation.
4. **Generate** — one constrained-decoding pass per chunk against `CHUNK_SCHEMA`, returning flat JSON. Passes are independent.
5. **Merge** — `lib/ai/merge.ts`, deterministic: fold duplicate headings, dedupe definitions by normalized term (first wins), dedupe key points.
6. **Title** — the one reduce-step model call, over headings only.
7. **Render** — `lib/ai/render.ts` produces HTML and converts LaTeX to MathML via KaTeX.
8. **Persist** — POST both `notes_json` and `notes_html`.

**Why the merge is not a model call:** five chunks of output run to thousands of tokens, hitting the same 4096-token wall the chunking exists to work around. Combining generated notes through the model reproduces the original problem one layer up. The reduce step must stay deterministic.

**Why the model never emits markup:** it writes LaTeX into a data field and the renderer produces MathML. This makes malformed markup structurally impossible and plays to training-data strengths — small models have seen far more LaTeX than MathML.

**What constrained decoding does and doesn't buy:** schemas make invalid JSON impossible. They say nothing about whether the content is correct. A well-formed `definitions` array can still be wrong.

---

## Capability gating

`lib/ai/capability.ts` checks `navigator.gpu`, requests an adapter, and compares `maxBufferSize` / `maxStorageBufferBindingSize` against the model's published `vram_required_MB` — all **before** any download.

| Mode | Condition | Behavior |
|---|---|---|
| `full` | limits ≥ 879 MB | Llama-3.2-1B + embeddings |
| `reduced` | limits ≥ 376 MB | SmolLM2-360M, no semantic retrieval |
| `readonly` | no WebGPU, null adapter, or below 376 MB | read/organize/export only |

Browser support is no longer the limiting factor (~84% globally per caniuse; Firefox is the holdout). **Memory is.** On integrated graphics and Apple Silicon the GPU draws from shared system RAM, so a loaded browser on an 8 GB machine can fail to allocate. A null adapter typically means a blocklisted driver rather than absent hardware.

Read-only users keep the whole product except generation. **There is no server-side fallback** — removing external APIs removed the last one, and that is a deliberate trade.

---

## Extension (MV3)

Generation lives in an **offscreen document**. The popup would die on focus loss and a service worker can be killed on the idle timer; a lecture takes minutes. `background.js` owns the document and mirrors progress into `chrome.storage.local` (`bevo_generation_state`) so the popup can reattach to a run in progress.

Before generating, the extension asks `GET /api/notes/generate?transcript_hash=` so a student never waits minutes for a note they already have.

MV3 forbids remote code, so `scripts/build-extension.mjs` bundles `lib/ai` and WebLLM into `LectureNoteTaker/vendor/bevo-ai.js` (~6 MB, gitignored). The extension shares the web app's modules rather than duplicating the pipeline.

Requires Chrome 124+, where WebGPU became available in extension contexts.

---

## Local RAG

Indexing and retrieval are entirely client-side:

- `@langchain/textsplitters` splits section text (1000 chars, 150 overlap).
- `WebLLMEmbeddings` implements LangChain's `Embeddings` over the arctic-embed model.
- `lib/ai/vectorstore.ts` persists vectors in IndexedDB and searches by brute-force cosine similarity — per-course corpora are small enough that an index would be premature.

Generation is driven through WebLLM directly rather than `ChatWebLLM`, which has known breakage against recent web-llm releases (langchainjs#5648); this also avoids depending on the very large `@langchain/community`.

### Consequences of deleting the server-side vector store

- **Per-device.** The index is built locally and lost when site data is cleared.
- **Per-origin.** Extension and web app have separate IndexedDB stores; each rebuilds its own from server-held notes via `ensureNotesIndexed`.
- **Not universal.** Notes predating `notes_json` cannot be indexed. Retrieval returning nothing is expected; callers fall back to raw note text.

---

## API routes

Every route validates auth and ownership against Supabase and performs **no inference**.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/notes/generate?transcript_hash=` | Pre-flight cache check |
| POST | `/api/notes/generate` | Save a client-generated note |
| POST | `/api/study/generate` | Save client-generated questions |
| GET | `/api/notes?include_content=1` | Full note text for browser-side generation |
| POST | `/api/materials/[id]/process` | Decode `.txt`/`.md`; 415 otherwise |
| GET | `/api/usage` | Display counts (no gating) |

The server hashes transcripts itself rather than trusting a client hash. The client's `crypto.subtle` SHA-256 is verified to match Node's `createHash('sha256')` byte-for-byte, including non-ASCII input — dedupe fails silently if these diverge.

**Trust boundary:** with generation client-side, the server can't attest that a note was model-produced. Accepted.

---

## Data model

| Table | Purpose |
|---|---|
| `users` | Profile. No subscription or billing columns as of v4. |
| `courses` | Course containers |
| `units` | Course subdivisions |
| `notes` | `notes_json` (structured) + `notes_html` (rendered) |
| `materials` | Uploaded `.txt`/`.md` with extracted text |
| `quizzes` | Generated study tools (JSON) |
| `folders` | Optional organization |

Migrations are hand-run in order: `supabase-schema-v2.sql` → `v3` → `v4`. RLS on all tables.

---

## Environment

Supabase only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.

No AI keys. No payment keys. No service secrets.

---

## Cost model

Inference is free at the margin — it runs on hardware the student already owns. Remaining costs are Vercel hosting, Supabase, and storage. There is no metering to enforce and, as of v4, no billing code.

The trade is quality and reach: a 1B model does not match a frontier hosted model on a 45-minute lecture, and users without capable hardware get a read-only product.
