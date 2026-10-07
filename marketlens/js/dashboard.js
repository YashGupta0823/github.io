// MarketLens dashboard: renders metrics, movers, and market cards from the API,
// then wires up search/category filtering and the Market Map chart.

(async function () {
  const ML = window.MarketLens;
  const { pct, usd, escapeHtml, changeBadge, marketUrl } = ML.format;

  const { markets: rawMarkets, sampleData } = await ML.api.getMarkets();
  const markets = ML.analytics.rankByVolume(rawMarkets);

  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();

  // ---------- Render (previously done by templates/index.html) ----------

  document.getElementById("sample-pill").hidden = !sampleData;

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

  const movers = ML.analytics.biggestMovers(markets, 5);
  document.getElementById("movers-body").innerHTML = movers.length
    ? `<ol class="movers">${movers.map((m) => `
        <li>
          <a href="${marketUrl(m.id)}">
            <span class="mover-title">${escapeHtml(m.title)}</span>
            <span class="mover-meta">
              <span class="mono">${pct(m.probability)}</span>
              ${changeBadge(m.change_24h)}
            </span>
          </a>
        </li>`).join("")}</ol>`
    : '<p class="empty">No market movement to show yet.</p>';

  const categories = [...new Set(markets.map((m) => m.category))].sort();
  document.getElementById("category-chips").insertAdjacentHTML("beforeend", categories
    .map((c) => `<button class="chip" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join(""));

  document.getElementById("market-grid").innerHTML = markets.map((m) => `
    <article class="card" data-title="${escapeHtml(m.title.toLowerCase())}" data-category="${escapeHtml(m.category)}">
      <a class="card-link" href="${marketUrl(m.id)}" aria-label="${escapeHtml(m.title)}"></a>
      <div class="card-top">
        <span class="category">${escapeHtml(m.category)}</span>
        <button class="watch-btn" type="button" title="Watchlist coming in the next step" aria-label="Add to watchlist">☆</button>
      </div>
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

  // ---------- Search + category filter ----------

  const searchInput = document.getElementById("search-input");
  const cards = document.querySelectorAll("#market-grid .card");
  const chips = document.querySelectorAll(".chip");
  const noResults = document.getElementById("no-results");
  let activeCategory = "";

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const matchesText = card.dataset.title.includes(query);
      const matchesCategory = !activeCategory || card.dataset.category === activeCategory;
      const show = matchesText && matchesCategory;
      card.hidden = !show;
      if (show) visible++;
    });
    noResults.hidden = visible > 0;
  }

  // On the dashboard, search filters live instead of submitting the form.
  searchInput.closest("form").addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("markets").scrollIntoView();
  });
  searchInput.addEventListener("input", applyFilters);

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeCategory = chip.dataset.category;
      applyFilters();
    });
  });

  applyFilters(); // honors ?q= from other pages

  // ---------- Market Map (bubble chart) ----------

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

  const formatUsd = (v) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`;

  Chart.defaults.font.family = token("--font");
  Chart.defaults.color = token("--text-muted");

  new Chart(canvas, {
    type: "bubble",
    data: {
      datasets: [{
        data: points,
        backgroundColor: points.map((p) => colorFor(p.y) + "b3"), // ~70% opacity
        borderColor: token("--surface"),                          // 2px surface ring separates overlaps
        borderWidth: 2,
        hoverBorderColor: token("--text"),
        hoverBorderWidth: 2,
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
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => items[0].raw.market.title,
            label: (item) => {
              const m = item.raw.market;
              const sign = m.change_24h > 0 ? "+" : "";
              return [
                `Probability  ${(m.probability * 100).toFixed(0)}%`,
                `24h change   ${sign}${(m.change_24h * 100).toFixed(1)} pts`,
                `Volume       ${formatUsd(m.volume)}`,
              ];
            },
          },
        },
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const market = points[elements[0].index].market;
        window.location.href = marketUrl(market.id);
      },
    },
  });
})();
