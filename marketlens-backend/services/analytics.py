"""Deterministic market analytics.

Every number MarketLens shows (and, later, every number passed to the AI brief) is
computed here with plain arithmetic, never by a language model.

Units: probabilities are 0-1 floats. A move from 0.55 to 0.62 is a change of +0.07,
displayed as "+7.0 pts" (percentage points), not "+12.7%" (percent change).
"""

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
