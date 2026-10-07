// Placeholder markets used when no backend is configured (or it is unreachable).
// Mirrors SAMPLE_MARKETS in services/market_api.py and uses the same normalized shape.

window.MarketLens = window.MarketLens || {};

window.MarketLens.MOCK_MARKETS = [
  { id: "sample-fed-dec-cut", title: "Will the Fed cut rates at its December 2026 meeting?",
    category: "Economics", probability: 0.62, change_24h: 0.071, volume: 18400000, end_date: "2026-12-16" },
  { id: "sample-house-2026", title: "Will Democrats win the House in the 2026 midterms?",
    category: "Politics", probability: 0.71, change_24h: 0.018, volume: 46900000, end_date: "2026-11-03" },
  { id: "sample-senate-2026", title: "Will Republicans keep control of the Senate after the 2026 midterms?",
    category: "Politics", probability: 0.66, change_24h: -0.024, volume: 31200000, end_date: "2026-11-03" },
  { id: "sample-btc-150k", title: "Will Bitcoin close above $150k on December 31, 2026?",
    category: "Crypto", probability: 0.14, change_24h: -0.052, volume: 22700000, end_date: "2026-12-31" },
  { id: "sample-recession-2026", title: "Will the US enter a recession in 2026?",
    category: "Economics", probability: 0.19, change_24h: -0.009, volume: 9800000, end_date: "2026-12-31" },
  { id: "sample-cpi-oct", title: "Will October 2026 CPI (YoY) come in above 3.0%?",
    category: "Economics", probability: 0.38, change_24h: 0.043, volume: 3100000, end_date: "2026-11-12" },
  { id: "sample-world-series-g7", title: "Will the 2026 World Series go to Game 7?",
    category: "Sports", probability: 0.24, change_24h: 0.006, volume: 2400000, end_date: "2026-11-05" },
  { id: "sample-starship-orbit", title: "Will Starship complete a full orbital flight before 2027?",
    category: "Science", probability: 0.47, change_24h: -0.081, volume: 5600000, end_date: "2026-12-31" },
  { id: "sample-nvda-largest", title: "Will NVIDIA be the largest company by market cap on Dec 31, 2026?",
    category: "Tech", probability: 0.58, change_24h: 0.012, volume: 7300000, end_date: "2026-12-31" },
  { id: "sample-eth-5k", title: "Will ETH trade above $5,000 at any point in November 2026?",
    category: "Crypto", probability: 0.21, change_24h: 0.034, volume: 4900000, end_date: "2026-11-30" },
  { id: "sample-ai-model-release", title: "Will a major AI lab release a new frontier model before December 2026?",
    category: "Tech", probability: 0.83, change_24h: -0.015, volume: 1800000, end_date: "2026-11-30" },
  { id: "sample-hurricane-cat5", title: "Will a Category 5 hurricane make US landfall in 2026?",
    category: "Science", probability: 0.07, change_24h: -0.003, volume: 950000, end_date: "2026-11-30" },
];
