// content.js — extracts lecture captions from UT Lectures Online.
//
// Returns the raw VTT rather than flattened text: the timestamps are what let
// note generation split on the lecturer's pauses instead of at arbitrary
// character offsets.

function vttToPlainText(vttText) {
  return vttText
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t === "WEBVTT") return false;
      if (/^\d+$/.test(t)) return false;
      if (t.includes("-->")) return false;
      return true;
    })
    .join(" ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getTranscriptFromCaptionProxy() {
  const resources = performance.getEntriesByType("resource");
  const capEntry = resources.find((r) => r.name.includes("caption_proxy"));

  if (!capEntry) {
    throw new Error(
      "No caption_proxy request found. Try toggling CC on and scrubbing the video, then run again."
    );
  }

  const resp = await fetch(capEntry.name);
  if (!resp.ok) {
    throw new Error(`Failed to fetch captions: ${resp.status} ${resp.statusText}`);
  }

  const vtt = await resp.text();
  const plain = vttToPlainText(vtt);

  if (!plain) {
    throw new Error("VTT was fetched but produced empty text.");
  }

  return { vtt, transcript: plain };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TRANSCRIPT") {
    (async () => {
      try {
        const { vtt, transcript } = await getTranscriptFromCaptionProxy();
        sendResponse({ ok: true, vtt, transcript, title: document.title });
      } catch (err) {
        console.error(err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // keep the channel open for the async response
  }
});
