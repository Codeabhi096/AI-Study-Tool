// ── CONFIG ───────────────────────────────────────────────
const IS_LOCAL = ["localhost","127.0.0.1"].includes(window.location.hostname);
const DEFAULT_BACKEND = IS_LOCAL ? "http://localhost:8000" : "https://ai-study-tool-4tnw.onrender.com";

let API_BASE  = localStorage.getItem("sai_backend") || DEFAULT_BACKEND;
let LANG_PREF = localStorage.getItem("sai_lang")    || "English";

let sessionHistory = [];
try { sessionHistory = JSON.parse(localStorage.getItem("sai_history") || "[]"); } catch {}

// ── ANIMATED CANVAS BACKGROUND ───────────────────────────
(function initCanvas() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.reset = function () {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 1.5 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.a  = Math.random() * 0.4 + 0.1;
      this.c  = Math.random() > 0.6 ? [240,192,64] : [79,142,240];
    };
    this.reset();
  }

  function init() {
    particles = Array.from({ length: 60 }, () => new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const g1 = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, W * 0.5);
    g1.addColorStop(0, "rgba(79,142,240,0.07)");
    g1.addColorStop(1, "transparent");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    const g2 = ctx.createRadialGradient(W * 0.85, H * 0.6, 0, W * 0.85, H * 0.6, W * 0.4);
    g2.addColorStop(0, "rgba(240,192,64,0.05)");
    g2.addColorStop(1, "transparent");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) p.reset();

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${p.a})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  resize();
  init();
  draw();
  window.addEventListener("resize", () => { resize(); });
})();

// ── DOM REFS ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

const textInput    = $("text-input");
const charCount    = $("char-count");
const wordCount    = $("word-count");
const wordStat     = $("word-stat");
const clearTextBtn = $("clear-text");

const fileInput    = $("file-input");
const dropZone     = $("drop-zone");
const fileBar      = $("file-bar");
const fileExt      = $("file-ext");
const fileName     = $("file-name");
const fileSize     = $("file-size");
const clearFileBtn = $("clear-file");

const outputCard   = $("output-card");
const outTitle     = $("out-title");
const outIcon      = $("out-icon");
const outBody      = $("out-body");
const sourceTag    = $("source-tag");
const loadingEl    = $("loading");
const loadingText  = $("loading-text");
const copyBtn      = $("copy-btn");
const copyLbl      = $("copy-lbl");
const downloadBtn  = $("download-btn");
const followup     = $("followup");
const fuChips      = $("fu-chips");
const runBtn       = $("run-btn");
const runLabel     = $("run-label");

const statusChip   = $("status-chip");
const statusDot    = $("status-dot");
const statusLabel  = $("status-label");

const tabs         = document.querySelectorAll(".tab");
const modeBtns     = document.querySelectorAll(".mode-btn");

// Settings
const settingsBtn      = $("settings-btn");
const settingsDrawer   = $("settings-drawer");
const settingsBackdrop = $("settings-backdrop");
const settingsClose    = $("settings-close");
const backendInput     = $("backend-input");
const langSelect       = $("lang-select");
const settingsSave     = $("settings-save");

// History
const historyBtn      = $("history-btn");
const historyDrawer   = $("history-drawer");
const historyBackdrop = $("history-backdrop");
const historyClose    = $("history-close");
const historyList     = $("history-list");
const clearHistoryBtn = $("clear-history-btn");

// Flashcard
const fcViewer  = $("fc-viewer");
const fcCard    = $("fc-card");
const fcFrontTx = $("fc-front-txt");
const fcBackTx  = $("fc-back-txt");
const fcHint    = $("fc-hint");
const fcCur     = $("fc-cur");
const fcTot     = $("fc-tot");
const fcFill    = $("fc-fill");
const fcFlipBtn = $("fc-flip");
const fcPrevBtn = $("fc-prev");
const fcNextBtn = $("fc-next");

// ── STATE ────────────────────────────────────────────────
let currentTab    = "text";
let selectedFile  = null;
let currentAction = "explain";
let currentOutput = "";
let flashcards    = [];
let fcIdx         = 0;
let fcFlipped     = false;
let loadingTimer;

// ── INIT ─────────────────────────────────────────────────
backendInput.value = API_BASE;
langSelect.value   = LANG_PREF;
checkHealth();

// ── TABS ─────────────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    $(`panel-${currentTab}`).classList.add("active");
    validateInput();
  });
});

// ── TEXT INPUT ────────────────────────────────────────────
textInput.addEventListener("input", () => {
  const v = textInput.value;
  charCount.textContent = v.length.toLocaleString();
  wordCount.textContent = v.trim() ? v.trim().split(/\s+/).length : 0;
  const has = v.length > 0;
  wordStat.classList.toggle("hidden", !has);
  clearTextBtn.classList.toggle("hidden", !has);
  validateInput();
});

clearTextBtn.addEventListener("click", () => {
  textInput.value = "";
  charCount.textContent = "0";
  wordCount.textContent = "0";
  wordStat.classList.add("hidden");
  clearTextBtn.classList.add("hidden");
  validateInput();
});

// ── FILE UPLOAD ───────────────────────────────────────────
fileInput.addEventListener("change", () => { if (fileInput.files[0]) selectFile(fileInput.files[0]); });
dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
});

function selectFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["pdf","txt","csv","json"].includes(ext)) {
    showError(`Unsupported file type: .${ext}\nAllowed: PDF, TXT, CSV, JSON`);
    return;
  }
  selectedFile = file;
  fileName.textContent = file.name;
  fileExt.textContent  = ext.toUpperCase();
  fileSize.textContent = fmtBytes(file.size);
  fileBar.classList.remove("hidden");
  validateInput();
}

clearFileBtn.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  fileBar.classList.add("hidden");
  validateInput();
});

function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

// ── MODE BUTTONS ──────────────────────────────────────────
modeBtns.forEach(b => b.addEventListener("click", () => {
  modeBtns.forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  currentAction = b.dataset.action;
}));

// ── VALIDATE ─────────────────────────────────────────────
function validateInput() {
  const ok = (currentTab === "text" && textInput.value.trim().length > 5)
          || (currentTab === "file" && selectedFile);
  runBtn.disabled = !ok;
}

// ── RUN ───────────────────────────────────────────────────
runBtn.addEventListener("click", () => run(currentAction));

async function run(action) {
  currentAction = action;

  modeBtns.forEach(b => b.classList.toggle("active", b.dataset.action === action));

  outputCard.classList.remove("hidden");
  followup.classList.add("hidden");
  outBody.classList.add("hidden");
  outBody.innerHTML = "";
  fcViewer.classList.add("hidden");
  loadingEl.classList.remove("hidden");

  // Hide save deck button while loading
  const existingSave = $("save-deck-btn");
  if (existingSave) existingSave.remove();

  const META = {
    explain:    { icon:"📖", title:"Explanation" },
    summarize:  { icon:"📋", title:"Summary" },
    quiz:       { icon:"🧠", title:"Quiz" },
    flashcards: { icon:"🃏", title:"Flashcards" },
    mindmap:    { icon:"🗺️", title:"Mind Map" },
  };
  const m = META[action] || { icon:"✨", title:"Result" };
  outIcon.textContent  = m.icon;
  outTitle.textContent = m.title;

  startLoadingAnim(action);
  setBusy(true);

  try {
    const data = currentTab === "file"
      ? await apiFile(selectedFile, action)
      : await apiText(textInput.value, action);
    renderResult(data, action);
    saveHistory(action, data.response, currentTab === "file" ? selectedFile.name : textInput.value.slice(0, 80));
  } catch (err) {
    showError(err.message || "Request failed. Check backend URL in Settings.");
  } finally {
    setBusy(false);
    loadingEl.classList.add("hidden");
  }
}

// ── API CALLS ─────────────────────────────────────────────
async function apiText(content, action) {
  const res = await fetch(`${API_BASE}/process-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, action, lang: LANG_PREF })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiFile(file, action) {
  const form = new FormData();
  form.append("file", file);
  form.append("action", action);
  form.append("lang", LANG_PREF);
  const res = await fetch(`${API_BASE}/upload-file`, { method: "POST", body: form });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── RENDER RESULT ─────────────────────────────────────────
function renderResult(data, action) {
  currentOutput = data.response || "";

  const src = data.ai_source || "gemini";
  sourceTag.textContent = src.charAt(0).toUpperCase() + src.slice(1);
  sourceTag.className   = `source-tag ${src}`;

  if (action === "flashcards") {
    buildFlashcards(currentOutput);
  } else {
    outBody.innerHTML = formatOutput(currentOutput, action);
    outBody.classList.remove("hidden");
  }

  renderFollowup(action);
  setTimeout(() => outputCard.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
}

function showError(msg) {
  outputCard.classList.remove("hidden");
  loadingEl.classList.add("hidden");
  outBody.innerHTML = `<span style="color:var(--red);white-space:pre-wrap">⚠️ ${msg}</span>`;
  outBody.classList.remove("hidden");
  sourceTag.textContent = "Error";
  sourceTag.className = "source-tag error";
  followup.classList.add("hidden");
}

// ── OUTPUT FORMATTER ──────────────────────────────────────
function formatOutput(text, action) {
  let s = text
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");

  s = s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.*?)\*/g,     "<em>$1</em>");

  if (action === "quiz") {
    s = s.replace(/(Q\d+\..+)/g,              '<div class="quiz-q">$1</div>');
    s = s.replace(/(Answer:\s*[A-D]\)?.+)/gi, '<div class="ans-line">✅ $1</div>');
    s = s.replace(/(Explanation:\s*.+)/gi,    '<div class="exp-line">💬 $1</div>');
    return s;
  }
  if (action === "mindmap") {
    s = s.replace(/(🧠 CENTRAL TOPIC:.+)/g,   '<div class="sec-head">$1</div>');
    s = s.replace(/(📌 BRANCH \d+:.+)/g,      '<div class="mm-branch">$1</div>');
    s = s.replace(/(  → .+)/g,                '<div class="mm-sub">$1</div>');
    return s;
  }
  if (action === "summarize") {
    s = s.replace(/(📌.+|🔑.+|💬.+|🎯.+)/g, '<div class="sec-head">$1</div>');
    return s;
  }
  return s;
}

// ── FLASHCARDS ────────────────────────────────────────────
function buildFlashcards(text) {
  flashcards = [];
  text.split(/CARD \d+/i).filter(b => b.trim()).forEach(block => {
    const f = block.match(/FRONT:\s*(.+?)(?=BACK:|$)/is);
    const b = block.match(/BACK:\s*(.+?)(?=$)/is);
    if (f && b) flashcards.push({ front: f[1].trim(), back: b[1].trim() });
  });

  if (!flashcards.length) {
    outBody.innerHTML = formatOutput(text, "explain");
    outBody.classList.remove("hidden");
    return;
  }

  fcIdx = 0; fcFlipped = false;
  fcTot.textContent = flashcards.length;
  fcViewer.classList.remove("hidden");
  drawCard();

  // ── SAVE DECK BUTTON (added after flashcards render) ──
  injectSaveDeckButton();
}

function injectSaveDeckButton() {
  // Remove any existing one
  const old = $("save-deck-btn");
  if (old) old.remove();

  const btn = document.createElement("button");
  btn.id = "save-deck-btn";
  btn.innerHTML = "💾 Save as Deck";
  btn.style.cssText = `
    display: block;
    width: calc(100% - 3rem);
    margin: 0 1.5rem 1.2rem;
    padding: .55rem 1rem;
    background: none;
    border: 1px dashed rgba(240,192,64,.35);
    border-radius: var(--r-sm);
    color: var(--gold);
    font-family: var(--sans);
    font-weight: 700;
    font-size: .84rem;
    cursor: pointer;
    transition: all .18s;
  `;
  btn.onmouseenter = () => { btn.style.background = "var(--gold-a10)"; btn.style.borderStyle = "solid"; };
  btn.onmouseleave = () => { btn.style.background = "none"; btn.style.borderStyle = "dashed"; };
  btn.onclick = saveDeck;

  // Insert after flashcard viewer, before followup
  const fc = $("fc-viewer");
  fc.parentNode.insertBefore(btn, fc.nextSibling);
}

async function saveDeck() {
  if (!flashcards.length) return;

  // Deck name — use file name or first 40 chars of input
  let defaultName = "";
  if (currentTab === "file" && selectedFile) {
    defaultName = selectedFile.name.replace(/\.[^.]+$/, "");
  } else {
    defaultName = textInput.value.trim().slice(0, 40).replace(/\n/g, " ");
  }

  const name = prompt("Name this deck:", defaultName || "My Deck");
  if (!name || !name.trim()) return;

  const btn = $("save-deck-btn");
  const origText = btn.innerHTML;
  btn.innerHTML = "Saving…";
  btn.disabled  = true;

  try {
    const res = await fetch(`${API_BASE}/decks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        source: currentTab === "file" && selectedFile ? selectedFile.name : "",
        cards: flashcards.map(c => ({ front: c.front, back: c.back }))
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    btn.innerHTML = `✅ Saved "${data.name}" (${data.card_count} cards)`;
    btn.style.borderColor = "rgba(52,211,153,.4)";
    btn.style.color = "var(--green)";
    btn.style.borderStyle = "solid";

    // After 3s show "View Decks" link
    setTimeout(() => {
      btn.innerHTML = `✅ Saved! <a href="decks.html" style="color:var(--gold);margin-left:.4rem">View My Decks →</a>`;
      btn.disabled = false;
      btn.onclick = null;
    }, 2500);

  } catch (e) {
    btn.innerHTML = origText;
    btn.disabled  = false;
    alert("Save failed — check backend connection.\n" + e.message);
  }
}

function drawCard() {
  const c = flashcards[fcIdx];
  fcFrontTx.textContent = c.front;
  fcBackTx.textContent  = c.back;
  fcCur.textContent     = fcIdx + 1;
  fcFill.style.width = `${((fcIdx + 1) / flashcards.length) * 100}%`;
  fcFlipped = false;
  fcCard.classList.remove("flipped");
  fcHint.textContent = "Click card to reveal answer";
}

function flipCard() {
  fcFlipped = !fcFlipped;
  fcCard.classList.toggle("flipped", fcFlipped);
  fcHint.textContent = fcFlipped ? "Click to hide answer" : "Click card to reveal answer";
}

fcCard.addEventListener("click",  flipCard);
fcFlipBtn.addEventListener("click", flipCard);
fcPrevBtn.addEventListener("click", () => { if (fcIdx > 0) { fcIdx--; drawCard(); } });
fcNextBtn.addEventListener("click", () => { if (fcIdx < flashcards.length - 1) { fcIdx++; drawCard(); } });

// ── FOLLOW-UP ─────────────────────────────────────────────
function renderFollowup(action) {
  const MAP = {
    explain:    [["🧠 Quiz Me","quiz"],     ["📋 Summarize","summarize"], ["🃏 Flashcards","flashcards"]],
    summarize:  [["🧠 Quiz Me","quiz"],     ["🔍 Explain","explain"],     ["🗺️ Mind Map","mindmap"]],
    quiz:       [["📋 Summarize","summarize"],["🃏 Flashcards","flashcards"],["🔍 Explain","explain"]],
    flashcards: [["🧠 Quiz Me","quiz"],     ["📋 Summarize","summarize"]],
    mindmap:    [["📋 Summarize","summarize"],["🧠 Quiz Me","quiz"]],
  };
  const chips = MAP[action] || [];
  if (!chips.length) return;

  fuChips.innerHTML = "";
  chips.forEach(([label, act]) => {
    const btn = document.createElement("button");
    btn.className = "chip"; btn.textContent = label;
    btn.addEventListener("click", () => run(act));
    fuChips.appendChild(btn);
  });
  followup.classList.remove("hidden");
}

// ── COPY & DOWNLOAD ───────────────────────────────────────
copyBtn.addEventListener("click", () => {
  const text = currentAction === "flashcards"
    ? flashcards.map((c, i) => `Card ${i+1}\nFront: ${c.front}\nBack: ${c.back}`).join("\n\n")
    : (currentOutput || outBody.innerText);

  navigator.clipboard.writeText(text).then(() => {
    copyLbl.textContent = "Copied!";
    copyBtn.style.borderColor = "var(--green)";
    copyBtn.style.color = "var(--green)";
    setTimeout(() => {
      copyLbl.textContent = "Copy";
      copyBtn.style.borderColor = "";
      copyBtn.style.color = "";
    }, 2000);
  });
});

downloadBtn.addEventListener("click", () => {
  const text = currentOutput || outBody.innerText;
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `studyai-${currentAction}-${Date.now()}.txt`;
  a.click(); URL.revokeObjectURL(a.href);
});

// ── LOADING ANIMATION ─────────────────────────────────────
function startLoadingAnim(action) {
  const MSGS = {
    explain:    ["Reading your content…","Forming explanation…","Almost ready…"],
    summarize:  ["Analyzing content…","Writing summary…","Finalizing…"],
    quiz:       ["Studying the material…","Building questions…","Adding answer choices…"],
    flashcards: ["Identifying key concepts…","Creating flashcards…","Almost done…"],
    mindmap:    ["Mapping the structure…","Growing branches…","Connecting ideas…"],
  };
  const list = MSGS[action] || ["Processing…"];
  let i = 0;
  loadingText.textContent = list[0];
  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    i = (i + 1) % list.length;
    loadingText.textContent = list[i];
  }, 1800);
}

// ── BUSY STATE ────────────────────────────────────────────
function setBusy(on) {
  runBtn.disabled = on;
  runBtn.classList.toggle("busy", on);
  runLabel.textContent = on ? "Running…" : "Run";
  modeBtns.forEach(b => b.style.pointerEvents = on ? "none" : "");
  if (!on) { clearInterval(loadingTimer); validateInput(); }
}

// ── SETTINGS DRAWER ───────────────────────────────────────
function openSettings() {
  settingsDrawer.classList.remove("hidden");
  settingsBackdrop.classList.remove("hidden");
}
function closeSettings() {
  settingsDrawer.classList.add("hidden");
  settingsBackdrop.classList.add("hidden");
}
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", closeSettings);
settingsSave.addEventListener("click", () => {
  API_BASE  = backendInput.value.trim().replace(/\/$/, "") || DEFAULT_BACKEND;
  LANG_PREF = langSelect.value;
  localStorage.setItem("sai_backend", API_BASE);
  localStorage.setItem("sai_lang",    LANG_PREF);
  closeSettings();
  checkHealth();
});

// ── HISTORY DRAWER ────────────────────────────────────────
function openHistory() {
  historyDrawer.classList.remove("hidden");
  historyBackdrop.classList.remove("hidden");
  renderHistory();
}
function closeHistory() {
  historyDrawer.classList.add("hidden");
  historyBackdrop.classList.add("hidden");
}
historyBtn.addEventListener("click", openHistory);
historyClose.addEventListener("click", closeHistory);
historyBackdrop.addEventListener("click", closeHistory);

clearHistoryBtn.addEventListener("click", () => {
  sessionHistory = [];
  localStorage.removeItem("sai_history");
  renderHistory();
});

function saveHistory(action, response, preview) {
  sessionHistory.unshift({
    action, response,
    preview: (preview || response).slice(0, 80),
    time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
  });
  if (sessionHistory.length > 30) sessionHistory = sessionHistory.slice(0, 30);
  try { localStorage.setItem("sai_history", JSON.stringify(sessionHistory)); } catch {}
}

function renderHistory() {
  if (!sessionHistory.length) {
    historyList.innerHTML = `
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <p>No history yet</p>
        <span>Analyzed sessions appear here</span>
      </div>`;
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
      outBody.innerHTML = formatOutput(item.response, item.action);
      outBody.classList.remove("hidden");
      const META = { explain:"📖 Explanation", summarize:"📋 Summary", quiz:"🧠 Quiz", flashcards:"🃏 Flashcards", mindmap:"🗺️ Mind Map" };
      outTitle.textContent = item.action;
      outIcon.textContent  = META[item.action]?.charAt(0) || "✨";
      closeHistory();
      outputCard.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  });
}

// ── HEALTH CHECK ──────────────────────────────────────────
async function checkHealth() {
  statusLabel.textContent = "Connecting";
  statusChip.className = "status-chip";

  try {
    const res  = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    if (res.ok) {
      const hasKey = data.gemini || data.groq;
      if (hasKey) {
        statusLabel.textContent = "AI Ready";
        statusChip.className = "status-chip online";
      } else {
        statusLabel.textContent = "Keys Missing";
        statusChip.className = "status-chip error";
      }
    } else throw new Error();
  } catch {
    statusLabel.textContent = "Offline";
    statusChip.className = "status-chip error";
  }
}