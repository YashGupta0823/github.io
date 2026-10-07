// MarketLens dashboard: renders metrics, movers, and market cards from the API,
// then wires up the interactive Market Map.

(async function () {
  const ML = window.MarketLens;
  const { pct, pts, usd, escapeHtml, changeBadge, marketUrl } = ML.format;

  const status = document.getElementById("data-status");
  const grid = document.getElementById("market-grid");
  const stopConnecting = ML.status.connecting(status);
  grid.innerHTML = '<p class="empty">Loading markets…</p>';

  const marketData = await ML.api.getMarkets();
  stopConnecting();
  ML.status.render(status, marketData);

  const { markets: rawMarkets, sampleData } = marketData;
  const markets = ML.analytics.rankByVolume(rawMarkets);

  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();

  // ---------- Header + metrics ----------

  const metrics = ML.analytics.overviewMetrics(markets);
  document.getElementById("metric-count").textContent = metrics.count;
  document.getElementById("metric-volume").textContent = usd(metrics.total_volume);
  document.getElementById("metric-avg-move").innerHTML = `${(metrics.avg_abs_change * 100).toFixed(1)} <small>pts</small>`;
  if (metrics.top_mover) {
    const m = metrics.top_mover;
    document.getElementById("metric-top-mover").innerHTML = `
      <span class="metric-label">Largest move</span>
      <span class="metric-value">${changeBadge(m.change_24h)}</span>
      <a class="metric-sub" href="${marketUrl(m.id)}">${escapeHtml(m.title)}</a>`;
  }

  // ---------- Biggest movers (backend analytics, or computed locally for sample data) ----------
  // Loaded in the background so the cards and map never wait on it.

  const moversBody = document.getElementById("movers-body");
  const moverTabs = document.querySelectorAll("#movers-tabs .tab");
  let movers = null;
  let activeMoverTab = "biggest";

  function renderMovers(kind) {
    if (!movers) {
      moversBody.innerHTML = '<p class="empty">Loading movers…</p>';
      return;
    }
    const list = movers[kind] || [];
    moversBody.innerHTML = list.length
      ? `<ol class="movers">${list.map((m) => `
          <li>
            <a href="${marketUrl(m.id)}">
              <span class="mover-title">${escapeHtml(m.title)}</span>
              <span class="mover-meta">
                <span class="mono">${pct(m.probability)}</span>
                ${changeBadge(m.change_24h)}
                ${kind === "most_volatile"
                  ? `<span class="muted mono" title="Standard deviation of hourly probability changes over 24h">σ ${(m.volatility * 100).toFixed(1)} pts/hr</span>`
                  : ""}
              </span>
            </a>
          </li>`).join("")}</ol>`
      : '<p class="empty">No market movement to show yet.</p>';
  }

  moverTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      moverTabs.forEach((t) => t.classList.toggle("active", t === tab));
      activeMoverTab = tab.dataset.tab;
      renderMovers(activeMoverTab);
    });
  });
  renderMovers(activeMoverTab);

  (sampleData ? Promise.resolve(null) : ML.api.getMovers()).then((backendMovers) => {
    movers = backendMovers || {
      biggest: ML.analytics.biggestMovers(markets, 5),
      gainers: ML.analytics.topGainers(markets, 5),
      losers: ML.analytics.topLosers(markets, 5),
      most_volatile: [],
    };
    // Volatility needs price history, which only the live backend provides.
    document.querySelector('#movers-tabs [data-tab="most_volatile"]').hidden = !movers.most_volatile.length;
    renderMovers(activeMoverTab);
  });

  // ---------- Market cards ----------

  grid.innerHTML = markets.map((m) => `
    <article class="card">
      <a class="card-link" href="${marketUrl(m.id)}" aria-label="${escapeHtml(m.title)}"></a>
      <span class="category">${escapeHtml(m.category)}</span>
      <h3 class="card-title">${escapeHtml(m.title)}</h3>
      <div class="card-bottom">
        <div>
          <span class="prob">${pct(m.probability)}</span>
          <span class="muted small">Yes</span>
        </div>
        <div class="card-stats">
          ${changeBadge(m.change_24h)}
          <span class="muted small mono">${usd(m.volume)} vol</span>
        </div>
      </div>
      <div class="prob-bar"><span style="width: ${(m.probability * 100).toFixed(1)}%"></span></div>
    </article>`).join("");

  // Content renders after load, so re-apply #markets / #movers anchors now that it exists.
  if (window.location.hash) {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView();
  }

  // ---------- Market Map (bubble chart) ----------
  // Hover shows a tooltip; click selects a bubble and shows a summary with a link
  // to the market; clicking the selected bubble again opens it.

  const canvas = document.getElementById("market-map");
  if (!canvas) return;
  if (typeof Chart === "undefined") {
    canvas.parentElement.innerHTML = '<p class="empty">Chart library failed to load.</p>';
    return;
  }
  if (markets.length === 0) {
    canvas.parentElement.innerHTML = '<p class="empty">No markets to plot.</p>';
    return;
  }

  // Bubble area scales with volume: radius ∝ sqrt(volume), clamped to 5–28px.
  const maxVolume = Math.max(...markets.map((m) => m.volume));
  const radius = (volume) => Math.max(5, 28 * Math.sqrt(volume / maxVolume));

  const colorFor = (change) =>
    change > 0 ? token("--up") : change < 0 ? token("--down") : token("--flat");

  const points = markets.map((m) => ({
    x: m.probability * 100,
    y: m.change_24h * 100,
    r: radius(m.volume),
    market: m,
  }));

  const selectionPanel = document.getElementById("map-selection");
  let selected = null; // index into points

  Chart.defaults.font.family = token("--font");
  Chart.defaults.color = token("--text-muted");

  const chart = new Chart(canvas, {
    type: "bubble",
    data: {
      datasets: [{
        data: points,
        // Once something is selected, everything else fades back.
        backgroundColor: (ctx) => {
          const alpha = selected === null || ctx.dataIndex === selected ? "b3" : "33";
          return colorFor(points[ctx.dataIndex].y) + alpha;
        },
        borderColor: (ctx) => (ctx.dataIndex === selected ? token("--text") : token("--surface")),
        borderWidth: (ctx) => (ctx.dataIndex === selected ? 3 : 2), // surface ring separates overlaps
        hoverBorderColor: token("--text"),
        hoverBorderWidth: 2,
        hitRadius: 4, // a little bigger than the mark so small bubbles are easy to hit
      }],
    },
    options: {
      maintainAspectRatio: false,
      layout: { padding: 8 },
      scales: {
        x: {
          min: 0,
          max: 100,
          title: { display: true, text: "Probability (Yes)" },
          ticks: { callback: (v) => `${v}%`, stepSize: 25 },
          grid: { color: token("--border") },
          border: { display: false },
        },
        y: {
          title: { display: true, text: "24h change (pts)" },
          ticks: { callback: (v) => (v > 0 ? `+${v}` : v) },
          grid: {
            // Emphasize the zero line so "up" vs "down" reads instantly.
            color: (ctx) => (ctx.tick && ctx.tick.value === 0 ? token("--text-faint") : token("--border")),
          },
          border: { display: false },
          grace: "15%",
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
          footerColor: token("--text-faint"),
          footerFont: { weight: "normal" },
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => items[0].raw.market.title,
            label: (item) => {
              const m = item.raw.market;
              return [
                `Probability  ${pct(m.probability)}`,
                `24h change   ${pts(m.change_24h)}`,
                `Volume       ${usd(m.volume)}`,
              ];
            },
            footer: (items) => (items[0].dataIndex === selected ? "Click again to open" : "Click to select"),
          },
        },
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
      onClick: (_event, elements) => {
        if (!elements.length) return select(null);
        const index = elements[0].index;
        if (index === selected) {
          window.location.href = marketUrl(points[index].market.id);
        } else {
          select(index);
        }
      },
    },
  });

  function select(index) {
    selected = index;
    chart.update("none");

    if (index === null) {
      selectionPanel.hidden = true;
      return;
    }
    const m = points[index].market;
    selectionPanel.innerHTML = `
      <div class="map-selection-text">
        <span class="category">${escapeHtml(m.category)}</span>
        <a class="map-selection-title" href="${marketUrl(m.id)}">${escapeHtml(m.title)}</a>
        <span class="map-selection-stats">
          <span class="mono">${pct(m.probability)} Yes</span>
          ${changeBadge(m.change_24h)}
          <span class="muted mono">${usd(m.volume)} vol</span>
        </span>
      </div>
      <div class="map-selection-actions">
        <a class="btn" href="${marketUrl(m.id)}">Open market →</a>
        <button class="btn btn-ghost" type="button" aria-label="Clear selection">✕</button>
      </div>`;
    selectionPanel.querySelector("button").addEventListener("click", () => select(null));
    selectionPanel.hidden = false;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selected !== null) select(null);
  });
})();
