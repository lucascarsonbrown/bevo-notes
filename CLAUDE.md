# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Bevo Notes turns UT Austin lecture captions into study notes. **All inference runs in the student's browser** via WebLLM on WebGPU — there are no external LLM API calls anywhere in this codebase, and adding one would undo the core architectural decision.

Two deployed pieces:

| Piece | Location | Deploy target |
|---|---|---|
| Next.js 16 web app + persistence API | `app/`, `components/`, `lib/` | Vercel |
| Chrome extension (MV3) | `LectureNoteTaker/` | Loaded unpacked / Chrome Web Store |

`docs/architecture.md` is the long-form reference. `MVP_DESIGN.md` holds product intent but predates this architecture in most sections — treat it as historical except where noted.

## Commands

```bash
npm run dev               # Next.js dev server on :3000
npm run build             # production build — also the only type-check (tsconfig is noEmit)
npm run lint              # eslint
npm run build:extension   # bundle lib/ai + WebLLM into LectureNoteTaker/vendor/bevo-ai.js
```

**There is no test suite and no test runner.** Verification is `npm run build`, `npm run lint`, and manual exercise in a real browser. Don't invent a test command. Pure logic in `lib/ai/` (chunking, merge, rendering) is straightforward to exercise with a throwaway `npx tsx` script — that's how the VTT and merge bugs were found.

Lint baseline is **13 errors / 5 warnings**, all pre-existing (unescaped entities, `setState` in effects, one `any`). Compare against that number rather than expecting zero.

**After changing anything under `lib/ai/`, run `npm run build:extension`** or the extension keeps running the previous bundle. `LectureNoteTaker/vendor/` is generated and gitignored, so a fresh clone must build it before the extension will load.

## The constraint that shapes everything

The generation model has a **4096-token context window holding prompt and completion together**. A 50,000-character lecture is roughly 12,500 tokens of transcript — about 5× over budget. This is why the pipeline looks the way it does, and any change that assumes a large context will break:

| | tokens |
|---|---|
| System prompt | ~350 |
| Output reserve | ~1000 |
| Transcript per pass | ~2400 (≈9,500 chars) |

Consequences worth internalizing before editing `lib/ai/`:

- **The merge step cannot be a model call.** Several chunks of output exceed the same window the chunking exists to avoid. `lib/ai/merge.ts` is pure data manipulation and must stay that way. The only reduce-step model call is the title, and it sees *headings only*.
- **The model emits data, never markup.** Formulas come back as LaTeX strings; `lib/ai/render.ts` turns them into MathML via KaTeX. Never ask the model for HTML.
- **Chunks are generated independently.** Cross-chunk drift is absorbed by dedupe in `merge.ts` (terms deduped by normalized form, first wins), not by threading shared context through passes.
- **Structure is enforced, content is not.** WebLLM's constrained decoding against the schemas in `lib/ai/schema.ts` makes malformed JSON impossible. It guarantees a well-formed `definitions` array, never correct definitions.

## Capability gating and read-only mode

`lib/ai/capability.ts` runs before any download and returns one of three modes:

| Mode | Model | Trigger |
|---|---|---|
| `full` | `Llama-3.2-1B-Instruct-q4f16_1-MLC` (879 MB) | adapter limits ≥ 879 MB |
| `reduced` | `SmolLM2-360M-Instruct-q4f16_1-MLC` (376 MB) | limits ≥ 376 MB |
| `readonly` | none | no `navigator.gpu`, null adapter, or insufficient limits |

Browser support is no longer the main constraint — **memory is**. Weights must fit in GPU-addressable memory, which on integrated graphics and Apple Silicon comes out of shared system RAM. A null adapter usually means a blocklisted driver, not a missing GPU.

`lib/ai/prewarm.ts` warms the generation model in the background once the user lands on an app route (`/dashboard`, `/courses`, `/notes`, `/settings` — never the landing or login page, so a bouncing visitor never pays for weights). It goes through the same `getEngine` singleton generation uses, so a warmed engine is picked up automatically with no call-site changes. It skips on `saveData` or a 2g connection unless the weights are already in Cache Storage, and honours the `bevo-preload` localStorage opt-out. `hasModelInCache` distinguishes a fresh ~880 MB download (shown in `components/ModelPreloadIndicator.tsx`) from a cache hit (silent).

**Read-only is a first-class state, not an error.** Those users keep reading, organizing, searching, and exporting; only generation controls are hidden or disabled. Any new generation affordance must check `useAICapability()` and render `components/ReadOnlyNotice.tsx`. There is no server-side fallback to fall back to.

Note `Llama-3.2-1B` is *smaller* than `Qwen2.5-0.5B` (879 vs 945 MB) despite double the parameters — the 0.5B model's vocabulary embedding outweighs its parameter savings.

## API routes are persistence-only

Every route under `app/api/` validates auth and ownership, then reads or writes Supabase. **None of them perform inference.** The client generates, then POSTs the result.

- `POST /api/notes/generate` saves a client-generated note. `GET /api/notes/generate?transcript_hash=` is a pre-flight cache check so a client never spends minutes regenerating an existing note. The server hashes the transcript itself rather than trusting a client-supplied hash; the client's `crypto.subtle` hash is verified to match Node's `createHash('sha256')`, including non-ASCII — dedupe fails silently if these diverge.
- `POST /api/study/generate` saves client-generated questions.
- `GET /api/notes?include_content=1` returns full `notes_html` instead of previews, for browser-side quiz generation. List views stay on previews.

A consequence of this inversion: the server can no longer attest that a "note" was actually model-generated. That's accepted.

## Extension architecture (MV3)

Generation runs in an **offscreen document**, not the popup and not the service worker:

- The popup closes on focus loss, which would kill a multi-minute run.
- MV3 service workers can be terminated on the idle timer.

`background.js` owns the offscreen document's lifecycle and mirrors progress into `chrome.storage.local` under `bevo_generation_state`, so reopening the popup reattaches to a run in flight rather than restarting it. Requires Chrome 124+ (WebGPU in extension contexts).

`content.js` returns the **raw VTT**, not flattened text. The timestamps matter: `lib/ai/chunk.ts` splits at the longest silence in the tail of each buffer because professors pause at topic transitions. Fixed-width cuts land mid-derivation and produce two halves that each make no sense.

MV3 forbids remote code, so WebLLM and `lib/ai/` are bundled locally by `scripts/build-extension.mjs`. The extension deliberately reuses the same modules as the web app rather than carrying a parallel implementation that would drift.

## Local RAG

`lib/ai/rag.ts` + `lib/ai/vectorstore.ts` index notes into IndexedDB and retrieve with brute-force cosine similarity. Uses `@langchain/core` and `@langchain/textsplitters`, but drives WebLLM **directly** rather than through `ChatWebLLM`, which has known breakage against recent web-llm releases ([langchainjs#5648](https://github.com/langchain-ai/langchainjs/issues/5648)) — this also avoids pulling in the very large `@langchain/community`.

**The index is per-origin and per-device.** The extension (`chrome-extension://`) and the web app (`vercel.app`) have separate IndexedDB stores, so an index built while generating in the extension is invisible to the web app. Each origin rebuilds its own from server-stored notes via `ensureNotesIndexed`. The index is also lost if the user clears site data, and notes saved before `notes_json` existed can't be indexed at all — retrieval returning nothing is normal, and callers fall back to raw note text.

Query and document vectors must both come from `snowflake-arctic-embed-s`. Mixing embedding models silently destroys retrieval quality rather than erroring.

## Database

Migrations are hand-run SQL, applied in order in the Supabase SQL editor: `supabase-schema-v2.sql` → `v3` → `v4`. There is no migration tool — a schema change means adding `supabase-schema-v5.sql` and telling the user to run it. RLS is on for every table.

`notes.notes_json` holds the structured document; `notes_html` is the rendered form. Keep both — the JSON is what makes notes re-renderable and indexable.

## Current state / gotchas

- **No root `middleware.ts` exists.** `lib/supabase/middleware.ts` exports `updateSession()` but nothing imports it, so Supabase sessions aren't refreshed at the edge. If you touch auth, that's the missing wiring.
- **PDF and image materials are unsupported.** `app/api/materials/[id]/process` handles `.txt`/`.md` only and returns 415 otherwise. Extraction used to rely on Gemini's vision API; the local model is text-only. Re-adding this needs pdf.js plus an OCR path, not a model call.
- `LectureNoteTaker/config.js` has an `IS_PRODUCTION` flag that must be flipped before shipping, and `PROD_URL` is still a placeholder.
- Theming is `lib/hooks/useTheme.ts` (localStorage `bevo-theme`), applied per-component — no global provider.
- `LectureNoteTaker.zip` (72 MB) is a committed build artifact from an older version.
- `MVP_DESIGN.md` is gitignored, so it isn't visible to anything reading the repo from git.

## Environment

`.env.local` needs only Supabase values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.

Retired and safe to delete if still present: `GEMINI_API_KEY`, `FASTAPI_URL`, `SERVICE_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `ENCRYPTION_KEY`.
