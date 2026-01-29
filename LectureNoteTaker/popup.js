// popup.js - Bevo Notes Chrome extension popup

// DOM elements
let generateBtn, statusEl, progressContainer, notesPreview, notesContent, viewFullBtn, themeToggle;
let loginSection, mainSection, userBadge, userEmailEl, logoutBtn, loginBtn, apiKeyWarning, settingsBtn, dashboardLink;

function setProgress(step, message, isError = false) {
  progressContainer.classList.add("active");
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);

  // Update progress steps
  for (let i = 1; i <= 3; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    stepEl.classList.remove("active", "complete");

    if (i < step) {
      stepEl.classList.add("complete");
    } else if (i === step) {
      stepEl.classList.add("active");
      // Add spinner to active step
      const icon = stepEl.querySelector(".step-icon");
      if (!isError) {
        icon.innerHTML = '<div class="spinner"></div>';
      }
    }
  }
}

function resetProgress() {
  progressContainer.classList.remove("active");
  const steps = document.querySelectorAll(".progress-step");
  steps.forEach(step => {
    step.classList.remove("active", "complete");
  });

  // Reset icons
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
  userEmailEl.textContent = email.split("@")[0]; // Show just the username part
}

function showLoggedOutUI() {
  loginSection.style.display = "block";
  mainSection.classList.remove("active");
  userBadge.style.display = "none";
}

async function checkApiKeyAndUpdateUI() {
  try {
    const status = await window.BevoAuth.checkApiKeyStatus();
    if (!status.has_key || !status.is_valid) {
      apiKeyWarning.classList.add("active");
      generateBtn.disabled = true;
    } else {
      apiKeyWarning.classList.remove("active");
      generateBtn.disabled = false;
    }
  } catch {
    // If we can't check, assume no key
    apiKeyWarning.classList.add("active");
    generateBtn.disabled = true;
  }
}

// Initialize everything when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements
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
  apiKeyWarning = document.getElementById("api-key-warning");
  settingsBtn = document.getElementById("settings-btn");
  dashboardLink = document.getElementById("dashboard-link");

  // Set dashboard link
  dashboardLink.href = window.BevoAuth.BACKEND_URL + "/dashboard";
  dashboardLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: dashboardLink.href });
  });

  // Dark mode toggle
  themeToggle.addEventListener("click", async () => {
    const isDark = document.body.classList.toggle("dark-mode");
    themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀️" : "🌙";
    await chrome.storage.local.set({ darkMode: isDark });
  });

  // View full notes button
  viewFullBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("notes.html") });
  });

  // Login button
  loginBtn.addEventListener("click", () => {
    window.BevoAuth.openLoginPage();
  });

  // Logout button
  logoutBtn.addEventListener("click", async () => {
    await window.BevoAuth.clearSession();
    showLoggedOutUI();
  });

  // Settings button
  settingsBtn.addEventListener("click", () => {
    window.BevoAuth.openSettingsPage();
  });

  // Restore theme preference
  const { darkMode } = await chrome.storage.local.get(["darkMode"]);
  if (darkMode) {
    document.body.classList.add("dark-mode");
    themeToggle.querySelector(".theme-icon").textContent = "☀️";
  }

  // Sync session from web app (in case user logged in via browser)
  // This also checks if existing session is still valid
  const user = await window.BevoAuth.syncSession();
  if (user && user.email) {
    showLoggedInUI(user.email);
    await checkApiKeyAndUpdateUI();

    // Restore notes if available
    const { latestNotesHtml } = await chrome.storage.local.get(["latestNotesHtml"]);
    if (latestNotesHtml) {
      showNotes(latestNotesHtml);
    }
  } else {
    showLoggedOutUI();
  }

  // Generate button click handler
  generateBtn.addEventListener("click", async () => {
    generateBtn.disabled = true;
    resetProgress();
    notesPreview.classList.remove("active");

    try {
      // Step 1: Fetch transcript
      setProgress(1, "Getting transcript from lecture page...");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { type: "GET_TRANSCRIPT" });
      } catch (err) {
        if (err.message.includes("Receiving end does not exist") || err.message.includes("Could not establish connection")) {
          throw new Error("Please reload the lecture page and try again. (Extension needs fresh page load)");
        }
        throw err;
      }

      if (!response?.ok) {
        throw new Error(response?.error || "Unknown error getting transcript");
      }

      const transcript = response.transcript;

      // Step 2: Analyzing
      setProgress(2, "Analyzing lecture content...");
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX

      // Step 3: Generate with AI via backend
      setProgress(3, "Generating structured notes with AI...");

      const result = await window.BevoAuth.generateNotes(transcript);

      // Complete all steps
      document.querySelectorAll(".progress-step").forEach(step => {
        step.classList.add("complete");
        step.classList.remove("active");
      });

      statusEl.textContent = result.cached
        ? "✓ Notes retrieved from cache!"
        : "✓ Notes generated successfully!";
      statusEl.classList.remove("error");

      // Display notes
      showNotes(result.notes_html);

      // Store for notes.html viewer
      await chrome.storage.local.set({ latestNotesHtml: result.notes_html });

      generateBtn.disabled = false;
    } catch (err) {
      console.error(err);

      // Check for specific error types
      if (err.message.includes("Session expired") || err.message.includes("Not logged in")) {
        showLoggedOutUI();
        setProgress(0, "Please log in to generate notes", true);
      } else if (err.message.includes("No API key")) {
        apiKeyWarning.classList.add("active");
        setProgress(0, "Please add your Gemini API key in settings", true);
      } else {
        setProgress(0, "Error: " + err.message, true);
      }

      generateBtn.disabled = false;
    }
  });
});
