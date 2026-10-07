"""Application configuration, read from environment variables.

Locally, values can live in a .env file (see .env.example). On Render, set them
in the service's Environment tab. Kalshi's market-data endpoints are public and need
no key. The only secret, GEMINI_API_KEY, is read by services/ai_service.py at call
time and is never stored here.
"""

import os

try:  # python-dotenv is a local-development convenience; Render sets real env vars.
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def _csv(name, default):
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


# Kalshi series MarketLens tracks. Kalshi lists 100k+ open markets (most are
# single-game sports or 15-minute crypto contracts), and the public API cannot sort
# by volume, so scanning everything takes ~60 requests and about a minute. Instead we
# follow a curated set of long-running, widely followed series across categories and
# rank their markets by 24h volume. Override with KALSHI_SERIES="A,B,C".
DEFAULT_SERIES = ",".join([
    # Elections & politics
    "CONTROLH", "CONTROLS", "KXBALANCEPOWERCOMBO", "SENATETX", "SENATEMI", "SENATENE",
    "SENATEME", "SENATEGA", "SENATENC", "KXGOVCA", "KXMAYORLA", "GOVPARTYNY",
    "KXPRESNOMD", "KXPRESNOMR", "KXPRESPERSON", "KXNOBELPEACE", "KXAPRPOTUS",
    # Economics
    "KXFEDDECISION", "KXFED", "KXRATECUTCOUNT", "KXCPI", "KXCPIYOY", "KXRECSSNBER",
    "KXGDP", "KXU3", "KXPAYROLLS",
    # Crypto
    "KXBTC2026200", "KXBTC50VS100", "KXBTCMAXY", "KXETHMAXY", "KXBTCY",
    # Sports championships (futures, not single games)
    "KXMLB", "KXMLBNL", "KXMLBAL", "KXSB", "KXNBA", "KXNHL", "KXWC",
    # Tech, entertainment, climate
    "KXAGICO", "KXOAIANTH", "KXRT", "KXHURCTOT",
])


class Config:
    # Comma-separated browser origins allowed to call /api/*. No wildcard: only the
    # GitHub Pages site and local development servers.
    ALLOWED_ORIGINS = _csv(
        "ALLOWED_ORIGINS",
        "https://yashgupta0823.github.io,http://localhost:8000,http://127.0.0.1:8000",
    )

    KALSHI_API_BASE = os.getenv("KALSHI_API_BASE", "https://external-api.kalshi.com/trade-api/v2").rstrip("/")
    KALSHI_TIMEOUT_SECONDS = float(os.getenv("KALSHI_TIMEOUT_SECONDS", "6"))
    KALSHI_SERIES = _csv("KALSHI_SERIES", DEFAULT_SERIES)

    # How long fetched data is reused before asking Kalshi again.
    MARKETS_CACHE_SECONDS = int(os.getenv("MARKETS_CACHE_SECONDS", "60"))
    HISTORY_CACHE_SECONDS = int(os.getenv("HISTORY_CACHE_SECONDS", "300"))

    # Size of the market universe: at most this many outcomes per event (so one
    # 30-team championship can't fill the dashboard), and this many markets total.
    MAX_MARKETS_PER_EVENT = int(os.getenv("MAX_MARKETS_PER_EVENT", "3"))
    MAX_MARKETS = int(os.getenv("MAX_MARKETS", "150"))
