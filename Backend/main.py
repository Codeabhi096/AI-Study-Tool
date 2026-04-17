import os
import json
import csv
import io
import httpx

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# --- PDF support (optional, graceful fallback) ---
try:
    import pdfplumber
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

load_dotenv()

app = FastAPI(title="AI Study Tool")

# Allow all origins for simple deployment (tighten in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"


# ─────────────────────────────────────────────
#  AI CALLERS
# ─────────────────────────────────────────────

async def call_gemini(prompt: str) -> str:
    """Call Google Gemini Flash (free tier)."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024}
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json=payload
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def call_groq(prompt: str) -> str:
    """Call Groq (free tier, llama3-8b)."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1024,
        "temperature": 0.7
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(GROQ_URL, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def call_ai(prompt: str) -> dict:
    """
    Fallback chain: Gemini → Groq → safe error message.
    Returns {"text": "...", "source": "gemini|groq|error"}
    """
    # Try Gemini first
    if GEMINI_API_KEY:
        try:
            text = await call_gemini(prompt)
            return {"text": text, "source": "gemini"}
        except Exception as e:
            print(f"[Gemini failed] {e}")

    # Fallback to Groq
    if GROQ_API_KEY:
        try:
            text = await call_groq(prompt)
            return {"text": text, "source": "groq"}
        except Exception as e:
            print(f"[Groq failed] {e}")

    # Both failed
    return {
        "text": "⚠️ Both AI services are currently unavailable. Please check your API keys in the .env file.",
        "source": "error"
    }


# ─────────────────────────────────────────────
#  FILE PARSERS
# ─────────────────────────────────────────────

def parse_pdf(file_bytes: bytes) -> str:
    if not PDF_SUPPORT:
        return "[PDF parsing not available — install pdfplumber]"
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]
    return "\n".join(pages)[:6000]   # cap at 6k chars


def parse_csv(file_bytes: bytes) -> str:
    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)[:50]   # first 50 rows
    lines = [", ".join(r) for r in rows]
    return "\n".join(lines)


def parse_json(file_bytes: bytes) -> str:
    text = file_bytes.decode("utf-8", errors="replace")
    try:
        data = json.loads(text)
        pretty = json.dumps(data, indent=2)
        return pretty[:6000]
    except json.JSONDecodeError:
        return text[:6000]


def parse_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="replace")[:6000]


def extract_text(filename: str, file_bytes: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    parsers = {
        "pdf": parse_pdf,
        "csv": parse_csv,
        "json": parse_json,
        "txt": parse_txt,
    }
    parser = parsers.get(ext, parse_txt)
    return parser(file_bytes)


# ─────────────────────────────────────────────
#  PROMPT BUILDERS
# ─────────────────────────────────────────────

def build_prompt(action: str, content: str) -> str:
    base = f"Here is some content:\n\n{content}\n\n"

    prompts = {
        "explain": base + (
            "Please explain this content in simple, beginner-friendly terms. "
            "Use bullet points where helpful. End with a one-line suggestion "
            "like: 'Do you want a quiz from this?' or 'Do you want key points?'"
        ),
        "summarize": base + (
            "Please provide a concise, well-structured summary of this content. "
            "Use sections if needed. End with 2-3 suggested follow-up actions "
            "the learner could take."
        ),
        "quiz": base + (
            "Generate a 5-question multiple-choice quiz based on this content. "
            "Format:\nQ1. Question?\nA) ...\nB) ...\nC) ...\nD) ...\nAnswer: X\n\n"
            "Repeat for Q2-Q5."
        ),
    }
    return prompts.get(action, base + "Please analyze and explain this content.")


# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────

class TextRequest(BaseModel):
    content: str
    action: str = "explain"   # explain | summarize | quiz


@app.get("/")
def root():
    return {"status": "AI Study Tool API is running 🚀"}


@app.post("/process-text")
async def process_text(req: TextRequest):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty.")

    prompt = build_prompt(req.action, req.content[:6000])
    result = await call_ai(prompt)
    return {
        "action": req.action,
        "response": result["text"],
        "ai_source": result["source"]
    }


@app.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    action: str = Form("explain")
):
    allowed = {"pdf", "txt", "csv", "json"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}. Use PDF, TXT, CSV, or JSON.")

    file_bytes = await file.read()
    content = extract_text(file.filename, file_bytes)

    if not content.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file.")

    prompt = build_prompt(action, content)
    result = await call_ai(prompt)
    return {
        "filename": file.filename,
        "action": action,
        "response": result["text"],
        "ai_source": result["source"]
    }


@app.post("/quiz")
async def generate_quiz(req: TextRequest):
    """Dedicated quiz endpoint."""
    req.action = "quiz"
    return await process_text(req)
