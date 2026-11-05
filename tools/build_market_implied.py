#!/usr/bin/env python3
"""Build data/market-implied.json from odds comparison CSVs already on the box.

No Odds API calls. Run after the usual NBA/NFL/EPL comparison refreshes.
Writes only market chances (0-1), never book names or decimal prices.
"""
from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "market-implied.json"

# Defaults assume the betting workspace sits next to this repo on the box.
BETTING = Path(os.environ.get("BETTING_ROOT", "/workspace/betting"))

SOURCES = {
    "nba": BETTING / "odds/nba/comparison_today.csv",
    "nfl": BETTING / "odds/nfl/comparison_this_week.csv",
    "epl": BETTING / "odds/epl/comparison_this_round.csv",
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


def load_nba(path: Path):
    rows = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            ph = fnum(r.get("pin_p_home"))
            if ph is None:
                continue
            away, home = parse_game(r.get("game") or "")
            if not away:
                # game_id like NBA_20261105_ORL_PHX
                gid = r.get("game_id") or ""
                parts = gid.split("_")
                if len(parts) >= 4:
                    away, home = parts[-2], parts[-1]
            rows.append(
                {
                    "sport": "nba",
                    "game_id": r.get("espn_id") or r.get("game_id"),
                    "away": away,
                    "home": home,
                    "start_utc": (r.get("kickoff_utc") or "").replace("Z", ":00Z") if r.get("kickoff_utc") and r["kickoff_utc"].endswith("Z") and r["kickoff_utc"].count(":") == 1 else r.get("kickoff_utc"),
                    "market_home": round(ph, 4),
                    "market_away": round(1 - ph, 4),
                }
            )
    return rows


def load_nfl(path: Path):
    rows = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            ph = fnum(r.get("pin_nv_p_home")) or fnum(r.get("book_nv_p_home"))
            if ph is None:
                continue
            away, home = parse_game(r.get("game") or "")
            rows.append(
                {
                    "sport": "nfl",
                    "game_id": r.get("espn_id") or r.get("game_id"),
                    "away": away,
                    "home": home,
                    "start_utc": r.get("kickoff_utc"),
                    "market_home": round(ph, 4),
                    "market_away": round(1 - ph, 4),
                }
            )
    return rows


def load_epl(path: Path):
    rows = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            ph, pd, pa = fnum(r.get("pin_p_home")), fnum(r.get("pin_p_draw")), fnum(r.get("pin_p_away"))
            if ph is None or pa is None:
                continue
            rows.append(
                {
                    "sport": "epl",
                    "game_id": r.get("game_id"),
                    "away": r.get("away"),
                    "home": r.get("home"),
                    "start_utc": r.get("kickoff_utc"),
                    "market_home": round(ph, 4),
                    "market_draw": round(pd, 4) if pd is not None else None,
                    "market_away": round(pa, 4),
                }
            )
    return rows


def main():
    games = []
    gaps = []
    loaders = {"nba": load_nba, "nfl": load_nfl, "epl": load_epl}
    for sport, path in SOURCES.items():
        if not path.exists():
            gaps.append(f"{sport}: missing {path}")
            continue
        chunk = loaders[sport](path)
        games.extend(chunk)
        if not chunk:
            gaps.append(f"{sport}: file present but no usable market chances")
    gaps.append("nhl: no comparison CSV on the box yet")

    payload = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": "Market chances only (no book names or prices). Built from local comparison CSVs; no Odds API call.",
        "gaps": gaps,
        "games": games,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {OUT} ({len(games)} games)")
    for g in gaps:
        print("gap:", g)


if __name__ == "__main__":
    main()
