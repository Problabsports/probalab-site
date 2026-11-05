#!/usr/bin/env python3
"""Build data/nhl-season.json from the free NHL web API (api-web.nhle.com).
Regular-season finished games only. No Odds API credits.
Walks /v1/score/{date} from season open through tomorrow (UTC)."""
from __future__ import annotations
import datetime as dt, json, os, sys, time, urllib.error, urllib.request
from pathlib import Path

OUT = Path(os.environ.get("NHL_SEASON_OUT", "/workspace/probalab-site/data/nhl-season.json"))
UA = {"User-Agent": "ProbaLabSeasonBot/1.0 (personal research; scores only)", "Accept": "application/json"}
SEASON_START = dt.date(2026, 9, 29)  # 2026-27 NHL regular season (early open)  # 2026-27 NHL regular season open
PAUSE = float(os.environ.get("NHL_SEASON_PAUSE", "0.08"))

def get(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.load(r)

def main():
    today = dt.datetime.now(dt.timezone.utc).date()
    end = today + dt.timedelta(days=1)
    games = {}
    d = SEASON_START
    fails = 0
    while d <= end:
        url = f"https://api-web.nhle.com/v1/score/{d.isoformat()}"
        try:
            data = get(url)
            fails = 0
        except Exception as e:
            fails += 1
            print(f"warn {d}: {type(e).__name__}", file=sys.stderr)
            if fails >= 5:
                print("too many failures; abort", file=sys.stderr); return 1
            time.sleep(1); d += dt.timedelta(days=1); continue
        for g in data.get("games") or []:
            if g.get("gameType") != 2:  # regular season
                continue
            if g.get("gameState") not in ("OFF", "FINAL"):
                continue
            hid = g.get("id")
            if hid is None: continue
            home, away = g.get("homeTeam") or {}, g.get("awayTeam") or {}
            hs, aws = home.get("score"), away.get("score")
            if hs is None or aws is None: continue
            outcome = (g.get("gameOutcome") or {}).get("lastPeriodType") or "REG"
            games[str(hid)] = {
                "game_id": str(hid),
                "start_utc": g.get("startTimeUTC") or f"{d.isoformat()}T00:00:00Z",
                "home": home.get("abbrev"),
                "away": away.get("abbrev"),
                "home_score": int(hs),
                "away_score": int(aws),
                "status": "post",
                "result_type": outcome,  # REG | OT | SO
            }
        time.sleep(PAUSE)
        d += dt.timedelta(days=1)

    rows = sorted(games.values(), key=lambda x: x["start_utc"])
    payload = {
        "season": 2027,
        "label": "2026–27",
        "source": "api-web.nhle.com/v1/score",
        "updated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "games": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    tmp.replace(OUT)
    print(f"wrote {OUT} ({len(rows)} finished regular-season games)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
