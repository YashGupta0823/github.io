// MarketLens API client: the only file that knows where market data comes from.
//
// Leave API_BASE_URL empty to use the bundled mock data (works on GitHub Pages
// and when opening the HTML files directly). Once the Flask backend is deployed,
// set it to the backend's origin, e.g. "https://marketlens-api.onrender.com".
//
// Never put API keys or secrets in this file: everything here is public.

window.MarketLens = window.MarketLens || {};

(function (ML) {
  const API_BASE_URL = "";

  function mockMarkets() {
    return ML.MOCK_MARKETS.map((m) => ({ ...m }));
  }

  async function getJson(path) {
    const res = await fetch(API_BASE_URL + path, { headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`MarketLens API ${res.status} for ${path}`);
    return res.json();
  }

  /** All active markets, plus whether they are placeholder data. Mirrors GET /api/markets. */
  async function getMarkets() {
    if (!API_BASE_URL) return { markets: mockMarkets(), sampleData: true };
    try {
      const data = await getJson("/api/markets");
      return { markets: data.markets, sampleData: Boolean(data.sample_data) };
    } catch (err) {
      console.warn("Backend unavailable, falling back to sample data.", err);
      return { markets: mockMarkets(), sampleData: true };
    }
  }

  /** One market by id, or null if it doesn't exist. Mirrors GET /api/markets/<id>. */
  async function getMarket(id) {
    const fromMock = () => mockMarkets().find((m) => m.id === id) || null;
    if (!API_BASE_URL) return fromMock();
    try {
      const data = await getJson(`/api/markets/${encodeURIComponent(id)}`);
      return data ? data.market : null;
    } catch (err) {
      console.warn("Backend unavailable, falling back to sample data.", err);
      return fromMock();
    }
  }

  ML.api = { API_BASE_URL, getMarkets, getMarket };
})(window.MarketLens);
