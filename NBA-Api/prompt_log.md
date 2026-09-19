# Prompt Log — NBA Player Stats CLI

Log of the key prompts used with Claude to build this project, kept for
the assignment's process-transparency requirement.

## 2026-09-17

**Prompt 1 (initial spec):**
> Help me build a Python script for a school assignment that integrates
> the balldontlie API (NBA v1 endpoint). Requirements: (1) load the API
> key from a local `.env` via `python-dotenv`, never hardcoded, plus a
> `.gitignore` excluding `.env` and virtual environments; (2) an
> interactive CLI to search a player by name, select from results, and
> fetch season stats / recent game logs with rolling averages (points,
> assists, rebounds); (3) graceful error handling for network drops,
> invalid names, empty results, and the free tier's 5 req/min rate
> limit — no raw tracebacks; (4) a README explaining the API calls,
> modules used, data shapes, `.env` setup, and run instructions, plus
> this prompt log.

**What Claude did:**
- Scaffolded `NBA-Api/` with `api_client.py` (auth, client-side rate
  limiter, custom exceptions) and `nba_cli.py` (search → select →
  season averages / game logs → rolling averages).
- Added `.env`, `.env.example`, and a `.gitignore` scoped to this
  folder so the real key is never committed.
- **Discovered while testing against the live API:** the free-tier key
  can call `/players` but gets HTTP 401 on `/stats` and
  `/season_averages` — those require balldontlie's paid All-Star/GOAT
  tiers. Updated the error handling to explain this specific case
  clearly (instead of a generic "bad key" message) and documented the
  limitation at the top of the README, since it directly affects what
  the demo can show on a free key.
- Verified end-to-end with piped CLI input: a real player search, an
  invalid/empty search, and an invalid API key — confirmed no
  tracebacks are ever printed to the user in any of those cases.

## 2026-09-19

**Prompt 2:**
> Instead of the balldontlie API, integrate this API from GitHub
> instead: https://github.com/swar/nba_api. At the end give me the
> steps to run the code.

**What Claude did:**
- Researched `nba_api`'s source/docs directly (static player search,
  `PlayerCareerStats`, `PlayerGameLog`, and the `Endpoint` base class's
  `get_normalized_dict()`) to confirm exact signatures, season string
  format (`"YYYY-YY"`), and that the package needs **no API key** —
  it's a client library around the free `stats.nba.com` endpoints, not
  a hosted API with its own auth.
- Replaced `api_client.py` with `nba_client.py`: player search now runs
  fully offline against `nba_api`'s bundled player list; season
  averages and game logs hit `stats.nba.com` live, behind a small
  client-side throttle (this API has no published rate limit but is
  known to slow down/block bursts of traffic).
- Rewrote `nba_cli.py` against the new client; removed `.env`,
  `.env.example`, and `python-dotenv` from `requirements.txt` since
  there's no secret to manage anymore, and trimmed `.gitignore`
  accordingly.
- Tested live against the real `stats.nba.com` endpoints (Stephen
  Curry, 2023-24 season) end-to-end, plus the empty-search-result path
  — confirmed real data comes back correctly and no tracebacks leak to
  the user.

**Prompt 3:**
> Okay now can you make this a web based game situation. Same exact
> questions that are asked but on a web page with basketball themed.

**What Claude did:**
- Added `app.py`, a Flask server exposing the existing `NbaClient`
  logic (unchanged) over two JSON endpoints: `/api/search` and
  `/api/player/<id>/stats`. Every `ApiError`/`NetworkError` is caught
  and returned as a JSON error body with an appropriate status code
  instead of a Flask debug traceback page.
- Built `static/index.html`, `static/style.css`, and `static/script.js`
  — a single-page, basketball-themed frontend (hardwood-pattern
  background, scoreboard-style stat tiles, bouncing basketball) that
  asks the exact same three questions as the CLI: search a player,
  pick one from the results, pick a season — then renders season
  averages, the last 5 games, and rolling averages.
- Ran the Flask server locally and hit every endpoint with `curl`
  (search, stats, empty search, invalid season year) to confirm real
  data comes back and errors return clean JSON rather than crashing
  the server.

**Prompt 4:**
> 1) When I type in a name and it gives multiple options to pick from,
> the text of the names should be black so it shows on the screen.
> 2) I need to make this a game so after a player is picked and the
> stats are shown, a "Play Game" button should come up with
> instructions along the lines of "the goal is to find a player with
> better stats" — first select a stat of the first player by clicking
> on it, then enter a new name and repeat the same steps to find that
> player's stats, and finally compare the first and second player's
> chosen stat: if the 2nd player is higher they win, otherwise they
> lose and can restart.

**What Claude did:**
- Fixed the player-card text color bug: the result cards are `<button>`
  elements, and some browsers apply a UA default text color to buttons
  instead of inheriting the page's dark ink color. Added an explicit
  `color` on `.player-card` (and pinned the badge colors too) so names
  always render dark-on-light regardless of OS/browser button
  defaults.
- Built the "Stat Battle" game on top of the existing stats view:
  a "Play Game" button appears under a player's stats (only when
  season averages exist); clicking it shows instructions and makes the
  PTS/REB/AST season-average tiles clickable; picking one stores that
  player's value and routes back to the search step (now showing a
  persistent "beat X's Y of Z" banner) to find a challenger; after the
  second player's stats load, a result screen compares the same stat
  between both players and shows WIN/LOSE/TIE with a "Play Again"
  button that fully resets state.
- Verified with a scripted Playwright run against the live Flask app
  (no test framework available in this repo, so this was a real
  browser driving the actual page): confirmed player-card text renders
  in dark ink (`rgb(26, 21, 18)`), walked the full game path (Stephen
  Curry PTS 26.4 vs. LeBron James PTS 25.7 → correctly reports "YOU
  LOSE"), confirmed the challenge banner text and post-restart reset,
  and checked the browser console for errors (none). Screenshots
  confirmed the styling reads correctly on the hardwood theme.
