# Chat With Yash — Backend

A small Flask API that powers the "Chat With Me" chatbot on the portfolio site.
It answers questions in Yash's voice — first person, friendly, and built only
from the real facts on his site (school, experience, projects, hobbies) — using
the [Anthropic API](https://docs.anthropic.com/).

## How it works

- **`app.py`** — a single-endpoint Flask app:
  - `GET /` — a simple status check so you can confirm the service is alive.
  - `POST /api/chat` — takes the full conversation so far as
    `{"messages": [{"role": "user"|"assistant", "content": "..."}]}`, validates
    it (non-empty list, at most 30 messages, each under 2000 characters), sends
    it to Claude (`claude-haiku-4-5-20251001`) alongside a system prompt built
    from Yash's real background, and returns `{"reply": "..."}`.
  - Rate limited to 15 requests per minute per IP (via `flask-limiter`), with a
    friendly JSON 429 if that's exceeded.
  - CORS is enabled only on `/api/chat`, restricted to
    `https://yashgupta0823.github.io`.
  - Anthropic API failures are caught and returned as a clean JSON error with a
    502 status instead of a raw traceback.

## Setup

1. **Create a virtual environment and install dependencies:**

   ```bash
   cd chatbot
   python3 -m venv venv
   source venv/bin/activate      # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Set your API key.** Copy `.env.example` to `.env` and fill in a real key,
   or just export it in your shell:

   ```bash
   export ANTHROPIC_API_KEY=your-key-here
   ```

   The app reads `ANTHROPIC_API_KEY` from the environment automatically — the
   key is never hardcoded anywhere in the code.

## Running it

```bash
python app.py
```

Then it's live at **http://127.0.0.1:5051**. Visiting `/` in a browser should
show a small JSON status message. The frontend in `chat-with-yash/` talks to
this server at `/api/chat`.

This runs Flask's built-in development server, which is fine for local use;
for a real deployment, run it behind `gunicorn` (already in
`requirements.txt`) instead.

## Files

```
chatbot/
├── app.py              # Flask app: /api/chat + / status route
├── requirements.txt
├── .env.example         # Placeholder — copy to .env and add your real key
├── .gitignore            # Excludes .env, venv/, __pycache__/
└── prompt_log.md        # Log of the prompt used with Claude to build this
```
