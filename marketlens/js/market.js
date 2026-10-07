// MarketLens market detail page: renders one market from market.html?id=<ticker>,
// including its real probability history (Kalshi candlesticks) and order book.

(async function () {
  const ML = window.MarketLens;
  const { pct, pts, usd, cents, compact, niceDate, niceDateTime, escapeHtml, direction, arrow, changeBadge } = ML.format;
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

  const isLive = market.ticker !== undefined; // sample markets don't carry Kalshi fields
  document.title = `${market.title} · MarketLens`;
  const dir = direction(market.change_24h);
  const rank = ML.analytics.volumeRank(markets, market.id);
  const dataPill = isLive && !sampleData
    ? '<span class="pill live">Live · Kalshi</span>'
    : '<span class="pill">Sample data</span>';

  const PROBABILITY_METHODS = {
    midpoint: "Midpoint of best bid and ask",
    last_trade: "Last traded price (bid/ask too wide or missing)",
    wide_midpoint: "Midpoint of a wide bid/ask spread",
  };

  const stat = (label, value) =>
    `<div class="stat"><span class="metric-label">${label}</span><span class="stat-value">${value}</span></div>`;

  const quoteLine = isLive
    ? `<p class="muted small quote-line">Bid ${cents(market.yes_bid)} · Ask ${cents(market.yes_ask)} · Last ${cents(market.last_price)}</p>`
    : "";

  root.innerHTML = `
    <a class="back-link" href="index.html">← All markets</a>

    <section class="detail-head">
      <div>
        <span class="category">${escapeHtml(market.category)}${isLive ? ` · <span class="mono">${escapeHtml(market.ticker)}</span>` : ""}</span>
        <h1 class="detail-title">${escapeHtml(market.title)}</h1>
        <p class="muted small">
          ${market.subtitle ? `${escapeHtml(market.subtitle)} · ` : ""}Closes ${niceDate(market.end_date)} · ${dataPill}
        </p>
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
        ${quoteLine}
      </div>

      <div class="panel stats">
        ${stat("24h change", `<span class="change ${dir}">${pts(market.change_24h)}</span>`)}
        ${stat("Total volume", usd(market.volume))}
        ${isLive ? stat("24h volume", usd(market.volume_24h)) : ""}
        ${isLive ? stat("Open interest", `${compact(market.open_interest)} <small class="muted">contracts</small>`) : ""}
        ${stat("Volume rank", `${rank ? `#${rank}` : "—"} <small class="muted">of ${markets.length}</small>`)}
        ${stat("Closes", niceDate(market.end_date))}
      </div>
    </section>

    <section class="panel chart-panel">
      <div class="panel-head">
        <div>
          <h2>Probability History</h2>
          <p class="muted small" id="history-caption">Kalshi candlesticks · hover for details</p>
        </div>
        <div class="tabs" id="range-tabs" role="tablist" aria-label="History range">
          <button class="tab" role="tab" data-range="1d">1D</button>
          <button class="tab active" role="tab" data-range="7d">7D</button>
          <button class="tab" role="tab" data-range="30d">30D</button>
          <button class="tab" role="tab" data-range="90d">90D</button>
        </div>
      </div>
      <div class="history-wrap" id="history-wrap">
        <canvas id="history-chart" role="img" aria-label="Line chart of this market's probability over time"></canvas>
      </div>
      <div class="history-stats" id="history-stats"></div>
    </section>

    <section class="detail-grid">
      <div class="panel">
        <div class="panel-head"><h2>Order Book</h2><span class="muted small">Yes side · top levels</span></div>
        <div id="orderbook-body"><p class="empty">${isLive ? "Loading…" : "Order book depth is available with live Kalshi data."}</p></div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>About This Market</h2></div>
        <dl class="meta-list">
          ${market.rules ? `<dt>Resolves Yes if</dt><dd>${escapeHtml(market.rules)}</dd>` : ""}
          ${market.outcome ? `<dt>Outcome</dt><dd>${escapeHtml(market.outcome)}</dd>` : ""}
          ${isLive ? `<dt>Probability from</dt><dd>${PROBABILITY_METHODS[market.probability_method] || "—"}</dd>` : ""}
          ${market.open_time ? `<dt>Opened</dt><dd>${niceDateTime(market.open_time)}</dd>` : ""}
          ${market.close_time ? `<dt>Closes</dt><dd>${niceDateTime(market.close_time)}${market.can_close_early ? " <span class='muted'>(can close early)</span>" : ""}</dd>` : ""}
          ${market.event_ticker ? `<dt>Event</dt><dd class="mono">${escapeHtml(market.event_ticker)}</dd>` : ""}
        </dl>
      </div>
    </section>

    <section class="panel brief">
      <div class="panel-head">
        <h2>AI Market Brief</h2>
        <span class="pill">Coming soon</span>
      </div>
      <p class="muted">
        A short, data-grounded explanation of what this market is pricing and how much it has moved.
        All numbers are computed first; the model only interprets them.
      </p>
      <button class="btn" type="button" disabled>Generate brief</button>
    </section>`;

  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();

  renderOrderbook();
  setUpHistory();

  // ---------- Order book ----------

  async function renderOrderbook() {
    if (!isLive) return;
    const body = document.getElementById("orderbook-body");
    const book = await ML.api.getOrderbook(market.id);
    if (!book || (!book.bids.length && !book.asks.length)) {
      body.innerHTML = '<p class="empty">No resting orders right now.</p>';
      return;
    }
    // Bars are scaled to the largest level on either side so depth is comparable.
    const maxSize = Math.max(...book.bids.map((l) => l.size), ...book.asks.map((l) => l.size));
    const rows = (levels, side) => levels.map((l) => `
      <tr>
        <td class="mono">${cents(l.price)}</td>
        <td class="mono depth-cell">
          <span class="depth-bar ${side}" style="width: ${((l.size / maxSize) * 100).toFixed(1)}%"></span>
          <span class="depth-value">${compact(l.size)}</span>
        </td>
      </tr>`).join("");

    body.innerHTML = `
      <div class="orderbook">
        <table>
          <thead><tr><th>Bid (buy Yes)</th><th>Contracts</th></tr></thead>
          <tbody>${rows(book.bids, "bid") || '<tr><td colspan="2" class="muted">None</td></tr>'}</tbody>
        </table>
        <table>
          <thead><tr><th>Ask (sell Yes)</th><th>Contracts</th></tr></thead>
          <tbody>${rows(book.asks, "ask") || '<tr><td colspan="2" class="muted">None</td></tr>'}</tbody>
        </table>
      </div>
      <p class="muted small">Spread ${cents(book.spread)} · asks are implied from No bids (No at 89¢ = Yes at 11¢).</p>`;
  }

  // ---------- Probability history chart ----------

  function setUpHistory() {
    const wrap = document.getElementById("history-wrap");
    const tabs = document.querySelectorAll("#range-tabs .tab");

    if (!isLive) {
      document.getElementById("range-tabs").hidden = true;
      document.getElementById("history-caption").textContent = "Real price history from Kalshi";
      wrap.innerHTML = '<div class="empty chart-empty">History charts use real Kalshi candlesticks and appear when the live MarketLens API is connected. Sample data has no history, so none is invented here.</div>';
      return;
    }
    if (typeof Chart === "undefined") {
      wrap.innerHTML = '<p class="empty">Chart library failed to load.</p>';
      return;
    }

    Chart.defaults.font.family = token("--font");
    Chart.defaults.color = token("--text-muted");

    let chart = null;
    let currentRange = "7d";

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        load(tab.dataset.range);
      });
    });

    async function load(range) {
      currentRange = range;
      wrap.classList.add("loading");
      const history = await ML.api.getHistory(market.id, range);
      if (range !== currentRange) return; // a newer tab click won the race
      wrap.classList.remove("loading");
      draw(history, range);
    }

    function draw(history, range) {
      const statsEl = document.getElementById("history-stats");
      if (!history || history.points.length < 2) {
        if (chart) chart.destroy();
        chart = null;
        wrap.innerHTML = `<div class="empty chart-empty">${history ? "Not enough trading activity in this period to chart." : "Price history is temporarily unavailable."}</div>`;
        statsEl.innerHTML = "";
        return;
      }
      if (!wrap.querySelector("canvas")) {
        wrap.innerHTML = '<canvas id="history-chart" role="img" aria-label="Line chart of this market\'s probability over time"></canvas>';
      }

      const points = history.points;
      const s = history.stats;
      statsEl.innerHTML = `
        <div><span class="metric-label">Change</span> ${changeBadge(s.change)}</div>
        <div><span class="metric-label">High</span> <span class="mono">${pct(s.high)}</span></div>
        <div><span class="metric-label">Low</span> <span class="mono">${pct(s.low)}</span></div>
        <div title="Standard deviation of period-to-period probability changes">
          <span class="metric-label">Volatility</span>
          <span class="mono">${s.volatility != null ? `${(s.volatility * 100).toFixed(2)} pts/${history.interval_minutes >= 1440 ? "day" : "hr"}` : "—"}</span>
        </div>`;

      const dates = points.map((p) => new Date(p.t));
      const tickLabel = (d) => (range === "1d"
        ? d.toLocaleTimeString("en-US", { hour: "numeric" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
      const tooltipLabel = (d) => d.toLocaleString("en-US", {
        month: "short", day: "numeric", hour: history.interval_minutes >= 1440 ? undefined : "numeric", minute: history.interval_minutes >= 1440 ? undefined : "2-digit",
      });

      const data = {
        labels: dates,
        datasets: [{
          data: points.map((p) => p.probability * 100),
          borderColor: token("--accent"),
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: token("--accent"),
          pointHoverBorderColor: token("--surface"),
          pointHoverBorderWidth: 2,
          tension: 0.2,
          fill: true,
          backgroundColor: (ctx) => {
            const { chartArea, ctx: c } = ctx.chart;
            if (!chartArea) return "transparent";
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, token("--accent") + "33");
            gradient.addColorStop(1, token("--accent") + "00");
            return gradient;
          },
        }],
      };

      if (chart) {
        chart.data = data;
        chart.options.scales.x.ticks.callback = (_v, i) => tickLabel(dates[i]);
        chart.options.plugins.tooltip.callbacks.title = (items) => tooltipLabel(dates[items[0].dataIndex]);
        chart.update();
        return;
      }

      chart = new Chart(document.getElementById("history-chart"), {
        type: "line",
        data,
        plugins: [crosshair],
        options: {
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false }, // hover anywhere along the line
          scales: {
            x: {
              grid: { display: false },
              border: { color: token("--border") },
              ticks: { maxTicksLimit: 7, maxRotation: 0, autoSkipPadding: 16, callback: (_v, i) => tickLabel(dates[i]) },
            },
            y: {
              grace: "10%",
              grid: { color: token("--border") },
              border: { display: false },
              ticks: { callback: (v) => `${Number(v.toFixed(1))}%`, maxTicksLimit: 6 },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: token("--surface-2"),
              borderColor: token("--border-hover"),
              borderWidth: 1,
              titleColor: token("--text"),
              bodyColor: token("--text-muted"),
              padding: 12,
              displayColors: false,
              callbacks: {
                title: (items) => tooltipLabel(dates[items[0].dataIndex]),
                label: (item) => [
                  `Probability  ${item.parsed.y.toFixed(1)}%`,
                  `Volume       ${compact(points[item.dataIndex].volume)} contracts`,
                ],
              },
            },
          },
        },
      });
    }

    // Vertical guide line at the hovered point.
    const crosshair = {
      id: "crosshair",
      afterDatasetsDraw(c) {
        const active = c.tooltip && c.tooltip.getActiveElements();
        if (!active || !active.length) return;
        const x = active[0].element.x;
        const { top, bottom } = c.chartArea;
        c.ctx.save();
        c.ctx.strokeStyle = token("--border-hover");
        c.ctx.lineWidth = 1;
        c.ctx.beginPath();
        c.ctx.moveTo(x, top);
        c.ctx.lineTo(x, bottom);
        c.ctx.stroke();
        c.ctx.restore();
      },
    };

    load(currentRange);
  }
})();
