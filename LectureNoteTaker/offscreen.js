// offscreen.js — hosts the local model.
//
// Offscreen documents get a real document context (so WebGPU is available) and
// are not torn down on the service worker's idle timer, which matters because a
// lecture takes several passes and minutes to generate.

import {
  detectCapability,
  explainCapability,
  generateNotes,
  hashTranscript,
} from './vendor/bevo-ai.js';

function relay(type, payload) {
  // The service worker may be asleep; a failed relay must not abort generation,
  // since state is also mirrored into storage.
  chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});
}

async function saveNote({ backendUrl, title, transcript, html, document: doc, lectureUrl }) {
  const response = await fetch(`${backendUrl}/api/notes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      title,
      transcript,
      notes_html: html,
      notes_json: doc,
      lecture_url: lectureUrl ?? null,
    }),
  });

  if (response.status === 401) throw new Error('Session expired. Please log in again.');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save note');
  }
  return response.json();
}

async function checkCached(backendUrl, transcript) {
  try {
    const hash = await hashTranscript(transcript);
    const res = await fetch(
      `${backendUrl}/api/notes/generate?transcript_hash=${hash}`,
      { credentials: 'include' }
    );
    if (res.ok) return res.json();
  } catch {
    // Offline or logged out — fall through and generate.
  }
  return null;
}

async function handleGenerate(msg) {
  try {
    const capability = await detectCapability();
    if (capability.mode === 'readonly') {
      throw new Error(explainCapability(capability));
    }

    // Ask the server before spending minutes regenerating an existing note.
    relay('GENERATION_PROGRESS', {
      payload: { phase: 'loading-model', progress: 0, message: 'Checking for existing notes…' },
    });

    const cached = await checkCached(msg.backendUrl, msg.transcript ?? '');
    if (cached?.id) {
      relay('GENERATION_DONE', {
        payload: { noteId: cached.id, html: cached.notes_html, title: cached.title, cached: true },
      });
      return;
    }

    const result = await generateNotes({
      capability,
      vtt: msg.vtt,
      transcript: msg.transcript,
      onProgress: (p) => relay('GENERATION_PROGRESS', { payload: p }),
    });

    relay('GENERATION_PROGRESS', {
      payload: { phase: 'merging', progress: 0.95, message: 'Saving…' },
    });

    const saved = await saveNote({
      backendUrl: msg.backendUrl,
      title: result.document.title,
      transcript: result.transcript,
      html: result.html,
      document: result.document,
      lectureUrl: msg.lectureUrl,
    });

    relay('GENERATION_DONE', {
      payload: {
        noteId: saved.id,
        html: result.html,
        title: result.document.title,
        cached: !!saved.cached,
        chunkCount: result.chunkCount,
        failedChunks: result.failedChunks,
      },
    });
  } catch (err) {
    relay('GENERATION_ERROR', { error: err?.message || 'Generation failed' });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OFFSCREEN_CAPABILITY') {
    detectCapability()
      .then((cap) =>
        sendResponse({ ok: true, mode: cap.mode, explanation: explainCapability(cap) })
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === 'OFFSCREEN_GENERATE') {
    handleGenerate(message);
    return false;
  }

  return false;
});
