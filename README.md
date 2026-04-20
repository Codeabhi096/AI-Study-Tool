
# ⚡ AI Study Tool – The Flashcard Engine

An advanced AI-powered study assistant that transforms **passive content into active learning systems** using summaries, quizzes, flashcards, and **spaced repetition (SM-2 algorithm)**.

---

## 🌐 Live Demo

* 🚀 **App:** [https://ai-study-tool-wyrb.vercel.app/](https://ai-study-tool-wyrb.vercel.app/)
* 👨‍💻 **Portfolio:** [https://mrabhi-7208.netlify.app/](https://mrabhi-7208.netlify.app/)

---

## 🚀 What Makes This Different?

Most tools just summarize content.
This tool goes further — it converts content into a **complete learning cycle**:

> 📥 Input → 🧠 Understanding → 🃏 Practice → 🔁 Retention

---

## ✨ Features

### 📥 Input & Processing

* 📝 Paste text (notes, articles, code)
* 📁 Upload files (PDF, TXT, CSV, JSON)
* 🎥 YouTube video link support

---

### 🧠 AI-Powered Learning

* 🔍 Explain complex content in simple terms
* 📋 Generate structured summaries
* 📝 Create smart revision notes
* 🧪 Auto-generate quizzes
* 💬 Interactive AI chat assistant

---

### 🃏 Flashcards System

* Auto-generate flashcards from content
* Covers key concepts, definitions, and insights
* Designed for **active recall learning**

---

### 📂 Deck Management 

* 💾 Save flashcards as decks
* 📚 View all decks in "My Decks"
* 🔁 Review cards anytime
* 📊 Track learning progress

---

### 📄 Export & Utility

* Download notes
* Multi-language support
* Smart follow-up suggestions

---

## 🧱 Tech Stack

**Frontend:**

* HTML, CSS, JavaScript

**Backend:**

* FastAPI (Python)

**Database:**

* SQLite

**AI Integration:**

* Gemini API
* Groq API

**Algorithm:**

* SM-2 (Spaced Repetition)

**Deployment:**

* Vercel (Frontend)
* Render (Backend)

---



## 🚀 Getting Started (Local Setup)

### 🔧 Backend

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload
```

---

### 🌐 Frontend

```bash
cd frontend
open index.html
```

---

## 📡 API Overview

### Core APIs

* `POST /process-text` → Explain / Summarize / Quiz
* `POST /upload-file` → Process uploaded files

### Flashcards & Decks

* `POST /create-deck` → Save flashcards as deck
* `GET /decks` → Get all decks
* `GET /review/{deck_id}` → Start review session
* `POST /review` → Submit answer (SM-2 logic applied)

---

## 🧠 How It Works

1. User uploads content (PDF / text / video)
2. FastAPI backend processes input
3. AI generates structured outputs (notes, quiz, flashcards)
4. Flashcards can be saved into decks
5. SM-2 algorithm schedules future reviews
6. User practices using spaced repetition

---

## ⚠️ Notes

* First request may be slow (free hosting cold start)
* Large files may take longer to process
* API keys are securely handled on backend

---

## 🔮 Future Improvements

* 📊 Advanced analytics & mastery tracking
* 👤 User authentication
* ☁️ Cloud database (PostgreSQL)
* 🎨 Improved UI/UX
* 📱 Mobile responsiveness

---

## 📜 License

MIT License

---

## ⭐ Support

If you found this useful, consider giving it a ⭐ on GitHub!

---
