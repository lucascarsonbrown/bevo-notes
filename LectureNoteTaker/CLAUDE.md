# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This is the Chrome extension (Manifest V3) for Bevo Notes. The repo root has its own `CLAUDE.md` covering the web app and the shared `lib/ai` pipeline — read that first; this file only covers extension-specific concerns.

## The model runs here, locally

The extension generates notes with **WebLLM on WebGPU, on the user's own machine**. There is no OpenAI key, no Gemini key, and no server-side inference. Any earlier documentation describing a hardcoded API key is obsolete.

Requires **Chrome 124+** — that is when WebGPU became available in extension contexts.

## Component flow

1. **`content.js`** — injected into `lecturecapture.la.utexas.edu`. Finds the `caption_proxy` URL via the Performance API and returns the **raw VTT** plus a flattened transcript. Returning raw VTT is deliberate: the timestamps let `lib/ai/chunk.ts` split on the lecturer's pauses instead of at arbitrary character offsets.

2. **`popup.js`** — UI only. Asks the service worker for a capability check, requests the transcript, then hands off. It does not generate. Closing the popup does not cancel a run; on reopen it reattaches to `bevo_generation_state` in `chrome.storage.local`.

3. **`background.js`** — service worker. Owns the offscreen document's lifecycle and mirrors progress into storage.

4. **`offscreen.js`** — hosts the model. Checks the server for an existing note by transcript hash, generates, then saves.

5. **`notes.js` / `notes.html`** — viewer for the most recent notes.

### Why generation lives in an offscreen document

Not the popup: it closes on focus loss, killing a run mid-way. Not the service worker: MV3 can terminate it on the idle timer. A lecture takes several passes and minutes to finish, so it needs a context that survives both.

## Build step

`vendor/bevo-ai.js` is **generated** — it is `lib/ai` plus WebLLM bundled by esbuild, and it is gitignored. From the repo root:

```bash
npm run build:extension
```

Run this after any change under `lib/ai/`, or the extension keeps executing the previous bundle. A fresh clone must run it before the extension will load at all.

MV3 forbids remote code, which is why everything ships inside the package. The extension shares the web app's modules on purpose — a hand-written copy of the chunking, merge, and rendering logic would drift from the tested one.

## Loading and testing

1. `npm run build:extension` from the repo root.
2. `chrome://extensions/` → enable Developer mode → Load unpacked → select this directory.
3. Open a lecture on `lecturecapture.la.utexas.edu`, enable CC, and scrub to force caption loading.
4. Click the extension icon and generate.

The user must be logged in to the web app first — the extension authenticates by sending that session cookie to the backend.

**Expect the first run to be slow.** It downloads ~880 MB of weights before generating anything, then runs several passes. Subsequent runs load from cache.

## Common issues

- **"No caption_proxy request found"** — captions weren't enabled, or the video hasn't been scrubbed to trigger caption loading.
- **"Please reload the lecture page"** — the content script only injects on a fresh page load, so it's missing if the extension was installed or reloaded while the page was already open.
- **Generation unavailable** — the capability check failed. Either WebGPU is missing, the graphics driver is blocklisted (adapter request returns null), or there isn't enough GPU-addressable memory for the model. This is a supported state, not a bug.
- **Stale behavior after editing `lib/ai/`** — `npm run build:extension` wasn't re-run.

## Before shipping

`config.js` has an `IS_PRODUCTION` flag that must be flipped, and `PROD_URL` is still a placeholder Vercel URL.
