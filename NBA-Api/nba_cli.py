"""
Command-line tool for looking up NBA players via the `nba_api` package
and viewing their season averages, recent game logs, and rolling averages.

Run with:  python nba_cli.py
"""

from datetime import datetime

from nba_client import ApiError, NbaClient, season_string

ROLLING_WINDOW = 5  # number of most recent games to average over


def prompt(text):
    """input() wrapper that turns Ctrl+C / Ctrl+D into a clean exit."""
    try:
        return input(text)
    except (KeyboardInterrupt, EOFError):
        print("\nGoodbye!")
        raise SystemExit(0)


def choose_season():
    default_start_year = datetime.now().year - 1
    raw = prompt(
        f"Season to look up (year the season started, e.g. 2023 for 2023-24) "
        f"[default {default_start_year}]: "
    ).strip()
    if not raw:
        return season_string(default_start_year)
    try:
        return season_string(int(raw))
    except ValueError:
        print(f"'{raw}' isn't a valid year, using {default_start_year} instead.")
        return season_string(default_start_year)


def search_and_pick_player(client):
    name = prompt("\nSearch for a player by name (or 'q' to quit): ").strip()
    if name.lower() in ("q", "quit", "exit"):
        return None
    if not name:
        print("Please enter a name to search for.")
        return None

    try:
        players = client.search_players(name)
    except ApiError as exc:
        print(f"Search failed: {exc}")
        return None

    if not players:
        print(f"No players found matching '{name}'. Try a different name.")
        return None

    print(f"\nFound {len(players)} player(s):")
    for i, p in enumerate(players, start=1):
        status = "Active" if p.get("is_active") else "Retired"
        print(f"  {i}. {p['full_name']} ({status})")

    choice = prompt(f"Select a player [1-{len(players)}] (or Enter to search again): ").strip()
    if not choice:
        return None
    try:
        index = int(choice) - 1
        if not (0 <= index < len(players)):
            raise ValueError
    except ValueError:
        print("Invalid selection.")
        return None

    return players[index]


def show_season_averages(client, player, season):
    try:
        row = client.get_career_season_averages(player["id"], season)
    except ApiError as exc:
        print(f"Could not fetch season averages: {exc}")
        return

    if row is None:
        print(f"No season averages found for {season} "
              f"(player may not have played that season).")
        return

    print(f"\n{season} season averages "
          f"({row.get('TEAM_ABBREVIATION', '?')}, {row.get('GP', '?')} games played):")
    print(f"  PTS: {row.get('PTS', 0):.1f}  "
          f"REB: {row.get('REB', 0):.1f}  "
          f"AST: {row.get('AST', 0):.1f}  "
          f"MIN: {row.get('MIN', 0):.1f}")


def show_recent_games_and_rolling_averages(client, player, season):
    try:
        recent = client.get_recent_games(player["id"], season, limit=ROLLING_WINDOW)
    except ApiError as exc:
        print(f"Could not fetch game logs: {exc}")
        return

    if not recent:
        print(f"No game logs found for {season}.")
        return

    print(f"\nLast {len(recent)} game(s):")
    print(f"  {'DATE':<13}{'MATCHUP':<12}{'MIN':<5}{'PTS':<5}{'REB':<5}{'AST':<5}")
    for g in recent:
        print(
            f"  {g.get('GAME_DATE', '-'): <13}{g.get('MATCHUP', '-'):<12}"
            f"{g.get('MIN', 0):<5}{g.get('PTS', 0):<5}{g.get('REB', 0):<5}{g.get('AST', 0):<5}"
        )

    def rolling_avg(field):
        values = [g.get(field, 0) or 0 for g in recent]
        return sum(values) / len(values) if values else 0.0

    print(f"\nRolling averages (last {len(recent)} games):")
    print(f"  PTS: {rolling_avg('PTS'):.1f}  "
          f"REB: {rolling_avg('REB'):.1f}  "
          f"AST: {rolling_avg('AST'):.1f}")


def main():
    print("=== NBA Player Stats CLI (nba_api / stats.nba.com) ===")
    client = NbaClient()

    while True:
        player = search_and_pick_player(client)
        if player is None:
            again = prompt("Search again? [y/N]: ").strip().lower()
            if again != "y":
                print("Goodbye!")
                return
            continue

        print(f"\nSelected: {player['full_name']}")
        season = choose_season()
        show_season_averages(client, player, season)
        show_recent_games_and_rolling_averages(client, player, season)

        again = prompt("\nLook up another player? [y/N]: ").strip().lower()
        if again != "y":
            print("Goodbye!")
            return


if __name__ == "__main__":
    main()
