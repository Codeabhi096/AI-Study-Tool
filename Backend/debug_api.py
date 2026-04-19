"""
Run this from your backend/ folder:
  python debug_api.py
"""
import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "").strip()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"

print("=" * 50)
print(f"GEMINI key starts with: {GEMINI_API_KEY[:12]}..." if GEMINI_API_KEY else "GEMINI: NOT SET")
print(f"GROQ key starts with:   {GROQ_API_KEY[:12]}..."   if GROQ_API_KEY   else "GROQ: NOT SET")
print("=" * 50)

async def test_gemini():
    print("\n🔵 Testing Gemini...")
    payload = {
        "contents": [{"parts": [{"text": "Say hello in one word"}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 50}
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
            print(f"   Status: {resp.status_code}")
            data = resp.json()
            if resp.status_code == 200:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                print(f"   ✅ Gemini works! Response: {text}")
            else:
                print(f"   ❌ Gemini error: {data}")
    except Exception as e:
        print(f"   ❌ Exception: {type(e).__name__}: {e}")

async def test_groq():
    print("\n🟢 Testing Groq...")
    if not GROQ_API_KEY:
        print("   ⚠️  GROQ_API_KEY not set, skipping")
        return
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": "Say hello in one word"}],
        "max_tokens": 50
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(GROQ_URL, json=payload, headers=headers)
            print(f"   Status: {resp.status_code}")
            data = resp.json()
            if resp.status_code == 200:
                text = data["choices"][0]["message"]["content"]
                print(f"   ✅ Groq works! Response: {text}")
            else:
                print(f"   ❌ Groq error: {data}")
    except Exception as e:
        print(f"   ❌ Exception: {type(e).__name__}: {e}")

asyncio.run(test_gemini())
asyncio.run(test_groq())
print("\n" + "=" * 50)