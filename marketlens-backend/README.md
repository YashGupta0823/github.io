# MarketLens API

Flask backend for [MarketLens](../marketlens/). It serves live prediction-market data from
[Kalshi's public market-data API](https://docs.kalshi.com) to the static frontend on GitHub Pages.
It is read-only: no trading, no Kalshi login, no API keys.

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/health` | Service status (add `?deep=1` to also check that Kalshi answers) |
| `GET /api/markets?limit=&category=&search=` | Active markets, normalized, most active first |
| `GET /api/markets/<ticker>` | One market with quotes, open interest, rules, and dates |
| `GET /api/markets/<ticker>/history?range=1d\|7d\|30d\|90d` | Real probability history from Kalshi candlesticks, plus change/high/low/volatility |
| `GET /api/markets/<ticker>/orderbook?depth=` | Top of the order book in YES terms |
| `GET /api/movers?limit=` | Biggest gainers, losers, absolute movers, 24h volume leaders, most volatile |

## How the numbers are computed

- **Probability**: the midpoint of the best YES bid and ask when both exist and the spread is at
  most 15¢. Otherwise the last traded price. A wide-spread midpoint is the last resort. See the
  docstring in `services/kalshi_api.py`.
- **24h change**: the same rule applied to Kalshi's `previous_*` fields (the prices 24 hours ago),
  so it needs no extra requests.
- **History**: the same rule applied to each hourly (or daily, for 90d) candlestick close.
- **Volatility**: standard deviation of period-to-period probability changes
  (`services/analytics.py`). For the movers list, this is computed for the 50 most active markets
  using a single batch candlestick request.

All analytics are plain arithmetic. No AI is involved.

## Which markets

Kalshi lists 100k+ open markets, most of them single games or 15-minute crypto contracts, and its
public API can't sort by volume. MarketLens follows a curated list of long-running series
(elections, Fed, CPI, Bitcoin, championships, and so on) in `config.py`, keeps the top 3 outcomes
per event, and ranks them by 24h volume. Override the list with `KALSHI_SERIES`.

Kalshi allows roughly 5 public requests per second, so loading every series takes about 9 seconds.
The result is cached in memory and refreshed in the background (stale-while-revalidate), and it is
preloaded when the app starts, so visitors rarely wait. If Kalshi goes down, the API serves the
last good data marked `"stale": true`, or returns a JSON 502 when nothing is cached. The frontend
then falls back to its sample data.

## Run locally

```bash
cd marketlens-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # optional
python app.py           # http://127.0.0.1:5001
```

Then serve the frontend from the repo root with `python3 -m http.server 8000 --directory marketlens`
and open http://localhost:8000. When the page runs on localhost, it calls the local API automatically.

## Deploy on Render

Create a Web Service with Root Directory `marketlens-backend`, Build Command
`pip install -r requirements.txt`, and Start Command `gunicorn app:app`. Then paste the service URL
into `PRODUCTION_API_URL` in `marketlens/js/api.js`.
