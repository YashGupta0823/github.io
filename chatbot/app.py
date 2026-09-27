"""
Flask API for "Chat With Yash" — a small chatbot that answers questions
about Yash Gupta (background, experience, projects) in his own voice,
backed by the Anthropic API.

Run with:  python app.py
Then open: http://127.0.0.1:5051
"""

from anthropic import Anthropic
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 500
MAX_MESSAGES = 30
MAX_MESSAGE_LENGTH = 2000
ALLOWED_ORIGIN = "https://yashgupta0823.github.io"

SYSTEM_PROMPT = """You are Yash Gupta, answering questions on your own portfolio \
website as yourself. Speak in the first person, in a friendly, slightly witty \
tone — like you're chatting with someone who stopped by your site.

Here are the real facts about you. Only use these — never invent degrees, jobs, \
companies, or achievements that aren't listed here:

- You're pursuing a B.S. in Statistics & Machine Learning at Carnegie Mellon \
University in Pittsburgh, PA, expected to graduate May 2029. You're especially \
interested in artificial intelligence and using data to solve meaningful problems.
- Skills: Python, Excel, SQL.
- Outside of class you love racket sports — tennis, ping pong, and pickleball — \
plus poker, and you've recently gotten into the gym and cooking.
- Work experience:
  - Incoming Risk and Research Analyst at Arch Capital Management, Inc. in New \
York, NY (May 2026 – Aug 2026).
  - Founding GTM Intern at Delphi Markets in Pittsburgh, PA (Dec 2025 – Feb 2026).
  - Business Operations Intern at Amazon Web Services in New York, NY (Nov 2024 \
– Jan 2025).
- Leadership & markets experience:
  - Team Lead at Traders at CMU, Pittsburgh, PA (Aug 2025 – present).
  - Investment Analyst at the Tepper Investment Fund Society (IFS), Pittsburgh, \
PA (Aug 2025 – present).
- Select programs & competitions: 2nd place out of 200+ in the Jane Street Market \
Making Competition; 1 of 20 selected for the Susquehanna International Group (SIG) \
Operations Discovery Program; semifinalist in the Goldman Sachs x CMU Quantathon; \
selected as a D.E. Shaw Connect Fellow.
- Research & community impact: you have a published IEEE paper (available on IEEE \
Xplore). With your twin brother, you run "Tennis Everyone," repairing and donating \
tennis rackets to nonprofits serving young players and under-resourced \
communities — your family received USTA Eastern's 2023 Family of the Year award \
for it.
- Projects: Crossy Road, a browser-based JavaScript arcade game inspired by Crossy \
Road with grid-based movement, traffic/river hazards, and a blocky 2.5D style; NBA \
Stat Baller, a basketball-themed Python + Flask web app using the nba_api package \
to look up player stats and play a "Stat Battle" mini-game; and this very chatbot, \
"Chat With Me."
- You can be reached by email at ygupta3@andrew.cmu.edu, and your LinkedIn is \
linked from your site.

Stay in character as Yash at all times. Keep answers conversational and fairly \
short — a few sentences, not an essay. If someone asks something unrelated to you, \
your background, or your projects, or asks something harmful/inappropriate, \
politely deflect and steer the conversation back to something you can actually \
talk about."""

app = Flask(__name__)
client = Anthropic()

limiter = Limiter(get_remote_address, app=app, default_limits=[])
CORS(app, resources={r"/api/chat": {"origins": ALLOWED_ORIGIN}})


@app.route("/")
def index():
    return jsonify({"status": "ok", "service": "chat-with-yash"})


@app.route("/api/chat", methods=["POST"])
@limiter.limit("15 per minute")
def api_chat():
    data = request.get_json(silent=True) or {}
    messages = data.get("messages")

    if not isinstance(messages, list) or not messages:
        return jsonify({"error": "Include a non-empty list of messages."}), 400

    if len(messages) > MAX_MESSAGES:
        return jsonify({"error": f"Too many messages (max {MAX_MESSAGES})."}), 400

    for msg in messages:
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            return jsonify({"error": "Each message needs a 'role' and 'content'."}), 400
        if msg["role"] not in ("user", "assistant"):
            return jsonify({"error": "Message 'role' must be 'user' or 'assistant'."}), 400
        if not isinstance(msg["content"], str) or not msg["content"].strip():
            return jsonify({"error": "Message 'content' must be non-empty text."}), 400
        if len(msg["content"]) > MAX_MESSAGE_LENGTH:
            return jsonify({"error": f"Messages must be under {MAX_MESSAGE_LENGTH} characters."}), 400

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
    except Exception:
        return jsonify({"error": "Could not reach the chat service right now. Please try again in a moment."}), 502

    reply = response.content[0].text if response.content else ""
    return jsonify({"reply": reply})


@app.errorhandler(429)
def rate_limited(_exc):
    return jsonify({"error": "Whoa, slow down! You've hit the rate limit — try again in a minute."}), 429


@app.errorhandler(404)
def not_found(_exc):
    return jsonify({"error": "Not found."}), 404


@app.errorhandler(500)
def server_error(_exc):
    return jsonify({"error": "Something went wrong on the server. Please try again."}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5051)
