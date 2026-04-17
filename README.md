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

---

## 🔑 API Key Setup

### 1. Google Gemini (Free)
1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API Key**
3. Copy the key

### 2. Groq (Free)
1. Go to https://console.groq.com/keys
2. Click **Create API Key**
3. Copy the key

### 3. Create `.env` file in `/backend`
```bash
cp backend/.env.example backend/.env
# Then edit .env and paste your keys
```

```env
GEMINI_API_KEY=your_gemini_key_here
GROQ_API_KEY=your_groq_key_here
```

---

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

---

## ☁️ Deployment (FREE)

### Backend → Render

1. Push your code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set **Root Directory** to `backend`
5. **Build Command:** `pip install -r requirements.txt`
6. **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
7. Add Environment Variables:
   - `GEMINI_API_KEY` = your key
   - `GROQ_API_KEY` = your key
8. Click **Deploy**
9. Copy the URL: `https://your-app.onrender.com`

### Frontend → Vercel

1. Edit `frontend/script.js` — update `API_BASE`:
   ```js
   : "https://your-app.onrender.com"  // ← paste Render URL here
   ```
2. Go to https://vercel.com → New Project
3. Import your GitHub repo
4. Set **Root Directory** to `frontend`
5. Click **Deploy**
6. Done! Your app is live 🎉

---

## 🔁 How the Fallback System Works

```
User clicks a button
        ↓
  call_ai(prompt)
        ↓
  GEMINI_API_KEY set?
    ├─ YES → call_gemini() 
    │         ├─ Success → return result (source: "gemini")
    │         └─ Fail    → try next
    └─ NO  → try next
        ↓
  GROQ_API_KEY set?
    ├─ YES → call_groq()
    │         ├─ Success → return result (source: "groq")
    │         └─ Fail    → safe message
    └─ NO  → safe error message
```

The frontend shows which AI responded via a colored badge (`GEMINI` / `GROQ` / `ERROR`).

---

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
