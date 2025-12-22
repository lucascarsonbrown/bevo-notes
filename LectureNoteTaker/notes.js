const contentEl = document.getElementById("content");
const copyBtn = document.getElementById("copy-btn");
const printBtn = document.getElementById("print-btn");
const themeToggle = document.getElementById("theme-toggle");
const toast = document.getElementById("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// Copy to clipboard
copyBtn.addEventListener("click", async () => {
  try {
    const textContent = contentEl.innerText;
    await navigator.clipboard.writeText(textContent);
    showToast("✓ Copied to clipboard");
  } catch (err) {
    console.error("Failed to copy:", err);
    showToast("✗ Failed to copy");
  }
});

// Print
printBtn.addEventListener("click", () => {
  window.print();
});

// Dark mode toggle
themeToggle.addEventListener("click", async () => {
  const isDark = document.body.classList.toggle("dark-mode");
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀️" : "🌙";

  // Save preference
  await chrome.storage.local.set({ darkMode: isDark });
});

// Load notes and preferences
document.addEventListener("DOMContentLoaded", async () => {
  const { latestNotesHtml, darkMode } = await chrome.storage.local.get(["latestNotesHtml", "darkMode"]);

  // Restore dark mode preference
  if (darkMode) {
    document.body.classList.add("dark-mode");
    themeToggle.querySelector(".theme-icon").textContent = "☀️";
  }

  // Load notes
  if (!latestNotesHtml) {
    contentEl.innerHTML = `
      <div class="loading">
        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No notes found</div>
        <div style="font-size: 14px;">Open the extension on a lecture page and generate notes first.</div>
      </div>
    `;
    return;
  }

  // Insert the HTML produced by OpenAI
  contentEl.innerHTML = latestNotesHtml;
});
