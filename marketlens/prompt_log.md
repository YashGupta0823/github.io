Project Overview

MarketLens is a prediction market analytics dashboard that uses live Kalshi data to visualize market implied probabilities, 24 hour price movement, trading volume, historical pricing, and order book information. It also includes a Gemini powered Market Brief that explains already calculated market statistics in natural language.

I used ChatGPT mainly for
- brainstorming the original project idea
- deciding on the overall architecture
- understanding frontend vs. backend responsibilities
- planning GitHub Pages and Render deployment
- debugging deployment configuration
- deciding how the AI feature should work
- planning documentation and final submission

I used Claude Code mainly for:
- creating and modifying project files
- implementing frontend and backend features
- API integration
- debugging
- testing
- Git operations
- deployment fixes
  
Gemini
Gemini is used inside the finished application to generate short Market Briefs from structured market data. Gemini does not calculate probabilities or analytics as the backend calculates those values first.




Help me define a realistic MVP for my prediction market idea that can be completed and looks polished and portfolio ready.

Result:

The initial MVP became:

- prediction-market dashboard
- market cards
- biggest movers
- interactive market visualization
- market detail pages
- historical charts
- eventual AI Market Brief


Build a polished full-stack application called MarketLens. Use Flask, HTML, CSS, JavaScript, and Chart.js. Start with placeholder prediction-market data. Prioritize clean architecture, understandable code, and a professional trading dashboard design. Do not over engineer it.


Claude created the initial project structure, Flask app, sample data, dashboard, templates, CSS, JavaScript, analytics helpers, and README scaffolding.



Improve the dashboard so it looks like a professional institutional trading tool rather than a generic school project. Keep the dark theme, improve spacing, cards, metrics, and chart presentation, but do not make it flashy or crypto-themed.


Claude refined the dashboard design, metric cards, typography, visual hierarchy, and chart styling.



My portfolio is already hosted on GitHub Pages. Convert MarketLens so the frontend can run statically inside my existing portfolio repository. Remove Flask-specific template paths, keep the backend separate, and preserve the existing design.


Claude:
- converted Jinja-rendered sections to JavaScript
- replaced `url_for()` paths
- created static HTML pages
- moved frontend data access into `api.js`
- kept mock data as a fallback


Add the static MarketLens frontend inside my existing `github.io` portfolio repository under `marketlens/`. Update the Projects page with a MarketLens card and make sure no existing portfolio files are overwritten.

Claude copied the frontend into the portfolio repo and created a new project card.



Replace the sample-only backend with a real Flask backend using Kalshi's public API. Add endpoints for active markets, market details, history, order book, movers, and health. Normalize the responses so the existing frontend still works.

Claude created a production backend with:

- `/api/health`
- `/api/markets`
- `/api/markets/<ticker>`
- `/api/markets/<ticker>/history`
- `/api/markets/<ticker>/orderbook`
- `/api/movers`

It also added Kalshi normalization, analytics, caching, timeouts, CORS, and error handling.


For each Kalshi market, calculate a sensible market-implied probability. Prefer the midpoint of the YES bid and ask when the spread is reasonable, otherwise fall back to the latest traded price. Document the logic.


Claude implemented probability calculation using:

1. midpoint of YES bid/ask when the spread is sufficiently tight
2. last trade when necessary
3. a wider-spread fallback only as a last resort



Kalshi has too many markets to scan on every page load. Make the backend fast enough for production without throwing away useful markets.

Result:
Claude narrowed the data pull to a curated group of long-running series and added caching and background refresh behavior.


Make the Market Map the main interactive visualization. X-axis should be current implied probability, Y-axis should be 24-hour probability change, and bubble size should represent volume. Add useful hover information and click behavior.


Claude implemented:

- bubble sizing by volume
- probability on the x-axis
- 24-hour movement on the y-axis
- hover tooltips
- click-to-select behavior
- a selected-market summary


When a user opens a market, create a detailed page with current probability, 24-hour movement, total volume, 24-hour volume, open interest, historical pricing, order book information, and resolution rules.

Claude created the market detail page and connected it to live Kalshi endpoints.


Use Kalshi's actual candlestick data for market history instead of generating fake history. Support useful time ranges and interactive hover behavior.

Claude added real historical probability charts with:

- 1-day
- 7-day
- 30-day
- 90-day views
- hourly/daily candle data
- hover tooltips
- timestamps
- volume context

Prepare the Flask backend for Render. Add Gunicorn support, requirements, Python version configuration, CORS settings, a health endpoint, and tell me the exact Render deployment settings.

Claude prepared the backend for Render with:

- Gunicorn
- `requirements.txt`
- `.python-version`
- health checks
- production CORS configuration



The Render backend is live. Update the production frontend so it calls the Render API, keeps the mock fallback, and verifies that the live GitHub Pages site receives real Kalshi data.

Claude set the production backend URL in `api.js` and verified that the frontend was using Render instead of mock data.



Render's free tier can take a while to wake up. Improve the frontend so it doesn't immediately fall back to demo data while the server is starting. Add a useful loading message and only fall back after a longer timeout.

Claude added:

- longer production timeout
- `Connecting to live markets…`
- a second message explaining that the server may be waking up
- `Live Kalshi data`
- `Demo data`
- last-updated timestamps



`/api/health` works, but every Kalshi-backed endpoint hangs after the newest Render deploy. This did not happen locally. Diagnose the production only issue.


Claude identified a problem involving Gunicorn preload behavior and a cache warm-up thread.



When I select a Market Map bubble, the summary panel changes the chart size and moves the bubbles, so clicking again misses the selected market. Fix this without redesigning the page.

Claude gave the chart a stable height so its coordinates no longer shifted after selection.



Remove the Watchlist feature, remove search, and remove the category filter chips. I want the dashboard focused on the Market Map, Biggest Movers, and live market cards.

Claude removed:
- Watchlist navigation
- Watchlist buttons
- Watchlist page
- search bar
- keyboard search shortcut
- query-string search handling
- category chips
- related frontend state


I want an AI Market Brief, but I do not want the LLM doing numerical calculations. Design the feature so Python calculates everything first and AI only explains the results.

The AI architecture became:
1. Flask gets market data
2. Python calculates statistics
3. backend creates structured facts
4. Gemini receives those facts
5. Gemini writes a short explanation



Add a Gemini Market Brief to each market detail page. Create `POST /api/markets/<ticker>/brief`. Calculate all metrics in Python before the request. Gemini should only interpret the structured values, should not invent causes, and should not provide financial advice.

Claude implemented:
- Gemini REST integration
- `GEMINI_API_KEY`
- `/brief` endpoint
- structured facts
- short 3–5 sentence response
- loading state
- error state
- retry behavior
- Generate/Regenerate button

Build a deterministic `brief_facts` layer. Include current probability, bid/ask spread, 24-hour change, 7-day change, high, low, trend, volatility, volume, open interest, ranking, close date, and resolution rules. If data is unavailable, leave it out instead of asking Gemini to infer it.

Claude created a structured analytics layer that prepares all quantitative values before calling Gemini.



Test the Market Brief with no Gemini key, with a failed Gemini request, and with a valid response. The rest of MarketLens must continue working even if Gemini is unavailable.


Claude verified:
- missing key to clean 503
- malformed Gemini result to clean error
- frontend shows inline failure
- retry is possible
- no browser alert
- market page still works

Prevent someone from repeatedly clicking Generate Market Brief and draining the Gemini limit. Add a simple rate limit without changing the rest of the app.

Claude added limits for AI brief requests per visitor and globally.



Test the deployed MarketLens application end-to-end. Verify live Kalshi data, Market Map interaction, Biggest Movers, market detail pages, historical charts, order books, Gemini Market Briefs, fallback behavior, CORS, Render cold starts, and mobile layout.

Claude verified the main production flows and confirmed that the GitHub Pages frontend was successfully communicating with the Render backend.


One place Calude Code got it wrong was integrating the Kalshi API. I had to manually go in and provide documentation and API links in order to configure it.

Meaningful Changes I Personally Made

AI generated or assisted with a significant amount of code, but I made the following project decisions and changes myself:

- chose prediction markets as the project topic
- narrowed the MVP
- decided to use GitHub Pages for the frontend and Render for the backend
- configured the Render service manually
- diagnosed the initial Render root-directory problem
- reviewed production logs when the backend failed
- chose to emphasize the Market Map as the primary visualization
- configured the frontend production API URL
- configured the Gemini environment variable
- tested the deployed site manually
- tested real market pages
- tested Gemini Market Brief generation
- reviewed API responses directly in the browser
- iterated on the application based on actual deployment behavior
- helped diagnose the Gunicorn production bug
- made design and scope decisions instead of keeping every generated feature
