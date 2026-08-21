// popup.js — Bevo Notes extension popup.
//
// The popup only drives the UI. Generation runs in the offscreen document, so
// closing the popup mid-run does not cancel it; on reopen the popup reattaches
// to whatever state the service worker mirrored into storage.

const STATE_KEY = "bevo_generation_state";

let generateBtn, statusEl, progressContainer, notesPreview, notesContent, viewFullBtn, themeToggle;
let loginSection, mainSection, userBadge, userEmailEl, logoutBtn, loginBtn, settingsBtn, dashboardLink;
let capabilityWarning, capabilityWarningText;

let canGenerate = false;

function setProgress(step, message, isError = false) {
  progressContainer.classList.add("active");
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);

  for (let i = 1; i <= 3; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    stepEl.classList.remove("active", "complete");
    if (i < step) {
      stepEl.classList.add("complete");
    } else if (i === step) {
      stepEl.classList.add("active");
      if (!isError) {
        stepEl.querySelector(".step-icon").innerHTML = '<div class="spinner"></div>';
      }
    }
  }
}

function resetProgress() {
  progressContainer.classList.remove("active");
  document.querySelectorAll(".progress-step").forEach((step) => {
    step.classList.remove("active", "complete");
  });
  document.querySelector("#step-1 .step-icon").textContent = "📄";
  document.querySelector("#step-2 .step-icon").textContent = "🔍";
  document.querySelector("#step-3 .step-icon").textContent = "✨";
}

function showNotes(html) {
  notesContent.innerHTML = html;
  notesPreview.classList.add("active");
}

function showLoggedInUI(email) {
  loginSection.style.display = "none";
  mainSection.classList.add("active");
  userBadge.style.display = "flex";
  userEmailEl.textContent = email.split("@")[0];
}

function showLoggedOutUI() {
  loginSection.style.display = "block";
  mainSection.classList.remove("active");
  userBadge.style.display = "none";
}

/** Map a generation phase onto the three-step progress indicator. */
function phaseToStep(phase) {
  if (phase === "loading-model") return 1;
  if (phase === "generating") return 2;
  return 3;
}

function renderState(state) {
  if (!state) return;

  if (state.status === "running") {
    generateBtn.disabled = true;
    const pct = Math.round((state.progress ?? 0) * 100);
    setProgress(phaseToStep(state.phase), `${state.message ?? "Working…"} (${pct}%)`);
    return;
  }

  if (state.status === "done") {
    document.querySelectorAll(".progress-step").forEach((step) => {
      step.classList.add("complete");
      step.classList.remove("active");
    });
    const suffix =
      state.failedChunks > 0
        ? ` (${state.failedChunks} of ${state.chunkCount} sections failed)`
        : "";
    statusEl.textContent = state.cached
      ? "✓ Notes retrieved from your library"
      : `✓ Notes generated on this device${suffix}`;
    statusEl.classList.remove("error");
    if (state.html) showNotes(state.html);
    generateBtn.disabled = !canGenerate;
    return;
  }

  if (state.status === "error") {
    setProgress(0, state.message || "Generation failed", true);
    generateBtn.disabled = !canGenerate;
  }
}

async function checkCapability() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "CHECK_CAPABILITY" });
    if (!result?.ok) throw new Error(result?.error || "Could not check this device");

    canGenerate = result.mode !== "readonly";

    if (canGenerate) {
      capabilityWarning.classList.remove("active");
      generateBtn.disabled = false;
      if (result.mode === "reduced") {
        capabilityWarning.classList.add("active");
        capabilityWarningText.textContent = result.explanation;
      }
    } else {
      capabilityWarning.classList.add("active");
      capabilityWarningText.textContent = result.explanation;
      generateBtn.disabled = true;
    }
  } catch (err) {
    canGenerate = false;
    capabilityWarning.classList.add("active");
    capabilityWarningText.textContent =
      "Could not check this device for note generation support. " + err.message;
    generateBtn.disabled = true;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  generateBtn = document.getElementById("generate");
  statusEl = document.getElementById("status");
  progressContainer = document.getElementById("progress-container");
  notesPreview = document.getElementById("notes-preview");
  notesContent = document.getElementById("notes-content");
  viewFullBtn = document.getElementById("view-full");
  themeToggle = document.getElementById("theme-toggle");
  loginSection = document.getElementById("login-section");
  mainSection = document.getElementById("main-section");
  userBadge = document.getElementById("user-badge");
  userEmailEl = document.getElementById("user-email");
  logoutBtn = document.getElementById("logout-btn");
  loginBtn = document.getElementById("login-btn");
  settingsBtn = document.getElementById("settings-btn");
  dashboardLink = document.getElementById("dashboard-link");
  capabilityWarning = document.getElementById("capability-warning");
  capabilityWarningText = document.getElementById("capability-warning-text");

  dashboardLink.href = window.BevoAuth.BACKEND_URL + "/dashboard";
  dashboardLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: dashboardLink.href });
  });

  themeToggle.addEventListener("click", async () => {
    const isDark = document.body.classList.toggle("dark-mode");
    themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀️" : "🌙";
    await chrome.storage.local.set({ darkMode: isDark });
  });

  viewFullBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("notes.html") });
  });

  loginBtn.addEventListener("click", () => window.BevoAuth.openLoginPage());
  logoutBtn.addEventListener("click", async () => {
    await window.BevoAuth.clearSession();
    showLoggedOutUI();
  });
  settingsBtn.addEventListener("click", () => window.BevoAuth.openSettingsPage());

  const { darkMode } = await chrome.storage.local.get(["darkMode"]);
  if (darkMode) {
    document.body.classList.add("dark-mode");
    themeToggle.querySelector(".theme-icon").textContent = "☀️";
  }

  const user = await window.BevoAuth.syncSession();
  if (user && user.email) {
    showLoggedInUI(user.email);
    await checkCapability();

    // Reattach to a run that may have continued while the popup was closed.
    const { [STATE_KEY]: state } = await chrome.storage.local.get(STATE_KEY);
    if (state) renderState(state);

    const { latestNotesHtml } = await chrome.storage.local.get(["latestNotesHtml"]);
    if (latestNotesHtml && !state?.html) showNotes(latestNotesHtml);
  } else {
    showLoggedOutUI();
  }

  // Live updates while the popup happens to be open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STATE_KEY]) return;
    const state = changes[STATE_KEY].newValue;
    renderState(state);
    if (state?.status === "done" && state.html) {
      chrome.storage.local.set({ latestNotesHtml: state.html });
    }
  });

  generateBtn.addEventListener("click", async () => {
    if (!canGenerate) return;
    generateBtn.disabled = true;
    resetProgress();
    notesPreview.classList.remove("active");

    try {
      setProgress(1, "Getting transcript from lecture page…");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { type: "GET_TRANSCRIPT" });
      } catch (err) {
        if (
          err.message.includes("Receiving end does not exist") ||
          err.message.includes("Could not establish connection")
        ) {
          throw new Error(
            "Please reload the lecture page and try again. (Extension needs a fresh page load)"
          );
        }
        throw err;
      }

      if (!response?.ok) throw new Error(response?.error || "Could not read the transcript");

      const started = await chrome.runtime.sendMessage({
        type: "START_GENERATION",
        vtt: response.vtt,
        transcript: response.transcript,
        title: response.title,
        lectureUrl: tab.url,
        backendUrl: window.BevoAuth.BACKEND_URL,
      });

      if (!started?.ok) throw new Error(started?.error || "Could not start generation");

      setProgress(1, "Preparing the model on your device…");
    } catch (err) {
      console.error(err);
      if (err.message.includes("Session expired") || err.message.includes("Not logged in")) {
        showLoggedOutUI();
        setProgress(0, "Please log in to save notes", true);
      } else {
        setProgress(0, "Error: " + err.message, true);
      }
      generateBtn.disabled = !canGenerate;
    }
  });
});
