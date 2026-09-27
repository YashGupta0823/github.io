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

**Follow-up prompt:**
> Switch the chatbot backend from the Anthropic SDK to the OpenAI SDK, and
> fix a silent-failure bug: when the API call fails, log the real exception
> server-side before returning the vague 502 to the client.

**What Claude did:**
- Swapped `anthropic.Anthropic()` for `openai.OpenAI()` (reads
  `OPENAI_API_KEY` from the environment automatically) and switched the
  Claude message-creation call for the equivalent OpenAI chat completions
  call, using `gpt-4o-mini` with the same system prompt and message history.
  Validation, rate limiting, and CORS were left untouched.
- Fixed a bug found while testing the previous version: an API failure (e.g.
  a missing/invalid key) was being swallowed by a bare `except Exception`
  with no logging, making it hard to tell why a request failed. Added
  `app.logger.exception("Chat API call failed")` before returning the
  generic 502, so the real cause now shows up in the server terminal while
  the client still only sees a vague, safe error message.
- Updated `requirements.txt`, `.env.example`, and `README.md` to reference
  OpenAI/`OPENAI_API_KEY` instead of Anthropic/`ANTHROPIC_API_KEY`, changed
  the run instruction to `python3 app.py`, and added a troubleshooting note
  about clearing a leftover process on port 5051 with `lsof`/`kill`.

**Follow-up prompt:**
> Switch the chatbot backend from the OpenAI SDK to Google's Gemini API,
> because the OpenAI account tied to that key had no usable credits
> (`insufficient_quota` / `credit_balance_exhausted`) and Gemini's free tier
> avoids that entirely — then verify it actually works end-to-end.

**What Claude did:**
- Swapped `openai.OpenAI()` for `google.genai.Client()` (reads
  `GEMINI_API_KEY` from the environment automatically), and rebuilt the API
  call around `client.models.generate_content(model=..., contents=...,
  config=...)`. The system prompt now goes through
  `types.GenerateContentConfig(system_instruction=..., max_output_tokens=...)`
  instead of being injected as a message, and incoming messages are converted
  to `types.Content(role=..., parts=[types.Part(text=...)])`, mapping
  `"assistant"` → `"model"` (Gemini's name for that role) and leaving `"user"`
  as-is — verified against the installed `google-genai` package's own
  `types.Content`/`types.Part` fields rather than assumed.
- Tried `gemini-2.5-flash` first as instructed; it's been retired for new
  users (`404 NOT_FOUND`, "no longer available to new users"). The API's own
  error pointed at `gemini-3.8-flash`, but that model returned a `503`
  (overloaded) on one live test and an empty response on another. Settled on
  `gemini-flash-latest` — the alias Google keeps pointed at its current
  recommended Flash model — after 3/3 live test calls came back with real
  text and a clean `STOP` finish reason.
- Kept `app.logger.exception("Chat API call failed")` before the generic 502,
  and left input validation, rate limiting, and CORS untouched.
- Updated `requirements.txt` (`google-genai` in place of `openai`),
  `.env.example` (`GEMINI_API_KEY`), and `README.md` (Gemini references, plus
  a note that its free tier needs no credit card).
- Verified live end-to-end: started the server, confirmed `GET /`, then sent
  a real message to `POST /api/chat` and got back an actual in-character
  reply from Gemini before committing.
