const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const searchHeadingText = document.getElementById("search-heading-text");

const stepSearch = document.getElementById("step-search");
const stepSeason = document.getElementById("step-season");
const stepStats = document.getElementById("step-stats");
const stepResult = document.getElementById("step-result");

const seasonForm = document.getElementById("season-form");
const seasonInput = document.getElementById("season-input");
const seasonHeadingText = document.getElementById("season-heading-text");
const selectedPlayerName = document.getElementById("selected-player-name");
const backToSearchBtn = document.getElementById("back-to-search");

const statsContent = document.getElementById("stats-content");
const playAgainBtn = document.getElementById("play-again");

const gameBanner = document.getElementById("game-banner");
const gameCta = document.getElementById("game-cta");
const playGameBtn = document.getElementById("play-game-btn");
const gameInstructions = document.getElementById("game-instructions");
const resultContent = document.getElementById("result-content");
const restartGameBtn = document.getElementById("restart-game-btn");

const loading = document.getElementById("loading");
const errorBanner = document.getElementById("error-banner");

let selectedPlayer = null; // player currently being searched for / viewed
let lastStatsData = null; // most recently fetched stats payload

// When non-null, we're mid stat-battle: { statKey, statLabel, p1Name, p1Value }
let game = null;
let awaitingStatSelection = false;

function showStep(step) {
  [stepSearch, stepSeason, stepStats, stepResult].forEach((s) => s.classList.add("hidden"));
  step.classList.remove("hidden");
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}

function clearError() {
  errorBanner.classList.add("hidden");
  errorBanner.textContent = "";
}

function setLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
}

function updateGameBanner() {
  if (game) {
    gameBanner.textContent =
      `🏀 Stat Battle: beat ${game.p1Name}'s ${game.statLabel} of ${formatStat(game.p1Value)}`;
    gameBanner.classList.remove("hidden");
    searchHeadingText.textContent = "Find a Challenger — Player 2";
    seasonHeadingText.textContent = "Player 2's Lineup";
  } else {
    gameBanner.classList.add("hidden");
    searchHeadingText.textContent = "Tip-Off — Find Your Player";
    seasonHeadingText.textContent = "Starting Lineup";
  }
}

function resetGame() {
  game = null;
  awaitingStatSelection = false;
  document.body.classList.remove("picking-stat");
  gameCta.classList.add("hidden");
  gameInstructions.classList.add("hidden");
  updateGameBanner();
}

async function fetchJSON(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (networkErr) {
    throw new Error("Couldn't reach the server. Is app.py still running?");
  }

  let body;
  try {
    body = await response.json();
  } catch (parseErr) {
    throw new Error("Got an unreadable response from the server.");
  }

  if (!response.ok) {
    throw new Error(body.error || `Request failed (HTTP ${response.status}).`);
  }
  return body;
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  searchResults.innerHTML = "";

  const name = searchInput.value.trim();
  if (!name) {
    showError("Type a player name to search for.");
    return;
  }

  setLoading(true);
  try {
    const data = await fetchJSON(`/api/search?name=${encodeURIComponent(name)}`);
    renderSearchResults(data.players || []);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

function renderSearchResults(players) {
  if (players.length === 0) {
    searchResults.innerHTML = `<p class="empty-note">No players found. Try a different name.</p>`;
    return;
  }

  searchResults.innerHTML = "";
  players.forEach((player) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "player-card";
    card.innerHTML = `
      <span>${player.full_name}</span>
      <span class="badge ${player.is_active ? "active" : "retired"}">
        ${player.is_active ? "Active" : "Retired"}
      </span>
    `;
    card.addEventListener("click", () => selectPlayer(player));
    searchResults.appendChild(card);
  });
}

function selectPlayer(player) {
  selectedPlayer = player;
  selectedPlayerName.textContent = player.full_name;
  seasonInput.value = "";
  clearError();
  showStep(stepSeason);
}

backToSearchBtn.addEventListener("click", () => {
  clearError();
  showStep(stepSearch);
});

seasonForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const year = seasonInput.value.trim();
  if (!year) {
    showError("Enter a season start year, e.g. 2023.");
    return;
  }

  setLoading(true);
  try {
    const data = await fetchJSON(
      `/api/player/${selectedPlayer.id}/stats?season_start_year=${encodeURIComponent(year)}`
    );

    if (game) {
      handleChallengerStats(data);
    } else {
      lastStatsData = data;
      renderStats(data);
      showStep(stepStats);
    }
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

function renderStats(data) {
  const { season, season_averages, recent_games, rolling_averages } = data;
  let html = `<p><strong>${selectedPlayer.full_name}</strong> — ${season} season</p>`;

  if (season_averages) {
    html += `
      <h3 class="section-title">Season Averages (${season_averages.TEAM_ABBREVIATION}, ${season_averages.GP} GP)</h3>
      <div class="scoreboard">
        ${statTile("PTS", season_averages.PTS, "PTS")}
        ${statTile("REB", season_averages.REB, "REB")}
        ${statTile("AST", season_averages.AST, "AST")}
        ${statTile("MIN", season_averages.MIN)}
      </div>
    `;
  } else {
    html += `<p class="empty-note">No season averages found for ${season} (player may not have played that season).</p>`;
  }

  if (recent_games && recent_games.length > 0) {
    html += `<h3 class="section-title">Last ${recent_games.length} Games</h3>`;
    html += `
      <table class="game-log">
        <thead>
          <tr><th>Date</th><th>Matchup</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th></tr>
        </thead>
        <tbody>
          ${recent_games
            .map(
              (g) => `
            <tr>
              <td>${g.GAME_DATE}</td>
              <td>${g.MATCHUP}</td>
              <td>${g.MIN}</td>
              <td>${g.PTS}</td>
              <td>${g.REB}</td>
              <td>${g.AST}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  } else {
    html += `<p class="empty-note">No game logs found for ${season}.</p>`;
  }

  if (rolling_averages) {
    html += `
      <h3 class="section-title">Rolling Averages (last ${recent_games.length} games)</h3>
      <div class="scoreboard">
        ${statTile("PTS", rolling_averages.pts)}
        ${statTile("REB", rolling_averages.reb)}
        ${statTile("AST", rolling_averages.ast)}
      </div>
    `;
  }

  statsContent.innerHTML = html;

  // "Play Game" only makes sense if we actually have season averages to challenge with.
  if (season_averages) {
    gameCta.classList.remove("hidden");
  } else {
    gameCta.classList.add("hidden");
  }
  gameInstructions.classList.add("hidden");
  awaitingStatSelection = false;
  document.body.classList.remove("picking-stat");
}

function statTile(label, value, statKey) {
  const display = formatStat(value);
  const dataAttr = statKey ? ` data-stat="${statKey}" data-label="${label}"` : "";
  return `
    <div${dataAttr}>
      <div class="stat-value">${display}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

function formatStat(value) {
  return typeof value === "number" ? value.toFixed(1) : value;
}

// Event delegation: stats-content is re-rendered on every lookup, so we
// listen once on the container instead of re-binding after each render.
statsContent.addEventListener("click", (event) => {
  if (!awaitingStatSelection) return;
  const tile = event.target.closest("[data-stat]");
  if (!tile || !lastStatsData || !lastStatsData.season_averages) return;

  const statKey = tile.dataset.stat;
  const statLabel = tile.dataset.label;
  const p1Value = lastStatsData.season_averages[statKey];

  game = {
    statKey,
    statLabel,
    p1Name: selectedPlayer.full_name,
    p1Value,
  };

  awaitingStatSelection = false;
  document.body.classList.remove("picking-stat");
  gameInstructions.classList.add("hidden");

  selectedPlayer = null;
  searchInput.value = "";
  searchResults.innerHTML = "";
  clearError();
  updateGameBanner();
  showStep(stepSearch);
});

playGameBtn.addEventListener("click", () => {
  awaitingStatSelection = true;
  document.body.classList.add("picking-stat");
  gameCta.classList.add("hidden");
  gameInstructions.classList.remove("hidden");
});

function handleChallengerStats(data) {
  const { season_averages } = data;

  if (!season_averages) {
    showError(
      `No season averages found for ${selectedPlayer.full_name} in ${data.season}. ` +
      `Try a different season.`
    );
    return;
  }

  const p2Value = season_averages[game.statKey];
  const p1Value = game.p1Value;

  let outcome;
  if (p2Value > p1Value) {
    outcome = "win";
  } else if (p2Value === p1Value) {
    outcome = "tie";
  } else {
    outcome = "lose";
  }

  renderResult({
    p1Name: game.p1Name,
    p1Value,
    p2Name: selectedPlayer.full_name,
    p2Value,
    statLabel: game.statLabel,
    outcome,
  });

  showStep(stepResult);
}

function renderResult({ p1Name, p1Value, p2Name, p2Value, statLabel, outcome }) {
  const banners = {
    win: `🏆 YOU WIN! ${p2Name} beats ${p1Name} in ${statLabel}!`,
    lose: `💀 YOU LOSE. ${p2Name} couldn't top ${p1Name} in ${statLabel}.`,
    tie: `🤝 IT'S A TIE in ${statLabel}! Ties go to the original player.`,
  };

  resultContent.innerHTML = `
    <div class="result-banner ${outcome}">${banners[outcome]}</div>
    <div class="result-detail">
      <div class="result-card">
        <div class="name">${p1Name}</div>
        <div class="value">${formatStat(p1Value)}</div>
        <div class="stat-label">${statLabel}</div>
      </div>
      <div class="result-card">
        <div class="name">${p2Name}</div>
        <div class="value">${formatStat(p2Value)}</div>
        <div class="stat-label">${statLabel}</div>
      </div>
    </div>
  `;
}

restartGameBtn.addEventListener("click", () => {
  resetGame();
  selectedPlayer = null;
  lastStatsData = null;
  searchInput.value = "";
  searchResults.innerHTML = "";
  clearError();
  showStep(stepSearch);
});

playAgainBtn.addEventListener("click", () => {
  resetGame();
  clearError();
  searchInput.value = "";
  searchResults.innerHTML = "";
  selectedPlayer = null;
  showStep(stepSearch);
});
