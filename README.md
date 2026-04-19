# ⚡ AI Study Tool

A lightweight, free-to-deploy AI-powered study assistant. Upload or paste text, PDFs, CSVs, or JSON — get instant explanations, summaries, and quizzes.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📝 Paste Text | Paste notes, articles, code, or anything |
| 📁 File Upload | Upload PDF, TXT, CSV, or JSON files |
| 🔍 Explain | AI explains content in simple terms |
| 📋 Summarize | Concise, structured summary |
| 🧠 Quiz Me | Auto-generated 5-question quiz |
| 💡 Smart Suggestions | Follow-up chips after every result |
| 🔁 AI Fallback | Gemini → Groq → error message |

---

## 🛠️ Tech Stack

```
Frontend:   HTML + CSS + Vanilla JS   → Vercel (free)
Backend:    FastAPI (Python)          → Render (free)
AI APIs:    Google Gemini Flash       → Primary
            Groq (llama3-8b)          → Fallback
```

---

## 📁 Project Structure

```
ai-study-tool/
├── backend/
│   ├── main.py            ← FastAPI app (all endpoints + AI logic)
│   ├── requirements.txt   ← Python dependencies
│   ├── render.yaml        ← Render deployment config
│   └── .env.example       ← API key template
├── frontend/
│   ├── index.html         ← Main UI
│   ├── style.css          ← Styles
│   ├── script.js          ← All JS logic + fetch calls
│   └── vercel.json        ← Vercel config
└── README.md
```


## 🚀 Local Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn main:app --reload
# Runs at http://localhost:8000
```

### Frontend
```bash
cd frontend
# Just open index.html in browser — no build step!
# Or use live-server:
npx live-server .
```

> **Note:** When running locally, `script.js` auto-detects localhost and points to `http://localhost:8000`.



--

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| POST | `/process-text` | Process pasted text |
| POST | `/upload-file` | Process uploaded file |
| POST | `/quiz` | Generate quiz (alias) |

### POST `/process-text`
```json
{
  "content": "your text here",
  "action": "explain"   // explain | summarize | quiz
}
```

### POST `/upload-file`
- Form data: `file` (multipart), `action` (string)

---

## 💡 Tips

- **PDF not parsing?** Make sure `pdfplumber` is installed (it's in requirements.txt)
- **Render cold start?** Free tier sleeps after 15 min inactivity. First request may be slow.
- **Rate limits?** Both Gemini and Groq free tiers have generous limits for personal use.
- **CORS errors?** The backend allows all origins (`*`). For production, restrict to your Vercel domain.

---

## 📄 License

MIT — free to use and modify.
