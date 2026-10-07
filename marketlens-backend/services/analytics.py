"""Deterministic market analytics.

Every number MarketLens shows (and, later, every number passed to the AI brief) is
computed here with plain arithmetic, never by a language model.

Units: probabilities are 0-1 floats. A move from 0.55 to 0.62 is a change of +0.07,
displayed as "+7.0 pts" (percentage points), not "+12.7%" (percent change).
"""

from datetime import datetime, timezone
from statistics import pstdev


def top_gainers(markets, limit=5):
    """Markets whose probability rose the most over 24h."""
    rising = [m for m in markets if m["change_24h"] > 0]
    return sorted(rising, key=lambda m: m["change_24h"], reverse=True)[:limit]


def top_losers(markets, limit=5):
    """Markets whose probability fell the most over 24h."""
    falling = [m for m in markets if m["change_24h"] < 0]
    return sorted(falling, key=lambda m: m["change_24h"])[:limit]


def biggest_movers(markets, limit=5):
    """Largest absolute 24h change in either direction."""
    return sorted(markets, key=lambda m: abs(m["change_24h"]), reverse=True)[:limit]


def top_volume(markets, limit=5):
    """Most contracts traded in the last 24h."""
    return sorted(markets, key=lambda m: m.get("volume_24h", 0), reverse=True)[:limit]


def volatility(points):
    """Standard deviation of period-to-period probability changes, in probability units.

    For hourly points, 0.01 means the price typically moves about 1 pt per hour.
    Returns None when there are fewer than 3 points (not enough to say anything).
    """
    if len(points) < 3:
        return None
    probabilities = [p["probability"] for p in points]
    changes = [b - a for a, b in zip(probabilities, probabilities[1:])]
    return pstdev(changes)


def history_stats(points):
    """Summary numbers for a probability-history chart."""
    if not points:
        return None
    probabilities = [p["probability"] for p in points]
    vol = volatility(points)
    return {
        "start": probabilities[0],
        "end": probabilities[-1],
        "change": round(probabilities[-1] - probabilities[0], 4),
        "high": max(probabilities),
        "low": min(probabilities),
        "volatility": round(vol, 4) if vol is not None else None,
        "points": len(points),
    }


def most_volatile(markets, histories, limit=5):
    """Rank markets by recent volatility, given {ticker: history points}."""
    scored = []
    for market in markets:
        vol = volatility(histories.get(market["ticker"], []))
        if vol is not None and vol > 0:
            scored.append({**market, "volatility": round(vol, 4)})
    return sorted(scored, key=lambda m: m["volatility"], reverse=True)[:limit]


def overview_metrics(markets):
    """Headline numbers for the dashboard metric tiles."""
    if not markets:
        return {"count": 0, "total_volume": 0, "total_volume_24h": 0, "avg_abs_change": 0}
    return {
        "count": len(markets),
        "total_volume": sum(m["volume"] for m in markets),
        "total_volume_24h": sum(m.get("volume_24h", 0) for m in markets),
        "avg_abs_change": round(sum(abs(m["change_24h"]) for m in markets) / len(markets), 4),
    }


def _signed_points(change):
    return f"{change * 100:+.1f} percentage points"


def _contracts(value):
    return f"{value:,.0f} contracts (${value:,.0f} notional)"


def brief_facts(market, stats=None, volume_rank=None, tracked_count=None, now=None):
    """Every number the AI Market Brief may mention, computed and formatted here.

    Returns (label, value) pairs. Facts whose source data is missing are left out,
    so the model is never handed a blank it might fill in.
    """
    facts = [("Market", market["title"]), ("Category", market["category"])]
    if market.get("outcome"):
        facts.append(("Outcome this market prices", market["outcome"]))

    probability = market.get("probability")
    if probability is not None:
        facts.append(("Current market-implied probability (YES)", f"{probability * 100:.1f}%"))
    if market.get("yes_bid") and market.get("yes_ask"):
        spread = market["yes_ask"] - market["yes_bid"]
        facts.append(("Best bid / ask", f"{market['yes_bid'] * 100:.1f}¢ / {market['yes_ask'] * 100:.1f}¢ "
                                        f"(spread {spread * 100:.1f}¢)"))
    facts.append(("24-hour change", _signed_points(market["change_24h"])))

    if stats:
        facts.append(("7-day change", _signed_points(stats["change"])))
        facts.append(("7-day high / low", f"{stats['high'] * 100:.1f}% / {stats['low'] * 100:.1f}%"))

        trend = "rising" if stats["change"] >= 0.01 else "falling" if stats["change"] <= -0.01 else "roughly flat"
        facts.append(("7-day trend", f"{trend} (classified from the 7-day change; threshold ±1 point)"))

        price_range = stats["high"] - stats["low"]
        if price_range > 0 and probability is not None:
            position = (probability - stats["low"]) / price_range
            where = "near the 7-day high" if position >= 0.8 else "near the 7-day low" if position <= 0.2 else "mid-range"
            facts.append(("Position in 7-day range", where))
            share = abs(market["change_24h"]) / price_range
            facts.append(("Size of the 24-hour move", f"{share * 100:.0f}% of the 7-day high-low range"))

        if stats.get("volatility") is not None:
            facts.append(("Volatility (std. dev. of hourly changes, 7 days)", f"{stats['volatility'] * 100:.2f} percentage points per hour"))

    if market.get("volume"):
        facts.append(("Total volume", _contracts(market["volume"])))
    if market.get("volume_24h") is not None and market.get("volume"):
        facts.append(("24-hour volume", _contracts(market["volume_24h"])))
    if market.get("open_interest"):
        facts.append(("Open interest", _contracts(market["open_interest"])))
    if volume_rank and tracked_count:
        facts.append(("Volume rank", f"#{volume_rank} of {tracked_count} markets tracked by MarketLens"))

    if market.get("close_time"):
        closes = datetime.fromisoformat(market["close_time"].replace("Z", "+00:00"))
        days = (closes - (now or datetime.now(timezone.utc))).days
        date = f"{closes:%B} {closes.day}, {closes.year}"
        facts.append(("Market closes", f"{date} ({days} days from now)" if days >= 0 else date))
    if market.get("rules"):
        facts.append(("Resolution rules", market["rules"]))
    return facts
