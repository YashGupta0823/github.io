"""Kalshi market-data provider.

Everything that knows about Kalshi lives in this module: HTTP calls, caching, and
turning Kalshi's response format into MarketLens's normalized market shape. Routes
and analytics only ever see normalized dicts, so the provider could be swapped
without touching them.

Only Kalshi's public, unauthenticated market-data endpoints are used. MarketLens
never places orders.

Market-implied probability
--------------------------
A Kalshi YES contract pays $1 if the event happens, so its price in dollars reads
directly as a probability. We derive one number per market (see
`implied_probability`):

1. Midpoint of the best YES bid and best YES ask, when both exist and the spread is
   at most MAX_MIDPOINT_SPREAD. This is the market's current consensus and doesn't
   jump around when a single small trade prints.
2. Otherwise the last traded price. On illiquid markets the quotes can be very far
   apart (e.g. 2¢ bid / 60¢ ask), and their midpoint means little.
3. Otherwise, a wide-spread midpoint as a last resort.
4. No quotes and no trades: no probability; the market is left out of lists.

24h change applies the same rule to Kalshi's `previous_*` fields (the bid, ask, and
last price 24 hours ago), so it costs no extra requests. Historical charts apply
it to each candlestick's closing bid, ask, and trade price.

Volume and open interest are in contracts. Each contract has $1 notional, so the
numbers double as dollar notional, which is how Kalshi itself displays them.
"""

import logging
import re
import threading
import time
from datetime import datetime, timezone

import requests

from config import Config

log = logging.getLogger(__name__)

MAX_MIDPOINT_SPREAD = 0.15

# range key -> (lookback in seconds, candle size in minutes). Kalshi supports 1, 60, 1440.
HISTORY_RANGES = {
    "1d": (1 * 86400, 60),
    "7d": (7 * 86400, 60),
    "30d": (30 * 86400, 60),
    "90d": (90 * 86400, 1440),
}
DEFAULT_HISTORY_RANGE = "7d"

TICKER_PATTERN = re.compile(r"^[A-Z0-9._-]{1,120}$")


class KalshiError(Exception):
    """Kalshi was unreachable or returned an unusable response."""


class MarketNotFound(KalshiError):
    """Kalshi has no market with this ticker."""


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------

class KalshiClient:
    """Thin wrapper around Kalshi's public REST API with timeouts and retries.

    Kalshi rate-limits public reads to roughly 5 requests/second (measured: 0.2s
    spacing never got throttled, 0.15s did), so requests are spaced at least
    MIN_INTERVAL_SECONDS apart, and 429 / 5xx / network errors are retried with
    exponential backoff before giving up. Timeouts are not retried: if Kalshi is
    slow, retrying only makes the user wait longer.
    """

    MAX_ATTEMPTS = 4
    MIN_INTERVAL_SECONDS = 0.22
    # Consecutive series failures before the market-list fetch gives up on Kalshi.
    CIRCUIT_BREAKER_FAILURES = 3

    def __init__(self, base_url, timeout):
        self.base_url = base_url
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json", "User-Agent": "MarketLens/1.0"})
        self._pace_lock = threading.Lock()
        self._last_request_at = 0.0

    def _pace(self):
        with self._pace_lock:
            wait = self._last_request_at + self.MIN_INTERVAL_SECONDS - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last_request_at = time.monotonic()

    def get(self, path, params=None):
        url = f"{self.base_url}{path}"
        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            self._pace()
            try:
                response = self.session.get(url, params=params, timeout=self.timeout)
            except requests.Timeout as exc:
                raise KalshiError(f"Kalshi timed out after {self.timeout}s: {path}") from exc
            except requests.RequestException as exc:
                problem = f"network error: {exc}"
            else:
                if response.status_code == 404:
                    raise MarketNotFound(path)
                if response.ok:
                    try:
                        return response.json()
                    except ValueError as exc:
                        raise KalshiError(f"Kalshi returned invalid JSON for {path}") from exc
                if response.status_code != 429 and response.status_code < 500:
                    raise KalshiError(f"Kalshi returned HTTP {response.status_code} for {path}")
                problem = f"HTTP {response.status_code}"

            if attempt < self.MAX_ATTEMPTS:
                delay = 0.5 * 2 ** (attempt - 1)
                log.warning("Kalshi %s (%s), retrying in %.1fs", path, problem, delay)
                time.sleep(delay)

        raise KalshiError(f"Kalshi request failed after {self.MAX_ATTEMPTS} attempts: {path} ({problem})")

    # Endpoints ------------------------------------------------------------

    def open_events(self, series_ticker):
        data = self.get("/events", {
            "series_ticker": series_ticker,
            "status": "open",
            "with_nested_markets": "true",
            "limit": 200,
        })
        return data.get("events") or []

    def market(self, ticker):
        return self.get(f"/markets/{ticker}")["market"]

    def event(self, event_ticker):
        return self.get(f"/events/{event_ticker}")["event"]

    def candlesticks(self, tickers, start_ts, end_ts, period_minutes):
        """Candles for up to 100 markets in one request: {ticker: [candle, ...]}."""
        data = self.get("/markets/candlesticks", {
            "market_tickers": ",".join(tickers),
            "start_ts": start_ts,
            "end_ts": end_ts,
            "period_interval": period_minutes,
        })
        return {m["market_ticker"]: m.get("candlesticks") or [] for m in data.get("markets") or []}

    def orderbook(self, ticker, depth):
        return self.get(f"/markets/{ticker}/orderbook", {"depth": depth})

    def exchange_status(self):
        return self.get("/exchange/status")


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

class TTLCache:
    """Small in-memory cache that keeps expired entries.

    - Fresh entry: returned immediately.
    - Expired entry with background=True: returned immediately while one background
      thread refreshes it (stale-while-revalidate), so users never wait on Kalshi.
    - Otherwise fetched now. If Kalshi fails and an old copy exists, the old copy is
      served and flagged stale instead of failing the request.

    A per-key lock makes concurrent requests for the same missing key share one fetch,
    and a fetch that just failed isn't retried for FAILURE_COOLDOWN_SECONDS, so an
    outage gets fast errors instead of a pile-up of slow requests.
    """

    FAILURE_COOLDOWN_SECONDS = 15

    def __init__(self):
        self._entries = {}
        self._failures = {}  # key -> (time, exception) of the most recent failed fetch
        self._key_locks = {}
        self._lock = threading.Lock()

    def _key_lock(self, key):
        with self._lock:
            return self._key_locks.setdefault(key, threading.Lock())

    def _fresh(self, entry, ttl_seconds):
        return entry is not None and time.time() - entry[1] < ttl_seconds

    def _store(self, key, value):
        self._failures.pop(key, None)
        self._entries[key] = (value, time.time())
        return self._entries[key]

    def _recent_failure(self, key):
        failure = self._failures.get(key)
        if failure and time.time() - failure[0] < self.FAILURE_COOLDOWN_SECONDS:
            return failure[1]
        return None

    def get_or_fetch(self, key, ttl_seconds, fetch, background=False):
        """Return (value, fetched_at, is_stale). Raises KalshiError only if nothing is cached."""
        entry = self._entries.get(key)
        if self._fresh(entry, ttl_seconds):
            return entry[0], entry[1], False

        lock = self._key_lock(key)
        if entry and background:
            if lock.acquire(blocking=False):  # skip if a refresh is already running
                threading.Thread(target=self._refresh, args=(key, fetch, lock), daemon=True).start()
            # Only call it stale once refreshes have been failing for a while.
            return entry[0], entry[1], time.time() - entry[1] > 2 * ttl_seconds

        with lock:
            entry = self._entries.get(key)  # another request may have just fetched it
            if self._fresh(entry, ttl_seconds):
                return entry[0], entry[1], False
            error = self._recent_failure(key)
            if error is None:
                try:
                    value, fetched_at = self._store(key, fetch())
                    return value, fetched_at, False
                except MarketNotFound:
                    raise
                except KalshiError as exc:
                    self._failures[key] = (time.time(), exc)
                    error = exc
            if entry:
                log.warning("Serving stale data for %s: %s", key, error)
                return entry[0], entry[1], True
            raise error

    def _refresh(self, key, fetch, lock):
        try:
            self._store(key, fetch())
        except Exception as exc:  # a failed background refresh just keeps the old copy
            self._failures[key] = (time.time(), exc)
            log.warning("Background refresh of %s failed: %s", key, exc)
        finally:
            lock.release()

    def fetched_at(self, key):
        entry = self._entries.get(key)
        return entry[1] if entry else None


client = KalshiClient(Config.KALSHI_API_BASE, Config.KALSHI_TIMEOUT_SECONDS)
cache = TTLCache()


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def _number(value):
    """Kalshi sends prices/sizes as strings like "0.4200"; empty or missing -> None."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def implied_probability(yes_bid, yes_ask, last_price):
    """Return (probability, method) using the rule in the module docstring."""
    has_bid = yes_bid is not None and yes_bid > 0
    has_ask = yes_ask is not None and 0 < yes_ask < 1  # an ask of $1.00 means nobody is selling
    has_last = last_price is not None and last_price > 0

    if has_bid and has_ask and yes_ask - yes_bid <= MAX_MIDPOINT_SPREAD:
        return (yes_bid + yes_ask) / 2, "midpoint"
    if has_last:
        return last_price, "last_trade"
    if has_bid and has_ask:
        return (yes_bid + yes_ask) / 2, "wide_midpoint"
    return None, None


def _clean(text):
    return re.sub(r"\s+", " ", text or "").strip()


def _display_title(market, event):
    """Outcomes of a multi-choice event often share one title ("Who will win the
    governorship in California?"); append the outcome so each row is self-explanatory."""
    title = _clean(market.get("title"))
    outcome = _clean(market.get("yes_sub_title"))
    siblings_share_title = sum(_clean(m.get("title")) == title for m in event.get("markets") or []) > 1
    if siblings_share_title and outcome and outcome.lower() not in title.lower():
        return f"{title} — {outcome}"
    return title or _clean(event.get("title"))


def _iso_to_date(iso_string):
    return (iso_string or "")[:10] or None


def normalize_market(market, event, include_details=False):
    """Kalshi market + its parent event -> MarketLens's normalized market dict."""
    yes_bid = _number(market.get("yes_bid_dollars"))
    yes_ask = _number(market.get("yes_ask_dollars"))
    last_price = _number(market.get("last_price_dollars"))
    probability, method = implied_probability(yes_bid, yes_ask, last_price)

    previous, _ = implied_probability(
        _number(market.get("previous_yes_bid_dollars")),
        _number(market.get("previous_yes_ask_dollars")),
        _number(market.get("previous_price_dollars")),
    )
    change_24h = probability - previous if probability is not None and previous is not None else 0.0

    event_title = _clean(event.get("title"))
    event_sub = _clean(event.get("sub_title"))

    normalized = {
        "id": market["ticker"],  # the frontend's id is Kalshi's ticker
        "ticker": market["ticker"],
        "event_ticker": event.get("event_ticker") or market.get("event_ticker"),
        "series_ticker": event.get("series_ticker"),
        "title": _display_title(market, event),
        "subtitle": f"{event_title} · {event_sub}" if event_sub else event_title,
        "outcome": _clean(market.get("yes_sub_title")) or None,
        "category": event.get("category") or "Other",
        "probability": round(probability, 4) if probability is not None else None,
        "probability_method": method,
        "change_24h": round(change_24h, 4),
        "yes_bid": yes_bid,
        "yes_ask": yes_ask,
        "last_price": last_price,
        "volume": _number(market.get("volume_fp")) or 0.0,
        "volume_24h": _number(market.get("volume_24h_fp")) or 0.0,
        "open_interest": _number(market.get("open_interest_fp")) or 0.0,
        "close_time": market.get("close_time"),
        "end_date": _iso_to_date(market.get("close_time")),
        "status": market.get("status"),
    }
    if include_details:
        normalized.update({
            "rules": _clean(market.get("rules_primary")) or None,
            "open_time": market.get("open_time"),
            "expected_expiration_time": market.get("expected_expiration_time"),
            "can_close_early": market.get("can_close_early"),
        })
    return normalized


# ---------------------------------------------------------------------------
# Public functions used by the Flask routes
# ---------------------------------------------------------------------------

def _fetch_universe():
    """Fetch every curated series and pick the most actively traded markets."""
    series = Config.KALSHI_SERIES
    events, failures = [], []

    # Sequential on purpose: Kalshi's rate limit, not latency, is the bottleneck.
    # ~40 series take about 9 seconds, which users don't see thanks to the cache.
    consecutive_failures = 0
    for series_ticker in series:
        try:
            events.extend(client.open_events(series_ticker))
            consecutive_failures = 0
        except MarketNotFound:
            log.warning("Series %s not found on Kalshi; remove it from KALSHI_SERIES", series_ticker)
        except KalshiError as exc:
            failures.append(series_ticker)
            consecutive_failures += 1
            log.warning("Skipping series %s: %s", series_ticker, exc)
            if consecutive_failures >= KalshiClient.CIRCUIT_BREAKER_FAILURES:
                raise KalshiError(f"Kalshi looks unavailable ({consecutive_failures} failures in a row)") from exc

    if not events:
        raise KalshiError("Kalshi returned no open events for any tracked series")

    markets = []
    for event in events:
        candidates = [
            normalize_market(m, event)
            for m in event.get("markets") or []
            if m.get("status") == "active"
        ]
        candidates = [m for m in candidates if m["probability"] is not None and m["volume"] > 0]
        candidates.sort(key=lambda m: (m["volume_24h"], m["volume"]), reverse=True)
        markets.extend(candidates[:Config.MAX_MARKETS_PER_EVENT])

    markets.sort(key=lambda m: (m["volume_24h"], m["volume"]), reverse=True)
    log.info("Loaded %d markets from %d events (%d series failed)", len(markets), len(events), len(failures))
    return markets[:Config.MAX_MARKETS]


def get_markets():
    """All tracked markets, most active first. Returns (markets, fetched_at, is_stale)."""
    return cache.get_or_fetch("markets", Config.MARKETS_CACHE_SECONDS, _fetch_universe, background=True)


def warm_cache():
    """Load the market list in the background at startup so the first visitor doesn't wait."""
    def run():
        try:
            get_markets()
        except Exception as exc:
            log.warning("Cache warm-up failed: %s", exc)

    threading.Thread(target=run, daemon=True).start()


def normalize_ticker(ticker):
    ticker = (ticker or "").strip().upper()
    if not TICKER_PATTERN.match(ticker):
        raise ValueError("Invalid market ticker")
    return ticker


def get_market(ticker):
    """Detailed info for one market (fresh quotes plus rules and event metadata)."""
    def fetch():
        market = client.market(ticker)
        event, _, _ = cache.get_or_fetch(
            f"event:{market['event_ticker']}", 3600, lambda: client.event(market["event_ticker"])
        )
        return normalize_market(market, event, include_details=True)

    return cache.get_or_fetch(f"market:{ticker}", 30, fetch)


def candle_probability(candle):
    """Probability at the close of one candlestick, using the same rule as live prices."""
    yes_bid = (candle.get("yes_bid") or {}).get("close_dollars")
    yes_ask = (candle.get("yes_ask") or {}).get("close_dollars")
    last = (candle.get("price") or {}).get("close_dollars")
    probability, _ = implied_probability(_number(yes_bid), _number(yes_ask), _number(last))
    return probability


def _history_points(candles):
    points = []
    for candle in candles:
        probability = candle_probability(candle)
        if probability is None:
            continue
        ts = candle["end_period_ts"]
        points.append({
            "t": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
            "probability": round(probability, 4),
            "volume": _number(candle.get("volume_fp")) or 0.0,
        })
    return points


def get_history(ticker, range_key=DEFAULT_HISTORY_RANGE):
    """Real probability history from Kalshi candlesticks. Returns (payload, fetched_at, is_stale)."""
    lookback, period = HISTORY_RANGES[range_key]

    def fetch():
        # Confirms the ticker exists, so unknown tickers 404 instead of returning an empty chart.
        get_market(ticker)
        end = int(time.time())
        candles = client.candlesticks([ticker], end - lookback, end, period).get(ticker, [])
        return {"ticker": ticker, "range": range_key, "interval_minutes": period, "points": _history_points(candles)}

    return cache.get_or_fetch(f"history:{ticker}:{range_key}", Config.HISTORY_CACHE_SECONDS, fetch)


def get_recent_histories(tickers, hours=24):
    """Hourly probability points for many markets using one batch request per 100 tickers."""
    end = int(time.time())
    histories = {}
    for i in range(0, len(tickers), 100):
        chunk = tickers[i:i + 100]
        for ticker, candles in client.candlesticks(chunk, end - hours * 3600, end, 60).items():
            histories[ticker] = _history_points(candles)
    return histories


def get_orderbook(ticker, depth=10):
    """Top of the order book in YES terms: bids to buy YES, and asks implied by NO bids.

    Kalshi only lists bids. Buying NO at 89¢ is the same as selling YES at 11¢, so a
    NO bid at price p is a YES ask at 1 - p.
    """
    def fetch():
        data = client.orderbook(ticker, depth)
        book = data.get("orderbook_fp") or data.get("orderbook") or {}
        yes_levels = [(_number(p), _number(s)) for p, s in book.get("yes_dollars") or []]
        no_levels = [(_number(p), _number(s)) for p, s in book.get("no_dollars") or []]

        bids = sorted(({"price": p, "size": s} for p, s in yes_levels if p is not None), key=lambda l: -l["price"])
        asks = sorted(
            ({"price": round(1 - p, 4), "size": s} for p, s in no_levels if p is not None),
            key=lambda l: l["price"],
        )
        best_bid = bids[0]["price"] if bids else None
        best_ask = asks[0]["price"] if asks else None
        return {
            "ticker": ticker,
            "bids": bids[:depth],
            "asks": asks[:depth],
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": round(best_ask - best_bid, 4) if best_bid is not None and best_ask is not None else None,
        }

    return cache.get_or_fetch(f"orderbook:{ticker}:{depth}", 15, fetch)


def check_exchange():
    """True if Kalshi's API answers and reports the exchange as active."""
    return bool(client.exchange_status().get("exchange_active"))
