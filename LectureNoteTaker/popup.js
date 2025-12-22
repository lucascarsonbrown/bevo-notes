// popup.js

const GEMINI_API_KEY = "AIzaSyDtBIxk6eL8T4xxGIx9ZXC_AIwAP8sJ4X4";

// Wait for DOM to be ready before accessing elements
let generateBtn, statusEl, progressContainer, notesPreview, notesContent, viewFullBtn, themeToggle;

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

  // Dark mode toggle
  themeToggle.addEventListener("click", async () => {
    const isDark = document.body.classList.toggle("dark-mode");
    themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀️" : "🌙";

    // Save preference
    await chrome.storage.local.set({ darkMode: isDark });
  });

  // View full notes button
  viewFullBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("notes.html") });
  });

  // Restore notes and theme on popup open
  const { latestNotesHtml, darkMode } = await chrome.storage.local.get(["latestNotesHtml", "darkMode"]);

  // Restore dark mode preference
  if (darkMode) {
    document.body.classList.add("dark-mode");
    themeToggle.querySelector(".theme-icon").textContent = "☀️";
  }

  // Restore notes if available
  if (latestNotesHtml) {
    showNotes(latestNotesHtml);
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
      // Check if it's the "receiving end does not exist" error
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

    // Step 3: Generate with AI
    setProgress(3, "Generating structured notes with AI...");
    const notesHtml = await summarizeWithGemini(transcript);

    // Complete all steps
    document.querySelectorAll(".progress-step").forEach(step => {
      step.classList.add("complete");
      step.classList.remove("active");
    });

    statusEl.textContent = "✓ Notes generated successfully!";
    statusEl.classList.remove("error");

    // Display notes
    showNotes(notesHtml);

    // Store for notes.html
    await chrome.storage.local.set({ latestNotesHtml: notesHtml });

    generateBtn.disabled = false;
  } catch (err) {
    console.error(err);
    setProgress(0, "Error: " + err.message, true);
    generateBtn.disabled = false;
  }
  });
});

async function summarizeWithGemini(transcript) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("Set your Gemini API key in popup.js. Get one at https://aistudio.google.com/apikey");
  }

  const systemInstruction = `You are turning a raw university lecture transcript into written lecture notes, as if the professor had typed the lecture out cleanly for students.

Your goal is to preserve the lecture content and level of detail, while making it organized, readable, and mathematically precise.

Follow these rules carefully:

1. Overall goal
   - Rewrite the lecture as structured lecture notes "on paper."
   - Preserve essentially all substantive content.
   - Do NOT significantly shorten the lecture.

2. What to keep vs remove
   - REMOVE: jokes, filler, classroom chatter, technical issues.
   - KEEP: all mathematical content, examples, reasoning, and any important logistics that affect the student (exams, assignments, grading).
   - Condense repetition, but do not omit important reasoning.

3. Structure (topic-based)
   - Break the lecture into sections based on topic transitions.
   - Output HTML with:
     - One <h1> lecture title (infer from content if needed).
     - Multiple <h2> sections, each covering one major topic.
     - Use <p> for prose and <ul><li> for structured explanations.

4. Definitions, theorems, and formulas
   - Rewrite definitions and theorems cleanly and precisely.
   - All mathematical expressions MUST be written using MathML (built-in HTML math).
   - For simple expressions, you can use Unicode symbols directly (×, ÷, ≤, ≥, ≠, ∞, etc.).
   - For complex expressions, use MathML tags wrapped in <math> elements.
   - Example: T(n) = 2<sup>n</sup> - 1 (using <sup> for exponents)
   - Example: <math><mfrac><mn>1</mn><mn>2</mn></mfrac></math> for fractions
   - Ensure all math is mathematically equivalent to the lecture.

5. Proofs and reasoning
   - When a proof or reasoning is presented:
     - First give an informal explanation describing the intuition.
     - Then give a formal, structured version using clear steps.
   - Remain faithful to the lecture content.

6. Examples
   - Rewrite all examples from the lecture.
   - Add clarifying steps so the logic is clear in written form.
   - Do not invent new problems.

7. Tone and style
   - Sound like professor-written lecture notes.
   - Clear, precise, and professional.
   - No study tips or meta commentary.
   - No need for any practice problems unless given in the lecture.

8. Output format
   - Output valid HTML only.
   - Use MathML, HTML superscripts/subscripts, and Unicode symbols for all math.
   - Use only <h1>, <h2>, <p>, <ul><li>, <sup>, <sub>, and <math> for structure.`;

  const userPrompt = `Apply the rules to the following transcript:

[BEGIN TRANSCRIPT]
${transcript}
[END TRANSCRIPT]`;

  // Google Gemini API endpoint for flash-lite model
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text: systemInstruction
        }]
      },
      contents: [{
        parts: [{
          text: userPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Gemini API error: " + text);
  }

  const data = await res.json();

  // Extract content from Gemini response
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error("Unexpected Gemini API response format");
  }

  let content = data.candidates[0].content.parts[0].text;

  // Remove markdown code fences if present
  content = content.replace(/^```html\s*/i, '').replace(/\s*```$/, '');

  return content;
}
