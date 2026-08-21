// background.js — MV3 service worker.
//
// Owns the offscreen document and mirrors generation state into storage.
// Generation runs offscreen rather than here because a service worker can be
// terminated mid-task, and a lecture takes minutes to process.

const OFFSCREEN_PATH = 'offscreen.html';
const STATE_KEY = 'bevo_generation_state';

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  return contexts.length > 0;
}

let creating = null;

async function ensureOffscreen() {
  if (await hasOffscreen()) return;

  // Concurrent callers must await the same creation, or the second throws.
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        // No WebGPU-specific reason exists; WORKERS is the closest fit for
        // long-running background computation.
        reasons: ['WORKERS'],
        justification:
          'Runs the local language model on WebGPU to generate lecture notes on-device.',
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}

async function setState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'START_GENERATION') {
    (async () => {
      try {
        await ensureOffscreen();
        await setState({
          status: 'running',
          phase: 'loading-model',
          progress: 0,
          message: 'Preparing…',
          startedAt: Date.now(),
        });
        await chrome.runtime.sendMessage({
          type: 'OFFSCREEN_GENERATE',
          vtt: message.vtt,
          transcript: message.transcript,
          title: message.title,
          backendUrl: message.backendUrl,
          lectureUrl: message.lectureUrl,
        });
        sendResponse({ ok: true });
      } catch (err) {
        await setState({ status: 'error', message: err.message });
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message?.type === 'CHECK_CAPABILITY') {
    (async () => {
      try {
        await ensureOffscreen();
        const result = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_CAPABILITY' });
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // Progress and completion are relayed from the offscreen document. Mirrored
  // into storage so the popup can reattach after being closed mid-run.
  if (message?.type === 'GENERATION_PROGRESS') {
    setState({ status: 'running', ...message.payload });
    return false;
  }

  if (message?.type === 'GENERATION_DONE') {
    setState({ status: 'done', ...message.payload });
    return false;
  }

  if (message?.type === 'GENERATION_ERROR') {
    setState({ status: 'error', message: message.error });
    return false;
  }

  return false;
});
