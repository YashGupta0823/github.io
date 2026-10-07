"""Gunicorn settings, loaded automatically by `gunicorn app:app` from this directory.

- One worker: the market cache lives in memory, so a single process keeps one shared
  cache and one stream of requests to Kalshi (which rate-limits by IP).
- Threads: while one request waits on a cold market load, other requests (including
  Render's health checks) are still served.
- Timeout: a cold load of every tracked Kalshi series takes ~20s on Render, too close
  to gunicorn's default 30s limit.
- The cache warm-up thread starts in post_fork, inside the worker. Render runs gunicorn
  with --preload, which imports app.py in the master process before forking; a thread
  started at import would run in the master and could leave the worker with a lock
  that is held forever, hanging every market request.
"""

import os

bind = f"0.0.0.0:{os.getenv('PORT', '10000')}"
workers = 1
threads = 4
timeout = 120


def post_fork(server, worker):
    from services import kalshi_api

    kalshi_api.warm_cache()
