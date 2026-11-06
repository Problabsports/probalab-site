#!/usr/bin/env python3
"""Build data/market-implied.json from odds already on the box (comparison CSVs + Odds API caches).

No Odds API calls. Prefer Pinnacle h2h when present, else a consensus of book h2h prices.
Writes market chances (0-1) only — never book names or decimal prices.
"""
from __future__ import annotations

import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("MARKET_IMPLIED_OUT", ROOT / "data" / "market-implied.json"))
BETTING = Path(os.environ.get("BETTING_ROOT", "/workspace/betting"))

NBA_CSV = BETTING / "odds/nba/comparison_today.csv"
NFL_CSV = BETTING / "odds/nfl/comparison_this_week.csv"
EPL_CSV = BETTING / "odds/epl/comparison_this_round.csv"
NHL_CACHE = BETTING / "odds/cache/oddsapi/icehockey_nhl.json"
EPL_CACHE = BETTING / "odds/cache/oddsapi/soccer_epl.json"

# NHL full name -> site abbreviation (matches functions/today.js NHLN)
NHL_ABBR = {
    "Anaheim Ducks": "ANA", "Boston Bruins": "BOS", "Buffalo Sabres": "BUF", "Calgary Flames": "CGY",
    "Carolina Hurricanes": "CAR", "Chicago Blackhawks": "CHI", "Colorado Avalanche": "COL",
    "Columbus Blue Jackets": "CBJ", "Dallas Stars": "DAL", "Detroit Red Wings": "DET",
    "Edmonton Oilers": "EDM", "Florida Panthers": "FLA", "Los Angeles Kings": "LAK",
    "Minnesota Wild": "MIN", "Montréal Canadiens": "MTL", "Montreal Canadiens": "MTL",
    "Nashville Predators": "NSH", "New Jersey Devils": "NJD", "New York Islanders": "NYI",
    "New York Rangers": "NYR", "Ottawa Senators": "OTT", "Philadelphia Flyers": "PHI",
    "Pittsburgh Penguins": "PIT", "San Jose Sharks": "SJS", "Seattle Kraken": "SEA",
    "St. Louis Blues": "STL", "Tampa Bay Lightning": "TBL", "Toronto Maple Leafs": "TOR",
    "Utah Mammoth": "UTA", "Utah Hockey Club": "UTA", "Vancouver Canucks": "VAN",
    "Vegas Golden Knights": "VGK", "Washington Capitals": "WSH", "Winnipeg Jets": "WPG",
}


def fnum(x):
    try:
        if x is None or x == "":
            return None
        v = float(x)
        return v if 0 < v < 1 else None
    except (TypeError, ValueError):
        return None


def parse_game(game: str):
    if not game:
        return None, None
    for sep in (" @ ", " v ", " vs ", " VS "):
        if sep in game:
            a, h = game.split(sep, 1)
            return a.strip(), h.strip()
    return None, None


def norm_kickoff(k):
    if not k:
        return None
    k = k.strip()
    if k.endswith("Z") and k.count(":") == 1:  # 2026-11-06T02:00Z
        return k[:-1] + ":00Z"
    return k


def devonvig(prices: dict):
    """prices: name -> decimal price. Return name -> implied prob after removing overround."""
    inv = {n: 1.0 / p for n, p in prices.items() if p and p > 1}
    s = sum(inv.values())
    if s <= 0:
        return {}
    return {n: v / s for n, v in inv.items()}


def h2h_implied(event: dict):
    """Prefer pinnacle h2h; else average devonvig'd probs across books with h2h."""
    books = event.get("bookmakers") or []
    pin = next((b for b in books if b.get("key") == "pinnacle"), None)

    def from_book(b):
        for m in b.get("markets") or []:
            if m.get("key") != "h2h":
                continue
            prices = {o["name"]: float(o["price"]) for o in m.get("outcomes") or [] if o.get("price")}
            return devonvig(prices)
        return None

    if pin:
        got = from_book(pin)
        if got:
            return got, "pinnacle"
    acc = {}
    n = 0
    for b in books:
        got = from_book(b)
        if not got:
            continue
        n += 1
        for k, v in got.items():
            acc[k] = acc.get(k, 0.0) + v
    if not n:
        return None, None
    return {k: v / n for k, v in acc.items()}, "consensus"


def load_nba(path: Path):
    rows = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            ph = fnum(r.get("pin_p_home"))
            if ph is None:
                continue
            away, home = parse_game(r.get("game") or "")
            if not away:
                parts = (r.get("game_id") or "").split("_")
                if len(parts) >= 4:
                    away, home = parts[-2], parts[-1]
            rows.append({
                "sport": "nba", "game_id": r.get("espn_id") or r.get("game_id"),
                "away": away, "home": home, "start_utc": norm_kickoff(r.get("kickoff_utc")),
                "market_home": round(ph, 4), "market_away": round(1 - ph, 4),
            })
    return rows


def load_nfl(path: Path):
    rows = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            ph = fnum(r.get("pin_nv_p_home")) or fnum(r.get("book_nv_p_home"))
            if ph is None:
                continue
            away, home = parse_game(r.get("game") or "")
            rows.append({
                "sport": "nfl", "game_id": r.get("espn_id") or r.get("game_id"),
                "away": away, "home": home, "start_utc": norm_kickoff(r.get("kickoff_utc")),
                "market_home": round(ph, 4), "market_away": round(1 - ph, 4),
            })
    return rows


def load_epl_csv(path: Path):
    rows = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            ph, pd, pa = fnum(r.get("pin_p_home")), fnum(r.get("pin_p_draw")), fnum(r.get("pin_p_away"))
            if ph is None or pa is None:
                continue
            rows.append({
                "sport": "epl", "game_id": r.get("game_id"),
                "away": r.get("away"), "home": r.get("home"),
                "start_utc": norm_kickoff(r.get("kickoff_utc")),
                "market_home": round(ph, 4),
                "market_draw": round(pd, 4) if pd is not None else None,
                "market_away": round(pa, 4),
            })
    return rows


def link_epl_to_site(rows):
    """2026-11-06: odds CSV uses EPL_2627_* ids and short names; /today EPL rows use ESPN ids
    and full names from data/epl-picks.json. Copy the site's id/names onto each market row."""
    try:
        raw = json.loads((ROOT / "data" / "epl-picks.json").read_text())
    except Exception:
        return rows
    picks = raw if isinstance(raw, list) else raw.get("games", [])
    def k(s):
        s = str(s or "").lower().replace("afc ", "").replace("nott'm", "nottingham").replace("man ", "manchester ")
        return "".join(ch for ch in s if ch.isalnum())
    def same(a, b): return bool(a and b) and (a.startswith(b) or b.startswith(a))
    for r in rows:
        g = next((g for g in picks if norm_kickoff(g.get("start_utc") or g.get("kickoff_utc")) == r.get("start_utc")
                  and same(k(g.get("home")), k(r.get("home"))) and same(k(g.get("away")), k(r.get("away")))), None)
        if g:
            r["odds_game_id"] = r.get("game_id")
            r["game_id"] = str(g.get("game_id") or g.get("id"))
            r["home_name"], r["away_name"] = g.get("home"), g.get("away")
    return rows


def load_oddsapi_h2h(path: Path, sport: str, name_to_abbr=None):
    if not path.exists():
        return [], f"{sport}: missing cache {path}"
    raw = json.loads(path.read_text())
    events = raw.get("data") or raw if isinstance(raw, list) else raw.get("data") or []
    rows = []
    for ev in events:
        implied, _src = h2h_implied(ev)
        if not implied:
            continue
        home, away = ev.get("home_team"), ev.get("away_team")
        ph, pa = implied.get(home), implied.get(away)
        pd = None
        for n, v in implied.items():
            if n not in (home, away):
                pd = v
        if ph is None or pa is None:
            continue
        home_out, away_out = home, away
        if name_to_abbr:
            home_out = name_to_abbr.get(home, home)
            away_out = name_to_abbr.get(away, away)
        row = {
            "sport": sport, "game_id": ev.get("id"),
            "away": away_out, "home": home_out,
            "away_name": away, "home_name": home,
            "start_utc": norm_kickoff(ev.get("commence_time")),
            "market_home": round(ph, 4), "market_away": round(pa, 4),
        }
        if pd is not None:
            row["market_draw"] = round(pd, 4)
        rows.append(row)
    gap = None if rows else f"{sport}: cache present but no h2h markets"
    return rows, gap


def main():
    games, gaps = [], []

    if NBA_CSV.exists():
        chunk = load_nba(NBA_CSV); games.extend(chunk)
        if not chunk: gaps.append("nba: comparison present but no market chances")
    else:
        gaps.append(f"nba: missing {NBA_CSV}")

    if NFL_CSV.exists():
        chunk = load_nfl(NFL_CSV); games.extend(chunk)
        if not chunk: gaps.append("nfl: comparison present but no market chances")
    else:
        gaps.append(f"nfl: missing {NFL_CSV}")

    epl_rows = load_epl_csv(EPL_CSV) if EPL_CSV.exists() else []
    if not epl_rows:
        epl_rows, gap = load_oddsapi_h2h(EPL_CACHE, "epl")
        if gap: gaps.append(gap)
    if epl_rows:
        games.extend(link_epl_to_site(epl_rows))
    elif EPL_CSV.exists():
        gaps.append("epl: comparison present but no market chances")
    elif not EPL_CACHE.exists():
        gaps.append(f"epl: missing {EPL_CSV} and {EPL_CACHE}")

    nhl_rows, gap = load_oddsapi_h2h(NHL_CACHE, "nhl", NHL_ABBR)
    if gap: gaps.append(gap)
    games.extend(nhl_rows)

    payload = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": "Market chances only (no book names or prices). Built from local comparison CSVs and Odds API caches; no new Odds API call.",
        "gaps": gaps,
        "games": games,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {OUT} ({len(games)} games; nba={sum(1 for g in games if g['sport']=='nba')} nfl={sum(1 for g in games if g['sport']=='nfl')} nhl={sum(1 for g in games if g['sport']=='nhl')} epl={sum(1 for g in games if g['sport']=='epl')})")
    for g in gaps:
        print("gap:", g)
    return 0


if __name__ == "__main__":
    sys.exit(main())
