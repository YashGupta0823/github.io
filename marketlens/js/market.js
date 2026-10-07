// MarketLens market detail page: renders one market from market.html?id=<id>.
// Static replacement for the /market/<id> Flask route and templates/market.html.

(async function () {
  const ML = window.MarketLens;
  const { pct, pts, usd, niceDate, escapeHtml, direction, arrow } = ML.format;
  const root = document.getElementById("market-root");

  const id = new URLSearchParams(window.location.search).get("id") || "";
  // The full list is needed for volume rank, and tells us whether this is sample data.
  const [{ markets, sampleData }, market] = await Promise.all([
    ML.api.getMarkets(),
    id ? ML.api.getMarket(id) : Promise.resolve(null),
  ]);

  if (!market) {
    document.title = "Market not found · MarketLens";
    root.innerHTML = `
      <section class="empty-page">
        <h1>Market not found</h1>
        <p class="muted">This market doesn't exist or is no longer active.</p>
        <a class="btn" href="index.html">Back to Discover</a>
      </section>`;
    return;
  }

  document.title = `${market.title} · MarketLens`;
  const dir = direction(market.change_24h);
  const rank = ML.analytics.volumeRank(markets, market.id);
  const samplePill = sampleData ? ' · <span class="pill">Sample data</span>' : "";

  root.innerHTML = `
    <a class="back-link" href="index.html">← All markets</a>

    <section class="detail-head">
      <div>
        <span class="category">${escapeHtml(market.category)}</span>
        <h1 class="detail-title">${escapeHtml(market.title)}</h1>
        <p class="muted small">Resolves ${niceDate(market.end_date)}${samplePill}</p>
      </div>
      <button class="btn btn-ghost" type="button" title="Watchlist coming in the next step">☆ Add to watchlist</button>
    </section>

    <section class="detail-grid">
      <div class="panel hero">
        <span class="metric-label">Market-implied probability (Yes)</span>
        <span class="hero-value">${pct(market.probability)}</span>
        <span class="change ${dir}">
          <span aria-hidden="true">${arrow(dir)}</span>
          ${pts(market.change_24h)} <span class="muted">· 24h</span>
        </span>
        <div class="prob-bar large"><span style="width: ${(market.probability * 100).toFixed(1)}%"></span></div>
      </div>

      <div class="panel stats">
        <div class="stat"><span class="metric-label">24h change</span><span class="stat-value change ${dir}">${pts(market.change_24h)}</span></div>
        <div class="stat"><span class="metric-label">Volume</span><span class="stat-value">${usd(market.volume)}</span></div>
        <div class="stat"><span class="metric-label">Volume rank</span><span class="stat-value">${rank ? `#${rank}` : "—"} <small class="muted">of ${markets.length}</small></span></div>
        <div class="stat"><span class="metric-label">Resolves</span><span class="stat-value">${niceDate(market.end_date)}</span></div>
      </div>
    </section>

    <section class="detail-grid">
      <div class="panel chart-panel">
        <div class="panel-head"><h2>Probability History</h2></div>
        <div class="empty chart-empty">
          History charts are built from stored snapshots. This will populate once snapshot collection is added.
        </div>
      </div>

      <div class="panel brief">
        <div class="panel-head">
          <h2>AI Market Brief</h2>
          <span class="pill">Coming soon</span>
        </div>
        <p class="muted">
          A short, data-grounded explanation of what this market is pricing and how much it has moved.
          All numbers are computed first; the model only interprets them.
        </p>
        <button class="btn" type="button" disabled>Generate brief</button>
      </div>
    </section>`;
})();
