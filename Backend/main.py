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

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
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
        "model": "llama-3.3-70b-versatile",
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


# ── EXISTING ROUTES ────────────────────────────────────────────

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


# ── NEW: DECK & SPACED REPETITION ROUTES ──────────────────────
# These are additive — existing routes above are unchanged.

from datetime import datetime
from typing import List
from database import get_conn
from models import create_tables
from sm2 import calculate_sm2, next_review_date


# Create tables on startup
@app.on_event("startup")
def startup_event():
    try:
        create_tables()
        print("[DB] Tables ready ✅")
    except Exception as e:
        print(f"[DB] Table creation failed: {e}")


# ── Pydantic models for new routes ────────────────────────────

class CardIn(BaseModel):
    front: str
    back: str

class DeckCreate(BaseModel):
    name: str
    source: str = ""
    cards: List[CardIn] = []

class ReviewIn(BaseModel):
    quality: int  # 0-5


# ── Deck endpoints ─────────────────────────────────────────────

@app.post("/decks")
def create_deck(body: DeckCreate):
    """Save a new deck with its cards"""
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO decks (name, source) VALUES (?, ?)",
            (body.name.strip(), body.source.strip())
        )
        deck_id = cur.lastrowid

        for card in body.cards:
            conn.execute(
                "INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)",
                (deck_id, card.front.strip(), card.back.strip())
            )
        conn.commit()
        return {"id": deck_id, "name": body.name, "card_count": len(body.cards)}
    finally:
        conn.close()


@app.get("/decks")
def list_decks():
    """Get all decks with card counts and due counts"""
    conn = get_conn()
    try:
        now = datetime.utcnow().isoformat()
        rows = conn.execute("""
            SELECT
                d.id,
                d.name,
                d.source,
                d.created_at,
                COUNT(c.id)                                      AS total_cards,
                SUM(CASE WHEN c.next_review <= ? THEN 1 ELSE 0 END) AS due_cards,
                SUM(CASE WHEN c.repetitions >= 3 THEN 1 ELSE 0 END) AS mastered_cards
            FROM decks d
            LEFT JOIN cards c ON c.deck_id = d.id
            GROUP BY d.id
            ORDER BY d.created_at DESC
        """, (now,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.get("/decks/{deck_id}")
def get_deck(deck_id: int):
    """Get a single deck with all its cards"""
    conn = get_conn()
    try:
        deck = conn.execute("SELECT * FROM decks WHERE id = ?", (deck_id,)).fetchone()
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
        cards = conn.execute(
            "SELECT * FROM cards WHERE deck_id = ? ORDER BY id", (deck_id,)
        ).fetchall()
        return {**dict(deck), "cards": [dict(c) for c in cards]}
    finally:
        conn.close()


@app.delete("/decks/{deck_id}")
def delete_deck(deck_id: int):
    """Delete a deck and all its cards"""
    conn = get_conn()
    try:
        conn.execute("DELETE FROM cards WHERE deck_id = ?", (deck_id,))
        conn.execute("DELETE FROM decks WHERE id = ?", (deck_id,))
        conn.commit()
        return {"deleted": deck_id}
    finally:
        conn.close()


# ── Review / SM-2 endpoints ────────────────────────────────────

@app.get("/decks/{deck_id}/review")
def get_due_cards(deck_id: int):
    """Get cards due for review in this deck"""
    conn = get_conn()
    try:
        now = datetime.utcnow().isoformat()
        cards = conn.execute(
            "SELECT * FROM cards WHERE deck_id = ? AND next_review <= ? ORDER BY next_review",
            (deck_id, now)
        ).fetchall()
        return [dict(c) for c in cards]
    finally:
        conn.close()


@app.post("/cards/{card_id}/review")
def review_card(card_id: int, body: ReviewIn):
    """Submit a review rating for a card and update SM-2 schedule"""
    conn = get_conn()
    try:
        card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")

        new_interval, new_reps, new_ease = calculate_sm2(
            quality=body.quality,
            repetitions=card["repetitions"],
            easiness=card["easiness"],
            interval=card["interval"]
        )
        next_rev = next_review_date(new_interval)

        conn.execute(
            """UPDATE cards
               SET interval = ?, repetitions = ?, easiness = ?, next_review = ?
               WHERE id = ?""",
            (new_interval, new_reps, new_ease, next_rev, card_id)
        )
        conn.commit()
        return {
            "card_id": card_id,
            "next_review": next_rev,
            "interval_days": new_interval,
            "repetitions": new_reps,
            "easiness": new_ease
        }
    finally:
        conn.close()


@app.get("/decks/{deck_id}/stats")
def deck_stats(deck_id: int):
    """Mastery breakdown for a deck"""
    conn = get_conn()
    try:
        now = datetime.utcnow().isoformat()
        row = conn.execute("""
            SELECT
                COUNT(*)                                              AS total,
                SUM(CASE WHEN repetitions = 0 THEN 1 ELSE 0 END)     AS new_cards,
                SUM(CASE WHEN repetitions BETWEEN 1 AND 2 THEN 1 ELSE 0 END) AS learning,
                SUM(CASE WHEN repetitions >= 3 THEN 1 ELSE 0 END)    AS mastered,
                SUM(CASE WHEN next_review <= ? THEN 1 ELSE 0 END)    AS due
            FROM cards WHERE deck_id = ?
        """, (now, deck_id)).fetchone()
        return dict(row)
    finally:
        conn.close()