"""
Thin wrapper around the `nba_api` package (https://github.com/swar/nba_api),
which itself talks to the official stats.nba.com endpoints. No API key is
required — nba_api is a client library, not a hosted API with its own auth.

Player search is done against nba_api's bundled static player list (no
network call at all). Career/season stats and game logs make a live call
to stats.nba.com, which is unofficial and can be slow or occasionally
flaky, so calls are throttled and failures are translated into friendly
messages instead of raw tracebacks.
"""

import re
import time
from datetime import datetime

from requests.exceptions import RequestException
from nba_api.stats.static import players as static_players
from nba_api.stats.endpoints import playercareerstats, playergamelog

MIN_REQUEST_INTERVAL = 0.6  # seconds between live stats.nba.com calls
REQUEST_TIMEOUT = 30  # stats.nba.com can be slow to respond


class ApiError(Exception):
    """Base class for all API-related failures the CLI should handle."""


class NetworkError(ApiError):
    pass


def season_string(start_year):
    """Turns 2023 into '2023-24', matching nba_api's season format."""
    return f"{start_year}-{str((start_year + 1) % 100).zfill(2)}"


class _Throttle:
    """Keeps a minimum gap between live requests to stats.nba.com."""

    def __init__(self, min_interval=MIN_REQUEST_INTERVAL):
        self.min_interval = min_interval
        self._last_call = 0.0

    def wait(self):
        elapsed = time.monotonic() - self._last_call
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self._last_call = time.monotonic()


class NbaClient:
    def __init__(self):
        self._throttle = _Throttle()

    def search_players(self, name):
        """Local, offline search against nba_api's bundled player list."""
        query = name.strip()
        if not query:
            return []
        try:
            return static_players.find_players_by_full_name(re.escape(query))
        except Exception as exc:
            raise ApiError(f"Player search failed unexpectedly: {exc}") from exc

    def _call(self, endpoint_cls, **kwargs):
        self._throttle.wait()
        try:
            return endpoint_cls(timeout=REQUEST_TIMEOUT, **kwargs)
        except RequestException as exc:
            raise NetworkError(
                "Could not reach stats.nba.com (it can be slow or briefly "
                "unavailable — this is an unofficial API). Please try again "
                "in a moment."
            ) from exc
        except Exception as exc:
            raise ApiError(
                f"stats.nba.com returned something unexpected ({exc}). "
                "Try again in a moment."
            ) from exc

    def get_career_season_averages(self, player_id, season):
        """Returns the per-game stat dict for one regular season, or None."""
        endpoint = self._call(
            playercareerstats.PlayerCareerStats,
            player_id=player_id,
            per_mode36="PerGame",
        )
        seasons = endpoint.get_normalized_dict().get("SeasonTotalsRegularSeason", [])
        for row in seasons:
            if row.get("SEASON_ID") == season:
                return row
        return None

    def get_recent_games(self, player_id, season, limit=5):
        """Returns up to `limit` most recent regular-season game logs."""
        endpoint = self._call(
            playergamelog.PlayerGameLog,
            player_id=player_id,
            season=season,
            season_type_all_star="Regular Season",
        )
        games = endpoint.get_normalized_dict().get("PlayerGameLog", [])

        def game_date(row):
            try:
                return datetime.strptime(row["GAME_DATE"], "%b %d, %Y")
            except (KeyError, ValueError):
                return datetime.min

        games.sort(key=game_date, reverse=True)
        return games[:limit]
