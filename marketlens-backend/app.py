"""MarketLens API: live Kalshi prediction-market data for the static frontend.

The frontend (marketlens/ on GitHub Pages) calls these JSON endpoints. Data comes
from Kalshi's public market-data API (services/kalshi_api.py); all numbers are
computed deterministically (services/analytics.py).

Local:   python app.py            -> http://127.0.0.1:5001  (5000 is taken by AirPlay on macOS)
Render:  gunicorn app:app
"""

import logging
import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from config import Config
from services import analytics, kalshi_api
from services.kalshi_api import KalshiError, MarketNotFound

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("marketlens")

app = Flask(__name__)
app.json.sort_keys = False
kalshi_api.warm_cache()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _iso(timestamp):
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _meta(fetched_at, stale):
    """Fields added to every data response so the client knows how fresh it is."""
    return {"source": "kalshi", "sample_data": False, "updated_at": _iso(fetched_at), "stale": stale}


def _int_arg(name, default, low, high):
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(low, min(high, value))


def _error(status, message):
    return jsonify({"error": message}), status


# ---------------------------------------------------------------------------
# CORS: only the GitHub Pages site and local dev servers may call the API
# ---------------------------------------------------------------------------

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin and origin in Config.ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Accept, Content-Type"
        response.headers["Vary"] = "Origin"
    return response


# ---------------------------------------------------------------------------
# Error handling: Kalshi problems become JSON errors, never crashes
# ---------------------------------------------------------------------------

@app.errorhandler(MarketNotFound)
def handle_not_found(_exc):
    return _error(404, "Market not found")


@app.errorhandler(KalshiError)
def handle_kalshi_error(exc):
    log.error("Kalshi error: %s", exc)
    return _error(502, "Live market data is temporarily unavailable. Please try again shortly.")


@app.errorhandler(HTTPException)
def handle_http_error(exc):
    return _error(exc.code, exc.name)


@app.errorhandler(Exception)
def handle_unexpected(exc):
    log.exception("Unhandled error: %s", exc)
    return _error(500, "Internal server error")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return jsonify({
        "service": "MarketLens API",
        "endpoints": [
            "/api/health",
            "/api/markets?limit=&category=&search=",
            "/api/markets/<ticker>",
            "/api/markets/<ticker>/history?range=1d|7d|30d|90d",
            "/api/markets/<ticker>/orderbook?depth=",
            "/api/movers?limit=",
        ],
    })


@app.get("/api/health")
def health():
    """Cheap by default (Render pings it). Add ?deep=1 to also check that Kalshi answers."""
    payload = {
        "status": "ok",
        "service": "marketlens-backend",
        "time": _iso(datetime.now(timezone.utc).timestamp()),
        "data_source": "kalshi",
    }
    cached_at = kalshi_api.cache.fetched_at("markets")
    payload["markets_cached_at"] = _iso(cached_at) if cached_at else None

    if request.args.get("deep"):
        try:
            payload["kalshi"] = "ok" if kalshi_api.check_exchange() else "exchange_inactive"
        except KalshiError as exc:
            log.warning("Health check could not reach Kalshi: %s", exc)
            payload["kalshi"] = "unreachable"
            payload["status"] = "degraded"
    return jsonify(payload)


@app.get("/api/markets")
def list_markets():
    markets, fetched_at, stale = kalshi_api.get_markets()

    category = request.args.get("category", "").strip().lower()
    search = request.args.get("search", "").strip().lower()[:100]
    limit = _int_arg("limit", 60, 1, Config.MAX_MARKETS)

    filtered = markets
    if category:
        filtered = [m for m in filtered if m["category"].lower() == category]
    if search:
        filtered = [
            m for m in filtered
            if search in m["title"].lower() or search in m["subtitle"].lower() or search in m["ticker"].lower()
        ]

    return jsonify({
        "markets": filtered[:limit],
        "count": min(len(filtered), limit),
        "total": len(filtered),
        "categories": sorted({m["category"] for m in markets}),
        "metrics": analytics.overview_metrics(filtered[:limit]),
        **_meta(fetched_at, stale),
    })


def _ticker_or_400(ticker):
    try:
        return kalshi_api.normalize_ticker(ticker), None
    except ValueError:
        return None, _error(400, "Invalid market ticker")


@app.get("/api/markets/<ticker>")
def market_detail(ticker):
    ticker, error = _ticker_or_400(ticker)
    if error:
        return error
    market, fetched_at, stale = kalshi_api.get_market(ticker)
    return jsonify({"market": market, **_meta(fetched_at, stale)})


@app.get("/api/markets/<ticker>/history")
def market_history(ticker):
    ticker, error = _ticker_or_400(ticker)
    if error:
        return error
    range_key = request.args.get("range", kalshi_api.DEFAULT_HISTORY_RANGE)
    if range_key not in kalshi_api.HISTORY_RANGES:
        return _error(400, f"range must be one of {', '.join(kalshi_api.HISTORY_RANGES)}")

    history, fetched_at, stale = kalshi_api.get_history(ticker, range_key)
    return jsonify({**history, "stats": analytics.history_stats(history["points"]), **_meta(fetched_at, stale)})


@app.get("/api/markets/<ticker>/orderbook")
def market_orderbook(ticker):
    ticker, error = _ticker_or_400(ticker)
    if error:
        return error
    depth = _int_arg("depth", 10, 1, 50)
    book, fetched_at, stale = kalshi_api.get_orderbook(ticker, depth)
    return jsonify({**book, **_meta(fetched_at, stale)})


@app.get("/api/movers")
def movers():
    """Biggest 24h movers, top volume, and (for the most active markets) volatility."""
    markets, fetched_at, stale = kalshi_api.get_markets()
    limit = _int_arg("limit", 5, 1, 20)

    # Volatility needs candlesticks. Rather than one request per market, sample the
    # 50 most active markets with a single batch request, cached for 5 minutes.
    sample = markets[:50]
    try:
        histories, _, _ = kalshi_api.cache.get_or_fetch(
            "movers:histories", Config.HISTORY_CACHE_SECONDS,
            lambda: kalshi_api.get_recent_histories([m["ticker"] for m in sample], hours=24),
        )
        volatile = analytics.most_volatile(sample, histories, limit)
    except KalshiError as exc:
        log.warning("Skipping volatility ranking: %s", exc)
        volatile = []

    return jsonify({
        "gainers": analytics.top_gainers(markets, limit),
        "losers": analytics.top_losers(markets, limit),
        "biggest": analytics.biggest_movers(markets, limit),
        "top_volume": analytics.top_volume(markets, limit),
        "most_volatile": volatile,
        **_meta(fetched_at, stale),
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
