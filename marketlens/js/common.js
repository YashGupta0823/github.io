// Shared helpers for every MarketLens page: display formatters, analytics (a port of
// marketlens-backend/services/analytics.py, used for sample data), and data-source status.

window.MarketLens = window.MarketLens || {};

(function (ML) {
  // ---------- Formatters ----------

  // 0.623 -> "62%"
  const pct = (probability) => `${(probability * 100).toFixed(0)}%`;

  // 0.071 -> "+7.1 pts" (percentage points, not percent)
  const pts = (change) => `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)} pts`;

  // 18_400_000 -> "$18.4M"
  function usd(value) {
    for (const [threshold, suffix] of [[1e9, "B"], [1e6, "M"], [1e3, "K"]]) {
      if (value >= threshold) return `$${(value / threshold).toFixed(1)}${suffix}`;
    }
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }

  // 0.105 -> "10.5¢" (a Kalshi contract price; $1 pays out if Yes)
  const cents = (price) => (price == null ? "—" : `${(price * 100).toFixed(price < 0.1 ? 1 : 0)}¢`);

  // 22_013_291 -> "22.0M" (contract counts)
  function compact(value) {
    for (const [threshold, suffix] of [[1e9, "B"], [1e6, "M"], [1e3, "K"]]) {
      if (value >= threshold) return `${(value / threshold).toFixed(1)}${suffix}`;
    }
    return Math.round(value).toLocaleString("en-US");
  }

  // "2027-02-01T15:00:00Z" -> "Feb 1, 2027, 10:00 AM" in the viewer's timezone
  function niceDateTime(isoString) {
    const date = new Date(isoString || "");
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  // "2026-12-16" -> "Dec 16, 2026" (parsed by hand so the local timezone can't shift the day)
  function niceDate(isoString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoString || "");
    if (!match) return "—";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
  }

  // Market data will eventually come from an external API, so escape before using innerHTML.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
  }

  const direction = (change) => (change > 0 ? "up" : change < 0 ? "down" : "flat");
  const arrow = (dir) => (dir === "up" ? "▲" : dir === "down" ? "▼" : "•");

  function changeBadge(change) {
    const dir = direction(change);
    return `<span class="change ${dir}"><span aria-hidden="true">${arrow(dir)}</span> ${pts(change)}</span>`;
  }

  // Relative URL so it works under /marketlens/ on GitHub Pages and from file://.
  const marketUrl = (id) => `market.html?id=${encodeURIComponent(id)}`;

  // ---------- Analytics ----------

  const rankByVolume = (markets) => [...markets].sort((a, b) => b.volume - a.volume);

  const biggestMovers = (markets, limit = 5) =>
    [...markets].sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h)).slice(0, limit);

  const topGainers = (markets, limit = 5) =>
    markets.filter((m) => m.change_24h > 0).sort((a, b) => b.change_24h - a.change_24h).slice(0, limit);

  const topLosers = (markets, limit = 5) =>
    markets.filter((m) => m.change_24h < 0).sort((a, b) => a.change_24h - b.change_24h).slice(0, limit);

  function volumeRank(markets, marketId) {
    const index = rankByVolume(markets).findIndex((m) => m.id === marketId);
    return index === -1 ? null : index + 1;
  }

  function overviewMetrics(markets) {
    if (!markets.length) return { count: 0, total_volume: 0, avg_abs_change: 0, top_mover: null };
    return {
      count: markets.length,
      total_volume: markets.reduce((sum, m) => sum + m.volume, 0),
      avg_abs_change: markets.reduce((sum, m) => sum + Math.abs(m.change_24h), 0) / markets.length,
      top_mover: biggestMovers(markets, 1)[0],
    };
  }

  // ---------- Data-source status ----------
  // Every page says where its numbers come from, so sample data is never mistaken for live data.

  function renderStatus(el, { sampleData, updatedAt, stale }) {
    if (sampleData) {
      el.innerHTML = `<span class="pill" title="Live market data is unavailable right now, so these are sample markets.">Demo data</span>`;
      return;
    }
    const date = new Date(updatedAt || "");
    const time = Number.isNaN(date.getTime())
      ? ""
      : `<span class="status-time">Last updated ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${stale ? " (delayed)" : ""}</span>`;
    el.innerHTML = `<span class="pill live">Live Kalshi data</span>${time}`;
  }

  // Shown while waiting for the API. Render's free tier can take up to a minute to wake,
  // so after a few seconds explain the wait instead of looking frozen. Returns a stop function.
  function showConnecting(el) {
    el.innerHTML = '<span class="pill connecting">Connecting to live markets…</span>';
    const timer = setTimeout(() => {
      el.insertAdjacentHTML("beforeend", '<span class="status-time">Waking up the server; this can take up to a minute.</span>');
    }, 4000);
    return () => clearTimeout(timer);
  }

  ML.status = { render: renderStatus, connecting: showConnecting };

  ML.format = { pct, pts, usd, cents, compact, niceDate, niceDateTime, escapeHtml, direction, arrow, changeBadge, marketUrl };
  ML.analytics = { rankByVolume, biggestMovers, topGainers, topLosers, volumeRank, overviewMetrics };
})(window.MarketLens);
