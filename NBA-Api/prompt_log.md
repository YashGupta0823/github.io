Prompt 1
Build a Python script using the balldontlie NBA API. Load the API key securely from a .env file, create an interactive CLI to search for players and display season stats, recent games, and rolling averages.

Created the initial CLI structure, API client, environment variable setup, rate limit handling, and documentation. But some required balldontlie statistics endpoints were unavailable on the free API tier.

Prompt 2
Instead of the balldontlie API, integrate the nba_api Python package from https://github.com/swar/nba_api, removing the API-key requirement. Player search should use the package local player database, and career statistics and game logs are taken from stats.nba.com.

Prompt 3
Make this a web-based game/application with the same questions as the CLI, but presented on a basketball-themed webpage. Add a basketball theme and the web app should allow users to search for a player, select a season, view season averages, recent games, rolling averages.

Prompt 4
After a player's stats are shown, add a "Play Game" option where the user selects PTS, REB, or AST, searches for a second player, and compares the same statistic. If the second player's value is higher, they win otherwise they lose or tie.
