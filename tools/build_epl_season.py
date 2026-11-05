#!/usr/bin/env python3
"""Build data/epl-season.json from football-data.co.uk free E0 CSV (2026-27).
Maps short names to the canonical names used in epl-picks.json. No Odds API credits."""
from __future__ import annotations
import csv, datetime as dt, io, json, os, re, sys, urllib.request
from pathlib import Path

OUT = Path(os.environ.get("EPL_SEASON_OUT", "/workspace/probalab-site/data/epl-season.json"))
CSV_URL = "https://www.football-data.co.uk/mmz4281/2627/E0.csv"
CACHE = Path("/workspace/betting/data/raw/epl/footballdatacouk/E0_2026-27.csv")
UA = {"User-Agent": "ProbaLabSeasonBot/1.0 (personal research; scores only)"}

# football-data.co.uk short name -> epl-picks display name
NAME = {
    "Arsenal": "Arsenal", "Aston Villa": "Aston Villa", "Bournemouth": "AFC Bournemouth",
    "Brentford": "Brentford", "Brighton": "Brighton & Hove Albion", "Chelsea": "Chelsea",
    "Coventry": "Coventry City", "Crystal Palace": "Crystal Palace", "Everton": "Everton",
    "Fulham": "Fulham", "Hull": "Hull City", "Ipswich": "Ipswich Town",
    "Leeds": "Leeds United", "Liverpool": "Liverpool", "Man City": "Manchester City",
    "Man United": "Manchester United", "Newcastle": "Newcastle United",
    "Nott'm Forest": "Nottingham Forest", "Sunderland": "Sunderland",
    "Tottenham": "Tottenham Hotspur",
}

def fetch_csv() -> str:
    try:
        req = urllib.request.Request(CSV_URL, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
        # follow redirect manually if needed — urllib follows; just decode
        text = raw.decode("utf-8", errors="replace")
        if "HomeTeam" in text and len(text) > 500:
            CACHE.parent.mkdir(parents=True, exist_ok=True)
            CACHE.write_bytes(raw)
            return text
    except Exception as e:
        print(f"warn download: {type(e).__name__}: {e}", file=sys.stderr)
    if CACHE.exists():
        print(f"using cache {CACHE}", file=sys.stderr)
        return CACHE.read_text(encoding="utf-8", errors="replace")
    raise SystemExit("no EPL CSV available")

def parse_date(s: str) -> str:
    # DD/MM/YYYY
    day, month, year = s.strip().split("/")
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"

def main():
    text = fetch_csv()
    rows = list(csv.DictReader(io.StringIO(text)))
    games = []
    missing = set()
    for r in rows:
        h_raw, a_raw = r.get("HomeTeam", "").strip(), r.get("AwayTeam", "").strip()
        if not h_raw or not a_raw: continue
        if h_raw not in NAME: missing.add(h_raw)
        if a_raw not in NAME: missing.add(a_raw)
        home, away = NAME.get(h_raw, h_raw), NAME.get(a_raw, a_raw)
        try:
            hs, aws = int(r["FTHG"]), int(r["FTAG"])
        except (KeyError, ValueError, TypeError):
            continue
        date = parse_date(r["Date"])
        time_s = (r.get("Time") or "15:00").strip()
        # Times are UK local; store as approximate UTC by tagging Z with the clock time
        # (good enough for ordering; kickoff display uses this). Prefer matching picks later.
        start = f"{date}T{time_s}:00Z" if re.match(r"^\d{1,2}:\d{2}$", time_s) else f"{date}T15:00:00Z"
        ftr = (r.get("FTR") or "").strip()  # H/D/A
        games.append({
            "game_id": f"fd-{date}-{h_raw.replace(' ', '')}-{a_raw.replace(' ', '')}",
            "start_utc": start,
            "home": home, "away": away,
            "home_score": hs, "away_score": aws,
            "status": "post",
            "result": ftr,
            "source_id": "football-data.co.uk",
        })
    if missing:
        print(f"warn unmapped teams: {sorted(missing)}", file=sys.stderr)

    # Overlay ESPN game_ids from epl-picks / epl-grades when date+teams match
    picks_path = OUT.parent / "epl-picks.json"
    if picks_path.exists():
        picks = json.loads(picks_path.read_text())
        idx = {}
        for g in picks:
            key = (g["home"], g["away"], (g.get("start_utc") or "")[:10])
            idx[key] = str(g["game_id"])
            # also by date only with swapped? no
        for g in games:
            key = (g["home"], g["away"], g["start_utc"][:10])
            if key in idx:
                g["game_id"] = idx[key]
                g["matched_pick"] = True

    games.sort(key=lambda x: x["start_utc"])
    payload = {
        "season": 2027,
        "label": "2026–27",
        "source": "football-data.co.uk/mmz4281/2627/E0.csv",
        "updated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "games": games,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    tmp.replace(OUT)
    print(f"wrote {OUT} ({len(games)} finished matches)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
