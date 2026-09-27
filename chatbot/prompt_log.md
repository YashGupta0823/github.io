# Prompt Log — Chat With Yash (Backend)

Log of the key prompt used with Claude Code to scaffold this project, kept
for process-transparency, matching the other projects in this portfolio.

## 2026-09-27

**Prompt:**
> Read index.html, experience.html, research.html, and projects.html to learn
> my real background, then build a chatbot feature: a Flask backend
> (`chatbot/`) with a single `/api/chat` endpoint that validates the request,
> calls the Anthropic API with a system prompt built entirely from real facts
> on the site so it answers as me in first person, adds rate limiting and
> CORS restricted to my GitHub Pages origin, and a matching `/api/chat`-only
> frontend (`chat-with-yash/`) styled to match the rest of the site — plus a
> new project card on `projects.html` linking to it.

**What Claude did:**
- Read `index.html`, `experience.html`, `research.html`, and `projects.html`
  to pull real, verifiable facts (CMU Statistics & Machine Learning major,
  work history, competitions, research, hobbies, projects) and used only
  those to write the system prompt — no invented facts.
- Scaffolded `chatbot/app.py` modeled on `NBA-Api/app.py`'s style: same
  JSON error-body pattern on failure, a `/` status route, and every
  Anthropic API call wrapped in `try`/`except` returning a clean 502 instead
  of a raw traceback.
- Added request validation (non-empty list, ≤30 messages, ≤2000 characters
  per message), `flask-limiter` capped at 15 requests/minute/IP with a
  friendly 429, and `flask-cors` scoped only to `/api/chat` and restricted to
  `https://yashgupta0823.github.io`.
- Built `chat-with-yash/` (`index.html`, `style.css`, `script.js`) as a
  simple chat UI reusing `pages.css`'s color variables and fonts so it feels
  like part of the same site, running against a configurable `API_BASE`
  (`http://127.0.0.1:5051` for local dev).
- Added a `.env.example` with a placeholder key only, a `.gitignore`
  excluding `.env`/`venv`/`__pycache__`, and a README explaining local setup
  — no real API key was ever written to any file.
- Added a new "Chat With Me" project card to `projects.html` (numbered `03`,
  matching the existing card markup) and renumbered the "More to Come"
  placeholder card to `04`.
