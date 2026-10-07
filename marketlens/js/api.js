// MarketLens API client: the only file that knows where market data comes from.
//
// PRODUCTION_API_URL is the Flask backend (marketlens-backend/) deployed on Render.
// If it is empty, or the backend can't be reached, the site falls back to the
// bundled sample data in mock-data.js and labels it "Demo data".
//
// Local development only: open a page with ?api=<url> (e.g. ?api=http://127.0.0.1:5001
// for a local Flask server) to point this browser tab at another backend. The override
// is ignored everywhere except localhost, so nobody can repoint the public site.
//
// Never put API keys or secrets in this file: everything here is public.

window.MarketLens = window.MarketLens || {};

(function (ML) {
  const PRODUCTION_API_URL = "https://marketlens-api-p707.onrender.com";

  const isLocalPage = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  function localOverride() {
    if (!isLocalPage) return null;
    try {
      const fromQuery = new URLSearchParams(window.location.search).get("api");
      if (fromQuery !== null) sessionStorage.setItem("marketlens-api", fromQuery); // persists across pages in this tab
      return sessionStorage.getItem("marketlens-api");
    } catch {
      return null; // storage blocked: just use production
    }
  }

  const API_BASE_URL = (localOverride() || PRODUCTION_API_URL).replace(/\/+$/, "");

  // Render's free tier sleeps when idle and takes up to about a minute to wake, so
  // wait that long before falling back to sample data. An awake backend answers in
  // well under a second, and a refused connection fails immediately, so this only
  // matters during a cold start.
  const REQUEST_TIMEOUT_MS = 70000;

  function mockMarkets() {
    return ML.MOCK_MARKETS.map((m) => ({ ...m }));
  }

  const isSampleId = (id) => id.startsWith("sample-");

  async function getJson(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE_URL + path, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`MarketLens API ${res.status} for ${path}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Each request is cached for the page's lifetime, so the dashboard and detail
  // page can ask for the same data from several places without refetching.
  const requests = new Map();
  function cachedJson(path) {
    if (!requests.has(path)) {
      const request = getJson(path);
      request.catch(() => requests.delete(path)); // let a failed request be retried
      requests.set(path, request);
    }
    return requests.get(path);
  }

  /** Active markets, plus whether they are placeholder data. Mirrors GET /api/markets. */
  async function getMarkets() {
    if (!API_BASE_URL) return { markets: mockMarkets(), sampleData: true };
    try {
      const data = await cachedJson("/api/markets?limit=60");
      return {
        markets: data.markets,
        sampleData: Boolean(data.sample_data),
        updatedAt: data.updated_at,
        stale: Boolean(data.stale),
      };
    } catch (err) {
      console.warn("Backend unavailable, falling back to sample data.", err);
      return { markets: mockMarkets(), sampleData: true };
    }
  }

  /** One market by id (a Kalshi ticker), or null if it doesn't exist. Mirrors GET /api/markets/<id>. */
  async function getMarket(id) {
    const fromMock = () => mockMarkets().find((m) => m.id === id) || null;
    if (!API_BASE_URL || isSampleId(id)) return fromMock();
    try {
      const data = await cachedJson(`/api/markets/${encodeURIComponent(id)}`);
      return data ? data.market : null;
    } catch (err) {
      console.warn("Backend unavailable, falling back to sample data.", err);
      return fromMock();
    }
  }

  // The calls below have no sample-data equivalent: they return null without a backend,
  // and the page shows an explanatory empty state rather than invented numbers.

  /** Probability history from Kalshi candlesticks. range: "1d" | "7d" | "30d" | "90d". */
  async function getHistory(id, range = "7d") {
    if (!API_BASE_URL || isSampleId(id)) return null;
    try {
      return await cachedJson(`/api/markets/${encodeURIComponent(id)}/history?range=${range}`);
    } catch (err) {
      console.warn("Could not load price history.", err);
      return null;
    }
  }

  /** Top of the order book in YES terms: { bids, asks, best_bid, best_ask, spread }. */
  async function getOrderbook(id) {
    if (!API_BASE_URL || isSampleId(id)) return null;
    try {
      return await cachedJson(`/api/markets/${encodeURIComponent(id)}/orderbook?depth=6`);
    } catch (err) {
      console.warn("Could not load order book.", err);
      return null;
    }
  }

  /** Backend analytics: { gainers, losers, biggest, top_volume, most_volatile }. */
  async function getMovers() {
    if (!API_BASE_URL) return null;
    try {
      return await cachedJson("/api/movers?limit=5");
    } catch (err) {
      console.warn("Could not load movers.", err);
      return null;
    }
  }

  ML.api = { API_BASE_URL, getMarkets, getMarket, getHistory, getOrderbook, getMovers };
})(window.MarketLens);
