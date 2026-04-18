/* ───────────────────────────────────────────────
   StudyAI — script.js
   Gemini (primary) + Groq (fallback) via FastAPI
   ─────────────────────────────────────────────── */

// ── CONFIG ────────────────────────────────────────
const IS_LOCAL = ["localhost","127.0.0.1"].includes(window.location.hostname);
const DEFAULT_BACKEND = IS_LOCAL
  ? "http://localhost:8000"
  : "https://your-backend.onrender.com"; // ← Render URL yahan daalo deploy ke baad

let API_BASE  = localStorage.getItem("sai_backend") || DEFAULT_BACKEND;
let LANG_PREF = localStorage.getItem("sai_lang")    || "English";

let sessionHistory = [];
try { sessionHistory = JSON.parse(localStorage.getItem("sai_history") || "[]"); } catch {}


// ── DOM ───────────────────────────────────────────
const $ = id => document.getElementById(id);
const textInput    = $("text-input");
const charCount    = $("char-count");
const wordCount    = $("word-count");
const wordCounter  = $("word-counter");
const clearTextBtn = $("clear-text");
const fileInput    = $("file-input");
const dropZone     = $("drop-zone");
const fileSelected = $("file-selected");
const fileNameDisp = $("file-name-display");
const fileExt      = $("file-ext");
const fileSizeTxt  = $("file-size");
const clearFileBtn = $("clear-file");

const outputCard   = $("output-card");
const outputLabel  = $("output-label");
const outBody      = $("out-body");
const loadingEl    = $("loading");
const loadingText  = $("loading-text");
const srcBadge     = $("src-badge");
const copyBtn      = $("copy-btn");
const copyTxt      = $("copy-txt");
const downloadBtn  = $("download-btn");
const follow       = $("follow");
const followChips  = $("follow-chips");
const runBtn       = $("run-btn");
const statusPill   = $("status-pill");
const statusText   = $("status-text");

const tabs         = document.querySelectorAll(".tab");
const panels       = document.querySelectorAll(".panel");
const modeBtns     = document.querySelectorAll(".mode-btn");

const settingsToggle = $("settings-toggle");
const settingsPanel  = $("settings-panel");
const backendInput   = $("backend-url-input");
const langSelect     = $("lang-select");
const saveSettings   = $("settings-save");

const historyToggle  = $("history-toggle");
const historyPanel   = $("history-panel");
const historyList    = $("history-list");
const clearHistory   = $("clear-history");

// Flashcard elements
const fcViewer = $("fc-viewer");
const fcCard   = $("fc-card");
const fcFront  = $("fc-front");
const fcBack   = $("fc-back");
const fcHint   = $("fc-hint");
const fcCur    = $("fc-cur");
const fcTot    = $("fc-tot");
const fcFlip   = $("fc-flip");
const fcPrev   = $("fc-prev");
const fcNext   = $("fc-next");


// ── STATE ─────────────────────────────────────────
let currentTab    = "text";
let selectedFile  = null;
let currentAction = "explain";
let currentOutput = "";
let flashcards    = [];
let fcIdx         = 0;
let fcFlipped_    = false;
let loadingTimer;


// ── INIT ──────────────────────────────────────────
backendInput.value = API_BASE;
langSelect.value   = LANG_PREF;
checkHealth();


// ── TABS ──────────────────────────────────────────
tabs.forEach(t => t.addEventListener("click", () => {
  tabs.forEach(x => x.classList.remove("active"));
  panels.forEach(x => x.classList.remove("active"));
  t.classList.add("active");
  currentTab = t.dataset.tab;
  $(`panel-${currentTab}`).classList.add("active");
  validateInput();
}));


// ── TEXT INPUT ────────────────────────────────────
textInput.addEventListener("input", () => {
  const v = textInput.value;
  charCount.textContent = v.length.toLocaleString();
  wordCount.textContent = v.trim() ? v.trim().split(/\s+/).length : 0;
  const has = v.length > 0;
  wordCounter.classList.toggle("hidden", !has);
  clearTextBtn.classList.toggle("hidden", !has);
  validateInput();
});

clearTextBtn.addEventListener("click", () => {
  textInput.value = "";
  charCount.textContent = "0";
  wordCount.textContent = "0";
  wordCounter.classList.add("hidden");
  clearTextBtn.classList.add("hidden");
  validateInput();
});


// ── FILE UPLOAD ───────────────────────────────────
fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["pdf","txt","csv","json"].includes(ext)) {
    showError(`❌ Unsupported file: .${ext}\nSirf PDF, TXT, CSV, JSON allowed hai.`);
    return;
  }
  selectedFile = file;
  fileNameDisp.textContent = file.name;
  fileExt.textContent = ext.toUpperCase();
  fileSizeTxt.textContent = fmtBytes(file.size);
  fileSelected.classList.remove("hidden");
  validateInput();
}

clearFileBtn.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  fileSelected.classList.add("hidden");
  validateInput();
});

function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b/1024).toFixed(1) + " KB";
  return (b/1048576).toFixed(1) + " MB";
}


// ── MODE BUTTONS ──────────────────────────────────
modeBtns.forEach(b => b.addEventListener("click", () => {
  modeBtns.forEach(x => x.classList.remove("selected"));
  b.classList.add("selected");
  currentAction = b.dataset.action;
}));


// ── VALIDATE ──────────────────────────────────────
function validateInput() {
  const ok = (currentTab === "text" && textInput.value.trim().length > 10)
          || (currentTab === "file" && selectedFile);
  runBtn.disabled = !ok;
}


// ── RUN ───────────────────────────────────────────
runBtn.addEventListener("click", () => run(currentAction));

async function run(action) {
  currentAction = action;
  modeBtns.forEach(b => b.classList.toggle("selected", b.dataset.action === action));

  // Reset output
  outputCard.classList.remove("hidden");
  follow.classList.add("hidden");
  outBody.classList.add("hidden");
  outBody.innerHTML = "";
  fcViewer.classList.add("hidden");
  loadingEl.classList.remove("hidden");

  const labels = { explain:"📖 Explanation", summarize:"📋 Summary", quiz:"🧠 Quiz", flashcards:"🃏 Flashcards", mindmap:"🗺️ Mind Map" };
  outputLabel.textContent = labels[action] || "Result";

  startLoading(action);
  setBusy(true);

  try {
    const data = currentTab === "file"
      ? await apiFile(selectedFile, action)
      : await apiText(textInput.value, action);
    showResult(data, action);
    addHistory(action, data.response, currentTab === "file" ? selectedFile.name : textInput.value.slice(0,80));
  } catch (err) {
    showError("❌ " + err.message + "\n\nBackend URL check karo Settings mein.");
  } finally {
    setBusy(false);
    loadingEl.classList.add("hidden");
  }
}


// ── API ───────────────────────────────────────────
async function apiText(content, action) {
  const r = await fetch(`${API_BASE}/process-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, action, lang: LANG_PREF })
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${r.status}`);
  }
  return r.json();
}

async function apiFile(file, action) {
  const form = new FormData();
  form.append("file", file);
  form.append("action", action);
  form.append("lang", LANG_PREF);
  const r = await fetch(`${API_BASE}/upload-file`, { method: "POST", body: form });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${r.status}`);
  }
  return r.json();
}


// ── SHOW RESULT ───────────────────────────────────
function showResult(data, action) {
  currentOutput = data.response || "";
  const src = data.ai_source || "gemini";

  srcBadge.textContent = src.toUpperCase();
  srcBadge.className = `src-badge ${src}`;

  if (action === "flashcards") {
    renderFlashcards(currentOutput);
  } else {
    outBody.innerHTML = format(currentOutput, action);
    outBody.classList.remove("hidden");
  }

  showFollow(action);
  setTimeout(() => outputCard.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

function showError(msg) {
  outputCard.classList.remove("hidden");
  loadingEl.classList.add("hidden");
  outBody.innerHTML = `<span style="color:var(--rose);white-space:pre-wrap">${msg}</span>`;
  outBody.classList.remove("hidden");
  srcBadge.textContent = "ERROR";
  srcBadge.className = "src-badge error";
  follow.classList.add("hidden");
}


// ── FORMATTER ─────────────────────────────────────
function format(text, action) {
  let s = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  s = s.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");
  s = s.replace(/\*(.*?)\*/g,"<em>$1</em>");

  if (action === "quiz") {
    s = s.replace(/(Q\d+\..+)/g,'<div class="quiz-q">$1</div>');
    s = s.replace(/(Answer:\s*[A-D]\)?.+)/gi,'<div class="ans-line">✅ $1</div>');
    s = s.replace(/(Explanation:\s*.+)/gi,'<div class="exp-line">💬 $1</div>');
    return s;
  }
  if (action === "mindmap") {
    s = s.replace(/(🧠 CENTRAL TOPIC:.+)/g,'<div class="sec-head">$1</div>');
    s = s.replace(/(📌 BRANCH \d+:.+)/g,'<div class="mm-branch">$1</div>');
    s = s.replace(/(  → .+)/g,'<div class="mm-sub">$1</div>');
    return s;
  }
  if (action === "summarize") {
    s = s.replace(/(📌.+|🔑.+|💬.+|🎯.+)/g,'<div class="sec-head">$1</div>');
    return s;
  }
  return s;
}


// ── FLASHCARDS ────────────────────────────────────
function renderFlashcards(text) {
  flashcards = [];
  text.split(/CARD \d+/i).filter(b => b.trim()).forEach(block => {
    const f = block.match(/FRONT:\s*(.+?)(?=BACK:|$)/is);
    const b = block.match(/BACK:\s*(.+?)(?=$)/is);
    if (f && b) flashcards.push({ front: f[1].trim(), back: b[1].trim() });
  });

  if (!flashcards.length) {
    outBody.innerHTML = format(text, "explain");
    outBody.classList.remove("hidden");
    return;
  }

  fcIdx = 0; fcFlipped_ = false;
  fcTot.textContent = flashcards.length;
  fcViewer.classList.remove("hidden");
  drawCard();
}

function drawCard() {
  const c = flashcards[fcIdx];
  fcFront.textContent = c.front;
  fcBack.textContent  = c.back;
  fcCur.textContent   = fcIdx + 1;
  fcFlipped_ = false;
  fcFront.classList.remove("hidden");
  fcBack.classList.add("hidden");
  fcHint.textContent = "Click karke reveal karo";
  fcCard.style.borderColor = "";
}

function flipCard() {
  fcFlipped_ = !fcFlipped_;
  fcFront.classList.toggle("hidden", fcFlipped_);
  fcBack.classList.toggle("hidden", !fcFlipped_);
  fcHint.textContent = fcFlipped_ ? "Click karke chhupao" : "Click karke reveal karo";
  fcCard.style.borderColor = fcFlipped_ ? "var(--green)" : "";
}

fcCard.addEventListener("click", flipCard);
fcFlip.addEventListener("click", flipCard);
fcPrev.addEventListener("click", () => { if (fcIdx > 0) { fcIdx--; drawCard(); } });
fcNext.addEventListener("click", () => { if (fcIdx < flashcards.length - 1) { fcIdx++; drawCard(); } });


// ── FOLLOW-UP ─────────────────────────────────────
function showFollow(action) {
  const map = {
    explain:    [["🧠 Quiz Me","quiz"],["📋 Summarize","summarize"],["🃏 Flashcards","flashcards"]],
    summarize:  [["🧠 Quiz Me","quiz"],["🔍 Explain","explain"],["🗺️ Mind Map","mindmap"]],
    quiz:       [["📋 Summary","summarize"],["🃏 Flashcards","flashcards"],["🔍 Explain","explain"]],
    flashcards: [["🧠 Quiz Me","quiz"],["📋 Summarize","summarize"]],
    mindmap:    [["📋 Summarize","summarize"],["🧠 Quiz Me","quiz"]],
  };
  const chips = map[action] || [];
  if (!chips.length) return;
  followChips.innerHTML = "";
  chips.forEach(([label, act]) => {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = label;
    b.addEventListener("click", () => run(act));
    followChips.appendChild(b);
  });
  follow.classList.remove("hidden");
}


// ── COPY & DOWNLOAD ───────────────────────────────
copyBtn.addEventListener("click", () => {
  const txt = currentAction === "flashcards"
    ? flashcards.map((c,i) => `Card ${i+1}\nFRONT: ${c.front}\nBACK: ${c.back}`).join("\n\n")
    : (currentOutput || outBody.innerText);
  navigator.clipboard.writeText(txt).then(() => {
    copyTxt.textContent = "Copied!";
    setTimeout(() => copyTxt.textContent = "Copy", 2000);
  });
});

downloadBtn.addEventListener("click", () => {
  const txt = currentOutput || outBody.innerText;
  const blob = new Blob([txt], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `studyai-${currentAction}-${Date.now()}.txt`;
  a.click(); URL.revokeObjectURL(a.href);
});


// ── LOADING ANIMATION ─────────────────────────────
function startLoading(action) {
  const msgs = {
    explain:    ["📖 Content padh raha hoon…","💡 Explain kar raha hoon…","✨ Almost done…"],
    summarize:  ["📚 Analyze kar raha hoon…","✍️ Summary likh raha hoon…","📝 Finalize kar raha hoon…"],
    quiz:       ["🎯 Material study kar raha hoon…","🧩 Questions bana raha hoon…","🔍 Options add kar raha hoon…"],
    flashcards: ["🃏 Concepts dhoondh raha hoon…","📌 Cards bana raha hoon…","✅ Almost ready…"],
    mindmap:    ["🗺️ Structure map kar raha hoon…","🌿 Branches grow kar raha hoon…","🧠 Ideas connect kar raha hoon…"],
  };
  const list = msgs[action] || ["⚡ Processing…"];
  let i = 0; loadingText.textContent = list[0];
  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => { i = (i+1)%list.length; loadingText.textContent = list[i]; }, 1800);
}


// ── BUSY STATE ────────────────────────────────────
function setBusy(on) {
  runBtn.disabled = on;
  runBtn.classList.toggle("busy", on);
  runBtn.innerHTML = on
    ? `Running… <svg class="arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`
    : `Run <svg class="arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  modeBtns.forEach(b => b.style.pointerEvents = on ? "none" : "");
  if (!on) { clearInterval(loadingTimer); validateInput(); }
}


// ── SETTINGS ──────────────────────────────────────
settingsToggle.addEventListener("click", e => {
  e.stopPropagation();
  historyPanel.classList.add("hidden");
  settingsPanel.classList.toggle("hidden");
});
saveSettings.addEventListener("click", () => {
  const url = backendInput.value.trim().replace(/\/$/, "");
  API_BASE  = url || DEFAULT_BACKEND;
  LANG_PREF = langSelect.value;
  localStorage.setItem("sai_backend", API_BASE);
  localStorage.setItem("sai_lang",    LANG_PREF);
  settingsPanel.classList.add("hidden");
  checkHealth();
});


// ── HISTORY ───────────────────────────────────────
historyToggle.addEventListener("click", e => {
  e.stopPropagation();
  settingsPanel.classList.add("hidden");
  historyPanel.classList.toggle("hidden");
  renderHistory();
});
clearHistory.addEventListener("click", () => {
  sessionHistory = [];
  localStorage.removeItem("sai_history");
  renderHistory();
});

function addHistory(action, response, preview) {
  sessionHistory.unshift({ action, preview, response, time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) });
  if (sessionHistory.length > 25) sessionHistory = sessionHistory.slice(0, 25);
  try { localStorage.setItem("sai_history", JSON.stringify(sessionHistory)); } catch {}
}

function renderHistory() {
  if (!sessionHistory.length) {
    historyList.innerHTML = '<p class="empty-msg">Koi history nahi abhi.</p>';
    return;
  }
  historyList.innerHTML = sessionHistory.map((item, i) => `
    <div class="h-item" data-i="${i}">
      <div class="h-action">${item.action}</div>
      <div class="h-preview">${(item.preview||"").replace(/</g,"&lt;").slice(0,70)}…</div>
      <div class="h-time">${item.time}</div>
    </div>
  `).join("");
  historyList.querySelectorAll(".h-item").forEach(el => {
    el.addEventListener("click", () => {
      const item = sessionHistory[+el.dataset.i];
      currentOutput = item.response;
      outputCard.classList.remove("hidden");
      fcViewer.classList.add("hidden");
      outBody.innerHTML = format(item.response, item.action);
      outBody.classList.remove("hidden");
      outputLabel.textContent = item.action;
      historyPanel.classList.add("hidden");
      outputCard.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  });
}

// Close panels on outside click
document.addEventListener("click", e => {
  if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) settingsPanel.classList.add("hidden");
  if (!historyPanel.contains(e.target) && !historyToggle.contains(e.target)) historyPanel.classList.add("hidden");
});


// ── HEALTH CHECK ──────────────────────────────────
async function checkHealth() {
  statusText.textContent = "Connecting…";
  statusPill.className = "status-pill";
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(6000) });
    const data = await r.json();
    if (r.ok) {
      const hasKey = data.gemini || data.groq;
      if (hasKey) {
        statusText.textContent = "AI Ready";
        statusPill.className = "status-pill online";
      } else {
        statusText.textContent = "API Keys Missing";
        statusPill.className = "status-pill error";
      }
    } else throw new Error();
  } catch {
    statusText.textContent = "Backend Offline";
    statusPill.className = "status-pill error";
  }
}