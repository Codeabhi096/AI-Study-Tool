# ⚡ AI Study Tool

AI-powered study assistant that converts content into **explanations, summaries, quizzes, and flashcards with spaced repetition (SM-2)**.

---

## 🌐 Live Demo

- App: https://ai-study-tool-wyrb.vercel.app/  
- Portfolio: https://mrabhi-7208.netlify.app/

---

## ✨ Features

- 📝 Text input (notes, articles, code)  
- 📁 File upload (PDF, TXT, CSV, JSON)  
- 🔍 Explanation (simple, structured)  
- 📋 Summary generation  
- 🧪 Quiz generation (MCQs)  
- 🃏 Flashcard generation  
- 💾 Save flashcards as decks  
- 🔁 Review with spaced repetition (SM-2)  

---

## 📸 Screenshots

### Home
![Home](Screenshots/AI_Study_Tool3.png)

### Input
![Upload](Screenshots/AI_Study_Tool1.png)

### Output / Flashcards
![Output](Screenshots/AI_Study_Tool2.png)

---

## 🧱 Tech Stack

- Frontend: HTML, CSS, JavaScript  
- Backend: FastAPI (Python)  
- Database: SQLite  
- AI APIs: Gemini, Groq  
- Deployment: Vercel (Frontend), Render (Backend)  

---

## 🚀 Local Setup

### Backend

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload