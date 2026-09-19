# NBA Player Stats — CLI + Web App

A tool that searches for NBA players using the
[`nba_api`](https://github.com/swar/nba_api) Python package, then
displays their season averages, recent game logs, and rolling averages
(points, rebounds, assists over their last few games). It ships two
front ends over the same logic:

- **`nba_cli.py`** — the original terminal version.
- **`app.py`** — a basketball-themed web app (Flask + vanilla JS)
  asking the exact same three questions (search a player → pick one →
  pick a season) through a browser instead of a terminal prompt.

`nba_api` is a client library around the official (but unofficial/
undocumented) `stats.nba.com` endpoints — the same data source that
powers NBA.com's own stats pages. **No API key or account is required.**

## How it works

- **`nba_client.py`** — an `NbaClient` class that wraps three things
  from `nba_api`:
  - `nba_api.stats.static.players` — player search. This is a **local,
    offline lookup** against a player list bundled with the package
    (no network call, so it never fails, is instant, and can't be rate
    limited).
  - `nba_api.stats.endpoints.playercareerstats.PlayerCareerStats` —
    season-by-season per-game averages.
  - `nba_api.stats.endpoints.playergamelog.PlayerGameLog` — individual
    game logs for a given season, used to compute rolling averages.
  - A small throttle (`_Throttle`) puts a minimum gap between live
    `stats.nba.com` calls, since this is an unofficial API with no
    published rate limit but a known tendency to slow down or briefly
    block traffic that comes in too fast.
  - `requests.exceptions.RequestException` and any other unexpected
    failure (timeouts, connection drops, an HTML error page instead of
    JSON) are caught and converted into `NetworkError`/`ApiError` with
    a plain-English message — the CLI never crashes with a traceback.
- **`nba_cli.py`** — the interactive terminal loop: search → pick a
  player from the results → choose a season → view season averages,
  the last 5 game logs, and rolling averages computed from them.
- **`app.py`** — a small Flask server exposing that same `NbaClient`
  over two JSON endpoints (`GET /api/search`, `GET
  /api/player/<id>/stats`), plus `static/index.html` /
  `static/style.css` / `static/script.js`, a basketball-themed
  single-page frontend that calls those endpoints and walks through the
  same three questions as the CLI.

### Modules used

| Module | Purpose |
|---|---|
| `nba_api.stats.static.players` | Offline player name search |
| `nba_api.stats.endpoints.playercareerstats` | Season-by-season averages |
| `nba_api.stats.endpoints.playergamelog` | Per-game logs for a season |
| `requests.exceptions` | Recognizing network failures from the underlying HTTP calls `nba_api` makes |
| `time` | Throttling between live requests |
| `datetime` | Parsing/sorting game dates; picking a sensible default season |
| `flask` | Serves the web app's HTML/JS and the two JSON API endpoints (web version only) |

### Data returned

`nba_api` endpoints return their own response object; calling
`.get_normalized_dict()` on it turns the response into plain Python
`dict`/`list` (no pandas needed), keyed by result-set name:

- `players.find_players_by_full_name(pattern)` → `list[dict]`, each
  like `{"id": 201939, "full_name": "Stephen Curry", "first_name": ...,
  "last_name": ..., "is_active": True}`.
- `PlayerCareerStats(...).get_normalized_dict()["SeasonTotalsRegularSeason"]`
  → `list[dict]`, one row per season, e.g. `{"SEASON_ID": "2023-24",
  "TEAM_ABBREVIATION": "GSW", "GP": 74, "PTS": 26.4, "REB": 4.5, "AST":
  5.1, "MIN": 32.7, ...}`.
- `PlayerGameLog(...).get_normalized_dict()["PlayerGameLog"]` →
  `list[dict]`, one row per game, e.g. `{"GAME_DATE": "Apr 12, 2024",
  "MATCHUP": "GSW vs. NOP", "PTS": 33, "REB": 4, "AST": 5, ...}`.

The CLI reads these dicts directly — no additional model classes were
needed for this assignment.

## Setup

1. **Create a virtual environment and install dependencies:**

   ```bash
   cd NBA-Api
   python3 -m venv venv
   source venv/bin/activate      # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

That's it — no `.env` file or API key is needed for this version, since
`nba_api` doesn't require authentication. (An earlier version of this
project used the balldontlie API, which does require a key; that
approach was dropped in favor of `nba_api`.)

## Running it

### CLI version

```bash
python nba_cli.py
```

Example session:

```
=== NBA Player Stats CLI (nba_api / stats.nba.com) ===

Search for a player by name (or 'q' to quit): Curry
Found 7 player(s):
  1. Dell Curry (Retired)
  ...
  6. Stephen Curry (Active)
  7. Carey Scurry (Retired)
Select a player [1-7] (or Enter to search again): 6

Selected: Stephen Curry
Season to look up (year the season started, e.g. 2023 for 2023-24) [default 2025]: 2023

2023-24 season averages (GSW, 74 games played):
  PTS: 26.4  REB: 4.5  AST: 5.1  MIN: 32.7

Last 5 game(s):
  DATE         MATCHUP     MIN  PTS  REB  AST
  Apr 12, 2024 GSW vs. NOP 32   33   4    5
  ...

Rolling averages (last 5 games):
  PTS: 27.0  REB: 6.0  AST: 6.4

Look up another player? [y/N]:
```

### Web app version

```bash
python app.py
```

Then open **http://127.0.0.1:5050** in your browser. Same three
questions as the CLI, as a basketball-themed page:

1. **Tip-Off** — type a name and search.
2. **Starting Lineup** — click a player card from the results, then
   enter a season start year.
3. **Box Score** — season averages, the last 5 games, and rolling
   averages, styled like a scoreboard.

This runs Flask's built-in development server, which is fine for local
use/grading but isn't meant for production/public hosting.

#### Stat Battle mini-game

Once a player's stats are shown, a **Play Game** button appears (if
season averages were found). The flow:

1. Click **Play Game** — instructions appear and the PTS/REB/AST
   season-average tiles become clickable.
2. Click one of those tiles to pick your challenge stat. A banner then
   shows what you're trying to beat (e.g. "beat Stephen Curry's PTS of
   26.4").
3. Search for and select a second player, and pick a season for them,
   same as steps 1–2 above.
4. A result screen compares that same stat between both players —
   **WIN** if player 2's value is higher, **LOSE** if lower, **TIE** if
   equal — with a **Play Again** button to reset and start over.

## Error handling

The CLI never surfaces a raw Python traceback. Instead:

- **No internet / connection drop / stats.nba.com timeout** → "Could
  not reach stats.nba.com... Please try again in a moment."
- **stats.nba.com returns something unexpected** (e.g. an HTML block
  page instead of JSON, which unofficial APIs occasionally do under
  heavy traffic) → a friendly retry message instead of a JSON-decode
  traceback.
- **Empty search results** → "No players found matching '...'. Try a
  different name."
- **No stats for the chosen season** (player didn't play that year,
  or typo'd a future season) → "No season averages found for ..."
- **Ctrl+C / Ctrl+D** → exits cleanly with "Goodbye!" instead of a
  `KeyboardInterrupt` trace.
- **Live requests are throttled** client-side (a small delay between
  calls) since `stats.nba.com` has no published rate limit but is
  known to slow down or block bursts of requests.

The web app applies the same handling server-side: every failure from
`NbaClient` is caught in `app.py` and returned as a JSON `{"error":
"..."}` body with a 4xx/5xx status instead of a Flask traceback page,
and the frontend (`script.js`) shows that message in a red error
banner instead of leaving the page stuck or throwing a console error.

## Files

```
NBA-Api/
├── nba_client.py      # nba_api wrapper: search, stats, throttling, error handling
├── nba_cli.py          # Interactive CLI (search, select, stats, rolling averages)
├── app.py              # Flask web app (same logic, JSON API for the frontend)
├── static/
│   ├── index.html       # Basketball-themed page structure
│   ├── style.css         # Hardwood/scoreboard styling
│   └── script.js          # Fetches the API and renders each step
├── requirements.txt
├── .gitignore
├── README.md
└── prompt_log.md      # Log of key prompts used while building this with Claude
```
