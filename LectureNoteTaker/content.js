
// Convert VTT caption text to plain text
function vttToPlainText(vttText) {
    return vttText
      .split(/\r?\n/)
      .filter(line => {
        const t = line.trim();
        if (!t) return false;               // blank lines
        if (t === "WEBVTT") return false;   // header
        if (/^\d+$/.test(t)) return false;  // cue numbers
        if (t.includes("-->")) return false; // timestamp lines
        return true;
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  async function getTranscriptFromCaptionProxy() {
    // Look through performance entries for the caption_proxy URL
    const resources = performance.getEntriesByType("resource");
    const capEntry = resources.find(r => r.name.includes("caption_proxy"));
  
    if (!capEntry) {
      throw new Error(
        "No caption_proxy request found. Try toggling CC on and scrubbing the video, then run again."
      );
    }
  
    const resp = await fetch(capEntry.name);
    if (!resp.ok) {
      throw new Error(`Failed to fetch captions: ${resp.status} ${resp.statusText}`);
    }
  
    const vttText = await resp.text();
    const plain = vttToPlainText(vttText);
  
    if (!plain) {
      throw new Error("VTT was fetched but produced empty text.");
    }
  
    return plain;
  }
  
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_TRANSCRIPT") {
      (async () => {
        try {
          const transcript = await getTranscriptFromCaptionProxy();
          sendResponse({ ok: true, transcript });
        } catch (err) {
          console.error(err);
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true; // keep the message channel open for async sendResponse
    }
  });
  