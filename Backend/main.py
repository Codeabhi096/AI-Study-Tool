import os
import json
import csv
import io
import httpx

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env BEFORE anything else
load_dotenv()

try:
    import pdfplumber
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

app = FastAPI(title="AI Study Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "").strip()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"


# ── AI CALLERS ─────────────────────────────────────────────────

async def call_gemini(prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1500}
    }
    async with httpx.AsyncClient(timeout=40) as client:
        resp = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def call_groq(prompt: str) -> str:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1500,
        "temperature": 0.7
    }
    async with httpx.AsyncClient(timeout=40) as client:
        resp = await client.post(GROQ_URL, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def call_ai(prompt: str) -> dict:
    """Gemini first → Groq fallback → error message"""
    if GEMINI_API_KEY:
        try:
            text = await call_gemini(prompt)
            return {"text": text, "source": "gemini"}
        except Exception as e:
            print(f"[Gemini failed] {e}")

    if GROQ_API_KEY:
        try:
            text = await call_groq(prompt)
            return {"text": text, "source": "groq"}
        except Exception as e:
            print(f"[Groq failed] {e}")

    return {
        "text": (
            "⚠️ Both AI services unavailable.\n\n"
            "Check:\n"
            "1. GEMINI_API_KEY and GROQ_API_KEY are set in your .env file\n"
            "2. .env file is in the same folder as main.py\n"
            "3. API keys are valid (not expired / quota exceeded)\n\n"
            f"Gemini key set: {'YES' if GEMINI_API_KEY else 'NO'}\n"
            f"Groq key set:   {'YES' if GROQ_API_KEY else 'NO'}"
        ),
        "source": "error"
    }


# ── FILE PARSERS ───────────────────────────────────────────────

def parse_pdf(file_bytes: bytes) -> str:
    if not PDF_SUPPORT:
        return "[PDF parsing not available — run: pip install pdfplumber]"
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]
    return "\n".join(pages)[:8000]

def parse_csv(file_bytes: bytes) -> str:
    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)[:60]
    return "\n".join([", ".join(r) for r in rows])

def parse_json(file_bytes: bytes) -> str:
    text = file_bytes.decode("utf-8", errors="replace")
    try:
        data = json.loads(text)
        return json.dumps(data, indent=2)[:8000]
    except json.JSONDecodeError:
        return text[:8000]

def parse_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="replace")[:8000]

def extract_text(filename: str, file_bytes: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    parsers = {"pdf": parse_pdf, "csv": parse_csv, "json": parse_json, "txt": parse_txt}
    return parsers.get(ext, parse_txt)(file_bytes)


# ── PROMPT BUILDERS ────────────────────────────────────────────

def build_prompt(action: str, content: str, lang: str = "English") -> str:
    lang_note = f"\n\nIMPORTANT: Respond in {lang}." if lang != "English" else ""
    base = f"Here is some content:\n\n{content}\n\n"

    prompts = {
        "explain": base + (
            "Explain this content in simple, beginner-friendly terms. "
            "Use bullet points where helpful. Use **bold** for key terms. "
            "End with a one-line 💡 Key Takeaway."
            + lang_note
        ),
        "summarize": base + (
            "Write a structured summary:\n"
            "**📌 Main Topic:** (1 line)\n"
            "**🔑 Key Points:** (3-5 bullets)\n"
            "**💬 Details:** (2-3 bullets)\n"
            "**🎯 Bottom Line:** (1-2 sentences)"
            + lang_note
        ),
        "quiz": base + (
            "Generate exactly 5 multiple-choice questions. Format:\n\n"
            "Q1. [Question]\nA) ...\nB) ...\nC) ...\nD) ...\n"
            "Answer: [Letter]) [Option]\nExplanation: [Why]\n\n"
            "Repeat for Q2-Q5. Make questions progressively harder."
            + lang_note
        ),
        "flashcards": base + (
            "Create 6 flashcards. Use EXACTLY this format:\n\n"
            "CARD 1\nFRONT: [Term or question]\nBACK: [Definition or answer]\n\n"
            "Repeat for CARD 2 through CARD 6."
            + lang_note
        ),
        "mindmap": base + (
            "Create a text mind map:\n\n"
            "🧠 CENTRAL TOPIC: [Main topic]\n\n"
            "📌 BRANCH 1: [Category]\n  → [Sub-point]\n  → [Sub-point]\n\n"
            "Make 3-5 branches."
            + lang_note
        ),
    }
    return prompts.get(action, base + "Analyze and explain this content helpfully." + lang_note)


# ── ROUTES ─────────────────────────────────────────────────────

class TextRequest(BaseModel):
    content: str
    action: str = "explain"
    lang: str = "English"


@app.get("/")
def root():
    return {
        "status": "AI Study Tool API is running 🚀",
        "gemini_key": "✅ Set" if GEMINI_API_KEY else "❌ Missing",
        "groq_key":   "✅ Set" if GROQ_API_KEY   else "❌ Missing",
        "pdf_support": PDF_SUPPORT,
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "gemini": bool(GEMINI_API_KEY),
        "groq":   bool(GROQ_API_KEY),
    }


@app.post("/process-text")
async def process_text(req: TextRequest):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty.")
    prompt = build_prompt(req.action, req.content[:8000], req.lang)
    result = await call_ai(prompt)
    return {"action": req.action, "response": result["text"], "ai_source": result["source"]}


@app.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    action: str = Form("explain"),
    lang: str = Form("English"),
):
    allowed = {"pdf", "txt", "csv", "json"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file: .{ext}")

    file_bytes = await file.read()
    content = extract_text(file.filename, file_bytes)

    if not content.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file.")

    prompt = build_prompt(action, content, lang)
    result = await call_ai(prompt)
    return {"filename": file.filename, "action": action, "response": result["text"], "ai_source": result["source"]}