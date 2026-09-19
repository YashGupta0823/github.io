"""
Flask web app version of the NBA Player Stats tool. Same three questions
as the CLI (search a player, pick one, pick a season) — just asked
through a basketball-themed web page instead of a terminal prompt.

Run with:  python app.py
Then open: http://127.0.0.1:5050
"""

from flask import Flask, jsonify, request, send_from_directory

from nba_client import ApiError, NbaClient, season_string

app = Flask(__name__, static_folder="static", static_url_path="")
client = NbaClient()


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/search")
def api_search():
    name = request.args.get("name", "")
    if not name.strip():
        return jsonify({"error": "Type a player name to search for."}), 400

    try:
        players = client.search_players(name)
    except ApiError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"players": players})


@app.route("/api/player/<int:player_id>/stats")
def api_player_stats(player_id):
    raw_year = request.args.get("season_start_year", "")
    try:
        start_year = int(raw_year)
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid 4-digit season year, e.g. 2023."}), 400

    season = season_string(start_year)

    try:
        season_averages = client.get_career_season_averages(player_id, season)
        recent_games = client.get_recent_games(player_id, season, limit=5)
    except ApiError as exc:
        return jsonify({"error": str(exc)}), 502

    rolling_averages = None
    if recent_games:
        def avg(field):
            values = [g.get(field, 0) or 0 for g in recent_games]
            return sum(values) / len(values)

        rolling_averages = {
            "pts": avg("PTS"),
            "reb": avg("REB"),
            "ast": avg("AST"),
        }

    return jsonify({
        "season": season,
        "season_averages": season_averages,
        "recent_games": recent_games,
        "rolling_averages": rolling_averages,
    })


@app.errorhandler(404)
def not_found(_exc):
    return jsonify({"error": "Not found."}), 404


@app.errorhandler(500)
def server_error(_exc):
    return jsonify({"error": "Something went wrong on the server. Please try again."}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5050)
