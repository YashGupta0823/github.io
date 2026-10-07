// Shared helpers for every MarketLens page: display formatters (ports of the
// Jinja filters in app.py), analytics (port of services/analytics.py), and nav.

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

  ML.format = { pct, pts, usd, niceDate, escapeHtml, direction, arrow, changeBadge, marketUrl };
  ML.analytics = { rankByVolume, biggestMovers, volumeRank, overviewMetrics };

  // ---------- Nav search ----------

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    // Pre-fill from ?q= (the Flask version did this server-side).
    searchInput.value = (new URLSearchParams(window.location.search).get("q") || "").trim().slice(0, 100);

    // Press "/" anywhere to focus search.
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }
})(window.MarketLens);
