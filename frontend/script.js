/* ─────────────────────────────────────────────
   AI Study Tool — Frontend Script
   ───────────────────────────────────────────── */

// ── CONFIG ──────────────────────────────────────
// Change this to your Render backend URL after deployment
// e.g. "https://ai-study-tool.onrender.com"
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8000"
  : "https://your-backend.onrender.com";   // ← UPDATE THIS after deploying backend


// ── DOM REFERENCES ──────────────────────────────
const textInput      = document.getElementById("text-input");
const charCount      = document.getElementById("char-count");
const fileInput      = document.getElementById("file-input");
const dropZone       = document.getElementById("drop-zone");
const fileSelected   = document.getElementById("file-selected");
const fileNameDisplay= document.getElementById("file-name-display");
const clearFileBtn   = document.getElementById("clear-file");

const outputCard     = document.getElementById("output-card");
const outputTitle    = document.getElementById("output-title");
const outputBody     = document.getElementById("output-body");
const loadingEl      = document.getElementById("loading");
const loadingText    = document.getElementById("loading-text");
const sourceBadge    = document.getElementById("source-badge");
const copyBtn        = document.getElementById("copy-btn");
const suggestionsEl  = document.getElementById("suggestions");
const suggestChips   = document.getElementById("suggest-chips");
const aiBadge        = document.getElementById("ai-badge");

const tabs           = document.querySelectorAll(".tab");
const panels         = document.querySelectorAll(".panel");
const actionBtns     = document.querySelectorAll(".btn[data-action]");

let currentTab       = "text";
let selectedFile     = null;
let lastAction       = "explain";
let lastContent      = "";   // store for follow-up suggestions


// ── TABS ────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    document.getElementById(`panel-${currentTab}`).classList.add("active");
  });
});


// ── CHARACTER COUNT ─────────────────────────────
textInput.addEventListener("input", () => {
  charCount.textContent = textInput.value.length.toLocaleString();
});


// ── FILE UPLOAD ──────────────────────────────────
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
});

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
});

function handleFileSelect(file) {
  const allowed = ["pdf", "txt", "csv", "json"];
  const ext = file.name.split(".").pop().toLowerCase();
  if (!allowed.includes(ext)) {
    showError(`❌ Unsupported file: .${ext}. Please use PDF, TXT, CSV, or JSON.`);
    return;
  }
  selectedFile = file;
  fileNameDisplay.textContent = file.name;
  fileSelected.classList.remove("hidden");
}

clearFileBtn.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  fileSelected.classList.add("hidden");
  fileNameDisplay.textContent = "No file selected";
});


// ── ACTION BUTTONS ───────────────────────────────
actionBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    lastAction = btn.dataset.action;
    handleAction(lastAction);
  });
});

async function handleAction(action) {
  const isFile = currentTab === "file";

  // Validate input
  if (isFile && !selectedFile) {
    showError("Please upload a file first.");
    return;
  }
  if (!isFile && !textInput.value.trim()) {
    showError("Please paste some text first.");
    return;
  }

  // Show output card + loading
  outputCard.classList.remove("hidden");
  suggestionsEl.classList.add("hidden");
  outputBody.classList.add("hidden");
  loadingEl.classList.remove("hidden");

  const titles = { explain: "📖 Explanation", summarize: "📋 Summary", quiz: "🧠 Quiz" };
  outputTitle.textContent = titles[action] || "Result";

  const loadingMessages = {
    explain:   ["🤔 Reading your content...", "💡 Generating explanation..."],
    summarize: ["📚 Analyzing content...",    "✍️ Writing summary..."],
    quiz:      ["🎯 Studying content...",      "🧩 Building quiz questions..."],
  };
  animateLoading(loadingMessages[action]);

  setButtonsDisabled(true);

  try {
    let data;
    if (isFile) {
      data = await sendFile(selectedFile, action);
    } else {
      data = await sendText(textInput.value, action);
    }

    showResult(data, action);
  } catch (err) {
    showError(`Request failed: ${err.message}`);
  } finally {
    setButtonsDisabled(false);
    loadingEl.classList.add("hidden");
  }
}


// ── API CALLS ────────────────────────────────────
async function sendText(content, action) {
  const res = await fetch(`${API_BASE}/process-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, action })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function sendFile(file, action) {
  const form = new FormData();
  form.append("file", file);
  form.append("action", action);
  const res = await fetch(`${API_BASE}/upload-file`, {
    method: "POST",
    body: form
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}


// ── SHOW RESULT ──────────────────────────────────
function showResult(data, action) {
  const text = data.response || "No response received.";
  lastContent = textInput.value || (selectedFile ? selectedFile.name : "");

  // Format output
  outputBody.innerHTML = formatOutput(text, action);
  outputBody.classList.remove("hidden");

  // Source badge
  const src = data.ai_source || "unknown";
  sourceBadge.textContent = src.toUpperCase();
  sourceBadge.className = "source-badge " + src;

  // AI status badge
  aiBadge.textContent = src === "error" ? "AI Error" : `via ${src.charAt(0).toUpperCase() + src.slice(1)}`;
  aiBadge.className   = "badge" + (src === "error" ? " error" : "");

  // Follow-up chips
  showSuggestions(action);

  // Scroll to output
  setTimeout(() => outputCard.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

function showError(msg) {
  outputCard.classList.remove("hidden");
  loadingEl.classList.add("hidden");
  outputBody.classList.remove("hidden");
  outputBody.innerHTML = `<span style="color:var(--red)">${msg}</span>`;
  sourceBadge.textContent = "ERROR";
  sourceBadge.className = "source-badge error";
  suggestionsEl.classList.add("hidden");
}


// ── OUTPUT FORMATTER ─────────────────────────────
function formatOutput(text, action) {
  // Escape HTML
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text**
  safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic *text*
  safe = safe.replace(/\*(.*?)\*/g, "<em>$1</em>");

  if (action === "quiz") {
    // Highlight Q lines
    safe = safe.replace(/(Q\d+\..+)/g, '<div class="quiz-q"><strong>$1</strong></div>');
    // Highlight Answer lines
    safe = safe.replace(/(Answer:\s*.+)/gi, '<div class="answer-line">✅ $1</div>');
    return safe;
  }

  // Bullet points
  safe = safe.replace(/^[-•]\s(.+)/gm, "• $1");

  return safe;
}


// ── FOLLOW-UP SUGGESTIONS ────────────────────────
function showSuggestions(action) {
  const maps = {
    explain:   ["🧠 Quiz Me on This", "📋 Summarize This"],
    summarize: ["🧠 Quiz Me on This", "🔍 Explain in More Detail"],
    quiz:      ["🔍 Explain This Topic", "📋 Quick Summary"],
  };
  const chips = maps[action] || [];
  if (!chips.length) return;

  suggestChips.innerHTML = "";
  chips.forEach(label => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      const act = label.includes("Quiz")    ? "quiz"
                : label.includes("Summar")  ? "summarize"
                : "explain";
      lastAction = act;
      handleAction(act);
    });
    suggestChips.appendChild(btn);
  });

  suggestionsEl.classList.remove("hidden");
}


// ── COPY BUTTON ──────────────────────────────────
copyBtn.addEventListener("click", () => {
  const text = outputBody.innerText;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = "✓ Copied!";
    setTimeout(() => { copyBtn.textContent = "⎘ Copy"; }, 2000);
  });
});


// ── LOADING ANIMATION ────────────────────────────
let loadingInterval;
function animateLoading(messages) {
  let i = 0;
  loadingText.textContent = messages[0];
  clearInterval(loadingInterval);
  loadingInterval = setInterval(() => {
    i = (i + 1) % messages.length;
    loadingText.textContent = messages[i];
  }, 1800);
}


// ── UTILS ────────────────────────────────────────
function setButtonsDisabled(state) {
  actionBtns.forEach(b => b.disabled = state);
}


// ── HEALTH CHECK on load ──────────────────────────
window.addEventListener("load", async () => {
  try {
    const res = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      aiBadge.textContent = "AI Ready";
      aiBadge.className   = "badge";
    }
  } catch {
    aiBadge.textContent = "Backend Offline";
    aiBadge.className   = "badge error";
  }
});
