#!/usr/bin/env python3
"""Compare the light shown in the latest Discord payload with the light the site shows for the same games.

Reads a Discord payload (one file, or the newest file in a folder):
  * <job>\\ledger\\discord_payloads\\<desk>-latest.json  - saved by send.py after the lights patch (default folder)
  * a Discord message export: {"content": ..., "embeds": [...]} or a list of messages
  * a plain text file (e.g. tips_check would-post)
Each line (or block) with a light marker - 🟣 / 🟢 / 🟠 / 🔴, the old green+star, or SUPER / Best value / GREEN / ORANGE /
RED - and two teams (or players) is matched to a site game near the post time, and the lights are compared using the
same rules as the site pages (lights.json).

Usage:
  python check_discord_lights.py                                   newest payload in ..\\ledger\\discord_payloads
  python check_discord_lights.py --payload path\\to\\tip-results-latest.json
  python check_discord_lights.py --payload payload.txt --site https://preview.example.pages.dev --json
Exit code: 0 all lights match, 1 at least one mismatch, 2 nothing to check / could not read.
Read only: never posts anything, never needs a key. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))  # when installed as <job>/scripts/lights_check/
from probalab_lights import Lights  # noqa: E402

UA = "Mozilla/5.0 ProbaLab-lights-check"
SITE = "https://probalabsports.com"

# Team names behind the feed abbreviations (same maps as functions/_shared/site.js; checked by the site tests).
NBA = {"ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets", "CHA": "Charlotte Hornets", "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers", "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons", "GS": "Golden State Warriors", "HOU": "Houston Rockets", "IND": "Indiana Pacers", "LAC": "LA Clippers", "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies", "MIA": "Miami Heat", "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves", "NO": "New Orleans Pelicans", "NY": "New York Knicks", "OKC": "Oklahoma City Thunder", "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers", "PHX": "Phoenix Suns", "POR": "Portland Trail Blazers", "SAC": "Sacramento Kings", "SA": "San Antonio Spurs", "TOR": "Toronto Raptors", "UTAH": "Utah Jazz", "WSH": "Washington Wizards"}
NHL = {"ANA": "Anaheim Ducks", "BOS": "Boston Bruins", "BUF": "Buffalo Sabres", "CGY": "Calgary Flames", "CAR": "Carolina Hurricanes", "CHI": "Chicago Blackhawks", "COL": "Colorado Avalanche", "CBJ": "Columbus Blue Jackets", "DAL": "Dallas Stars", "DET": "Detroit Red Wings", "EDM": "Edmonton Oilers", "FLA": "Florida Panthers", "LAK": "Los Angeles Kings", "MIN": "Minnesota Wild", "MTL": "Montréal Canadiens", "NSH": "Nashville Predators", "NJD": "New Jersey Devils", "NYI": "New York Islanders", "NYR": "New York Rangers", "OTT": "Ottawa Senators", "PHI": "Philadelphia Flyers", "PIT": "Pittsburgh Penguins", "SJS": "San Jose Sharks", "SEA": "Seattle Kraken", "STL": "St. Louis Blues", "TBL": "Tampa Bay Lightning", "TOR": "Toronto Maple Leafs", "UTA": "Utah Mammoth", "VAN": "Vancouver Canucks", "VGK": "Vegas Golden Knights", "WSH": "Washington Capitals", "WPG": "Winnipeg Jets"}
SOCCER_TAIL = re.compile(r"\s+(FC|AFC|City|United|Town|Athletic|Rovers|Wanderers|Albion|Hotspur|County|Argyle|Forest|Villa|Palace)$", re.I)


def fetch(site: str, path: str, default=None):
    try:
        req = urllib.request.Request(site.rstrip("/") + path, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:  # noqa: BLE001
        return default


def _ts(v):
    if not v:
        return None
    try:
        d = datetime.fromisoformat(str(v).replace(" UTC", "+00:00").replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _pc(v):
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n / 100 if n > 1 else n


def aliases(name: str, abbr: str | None, sport: str) -> tuple[set, set]:
    """(case-sensitive tokens, lower-case phrases) that name one team / player in Discord text."""
    toks, phr = set(), set()
    if abbr:
        toks.add(abbr)
    n = (name or "").strip()
    if n:
        phr.add(n.lower())
        words = n.split()
        if sport in ("nba", "nfl", "nhl") and len(words) > 1:
            phr.add(words[-1].lower())  # "Celtics", "Leafs"
        elif sport in ("epl", "championship"):
            short = SOCCER_TAIL.sub("", n)
            if short and short != n:
                phr.add(short.lower())
        elif sport == "tennis" and len(words) > 1:
            phr.add(words[-1].lower())  # surname
    return toks, phr


def site_games(site: str, L: Lights) -> list[dict]:
    """Every site game with the light the site shows (same rules as the pages)."""
    out = []

    def add(sport, gid, away, home, away_abbr, home_abbr, start, light, p, pick):
        if not light:
            return
        out.append({"sport": sport, "id": str(gid), "away": away, "home": home, "start": _ts(start), "light": light, "p": p, "pick": pick,
                    "teams": [aliases(away, away_abbr, sport), aliases(home, home_abbr, sport)]})

    for sport, path, names in (("nba", "/api/feed", NBA), ("nfl", "/api/feed?sport=nfl", None)):
        d = fetch(site, path, {}) or {}
        nm = names or {t[0]: t[1] for t in (d.get("teams") or []) if len(t) >= 2}
        for g in d.get("games") or []:
            if g.get("season") != d.get("season") or not g.get("pick"):
                continue
            p = _pc(g.get("pick_p"))
            light = L.shown_light(sport, g.get("light"), p) if g.get("light") else None
            add(sport, g.get("game_id"), nm.get(g["away"], g["away"]), nm.get(g["home"], g["home"]), g["away"], g["home"],
                g.get("start_utc"), light, p, nm.get(g["pick"], g["pick"]))
    raw = fetch(site, "/data/nhl-picks.json", []) or []
    snap = (fetch(site, "/data/nhl-pretip.json", {}) or {}).get("games") or {}
    for g in raw if isinstance(raw, list) else raw.get("games") or []:
        gid = str(g.get("id") or g.get("game_id"))
        sn = snap.get(gid)
        ph, pa = _pc(g.get("p_home", g.get("home_pct"))), _pc(g.get("p_away", g.get("away_pct")))
        home_pick = (sn["pick"] == g["home"]) if sn else g.get("pick") in ("home", g.get("home"))
        p = _pc(sn.get("pick_p")) if sn else (ph if home_pick else pa)
        light = L.shown_light("nhl", sn["light"], p) if sn and sn.get("light") else L.game_light("nhl", p)
        add("nhl", gid, NHL.get(g["away"], g["away"]), NHL.get(g["home"], g["home"]), g["away"], g["home"],
            g.get("start_utc") or g.get("puck_drop_utc") or g.get("date"), light, p, NHL.get(g["home"] if home_pick else g["away"]))
    lights_from = (L.sport_cfg("epl") or {}).get("lights_from")
    for sport in ("epl", "championship"):
        raw = fetch(site, f"/data/{sport}-picks.json", []) or []
        for g in raw if isinstance(raw, list) else raw.get("games") or []:
            p = _pc(g.get("p_" + str(g.get("pick"))))
            start = g.get("start_utc") or g.get("kickoff_utc")
            light = L.game_light(sport, p)
            if sport == "epl" and lights_from and (not start or str(start) < lights_from):
                light = None
            pick = g["home"] if g.get("pick") == "home" else g["away"] if g.get("pick") == "away" else "Draw"
            add(sport, g.get("game_id") or g.get("id"), g["away"], g["home"], None, None, start, light, p, pick)
    t = fetch(site, "/data/tennis-picks.json", {}) or {}
    for m in t.get("matches") or []:
        p = _pc(m.get("pick_pct"))
        light = L.shown_light("tennis", m.get("light"), p) if m.get("light") else None
        add("tennis", m.get("id"), m.get("player_a"), m.get("player_b"), None, None, m.get("start_utc"), light, p,
            m.get("player_a") if m.get("pick") == "a" else m.get("player_b"))
    return out


# ---------------------------------------------------------------- payload
def newest(path: Path) -> Path | None:
    if path.is_file():
        return path
    files = [f for f in path.glob("*") if f.is_file() and f.suffix.lower() in (".json", ".jsonl", ".txt")]
    return max(files, key=lambda f: f.stat().st_mtime) if files else None


def read_payload(path: Path) -> tuple[str, datetime | None, str]:
    """(text, sent time, description)."""
    raw = path.read_text(encoding="utf-8", errors="replace")
    sent = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
    if path.suffix.lower() == ".jsonl":
        rows = [json.loads(x) for x in raw.splitlines() if x.strip()]
        raw_obj = rows[-1] if rows else {}
    elif path.suffix.lower() == ".json":
        raw_obj = json.loads(raw)
    else:
        return raw, sent, f"{path.name} (text)"
    msgs = raw_obj if isinstance(raw_obj, list) else [raw_obj]
    parts, when = [], None
    for m in msgs:
        if not isinstance(m, dict):
            continue
        parts.append(str(m.get("content") or ""))
        for e in m.get("embeds") or []:
            parts += [str(e.get("title") or ""), str(e.get("description") or "")]
            parts += [f"{f.get('name', '')}\n{f.get('value', '')}" for f in e.get("fields") or []]
        when = _ts(m.get("sent_utc") or m.get("timestamp")) or when
    desk = msgs[0].get("desk") if msgs and isinstance(msgs[0], dict) else None
    return "\n".join(parts), when or sent, f"{path.name}" + (f" (#{desk})" if desk else "")


def _has(text: str, low: str, al: tuple[set, set]) -> bool:
    toks, phr = al
    if any(re.search(r"(?<![A-Za-z0-9])" + re.escape(t) + r"(?![A-Za-z0-9])", text) for t in toks):
        return True
    return any(re.search(r"(?<![a-z0-9])" + re.escape(p) + r"(?![a-z0-9])", low) for p in phr)


def match_games(text: str, games: list[dict]) -> list[dict]:
    low = text.lower()
    both = [g for g in games if _has(text, low, g["teams"][0]) and _has(text, low, g["teams"][1])]
    if both:
        return both
    one = [g for g in games if _has(text, low, g["teams"][0]) or _has(text, low, g["teams"][1])]
    return one if len(one) == 1 else []


def check(text: str, sent: datetime | None, games: list[dict], L: Lights, days: float = 4.0) -> list[dict]:
    if sent:
        near = [g for g in games if g["start"] and abs((g["start"] - sent).total_seconds()) <= days * 86400]
    else:
        near = list(games)
    found, pending, unmatched = [], None, []
    for line in text.splitlines():
        if not line.strip():
            if pending:
                unmatched.append((pending[2], pending[0]))
            pending = None
            continue
        light, how = L.light_marker(line)
        hits = match_games(line, near)
        if hits:
            if light and pending:  # a waiting light whose game never came
                unmatched.append((pending[2], pending[0]))
            use = light or (pending[0] if pending else None)
            how = how if light else (pending[1] if pending else None)
            if use:
                g = min(hits, key=lambda x: abs((x["start"] - sent).total_seconds()) if (sent and x["start"]) else 0)
                found.append({"line": line.strip(), "discord": use, "how": how, "game": g})
            pending = None
        elif light:
            if pending:
                unmatched.append((pending[2], pending[0]))
            pending = (light, how, line.strip())
    seen, rows = set(), []
    for f in found:
        g = f["game"]
        key = (g["sport"], g["id"], f["discord"])
        if key in seen:
            continue
        seen.add(key)
        rows.append({"status": "OK" if f["discord"] == g["light"] else "MISMATCH", "sport": g["sport"], "game_id": g["id"],
                     "game": f"{g['away']} @ {g['home']}", "start_utc": g["start"].strftime("%Y-%m-%dT%H:%MZ") if g["start"] else None,
                     "discord": f["discord"], "marker": f["how"], "site": g["light"],
                     "site_p": None if g["p"] is None else round(g["p"], 4), "line": f["line"][:160]})
    if pending:
        unmatched.append((pending[2], pending[0]))
    for line, light in unmatched:
        rows.append({"status": "UNMATCHED", "sport": "", "game_id": None, "game": "", "start_utc": None, "discord": light,
                     "marker": None, "site": None, "site_p": None, "line": line[:160]})
    return rows


def main(argv=None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--payload", help="payload file or folder (newest file is used); default ..\\ledger\\discord_payloads")
    ap.add_argument("--site", default=SITE, help="site to compare with (default %(default)s)")
    ap.add_argument("--lights", help="lights.json to use (default: the site's /lights.json, else the packaged copy)")
    ap.add_argument("--days", type=float, default=4.0, help="match games starting within this many days of the post")
    ap.add_argument("--json", action="store_true", help="print the report as JSON")
    a = ap.parse_args(argv)

    if a.lights:
        L = Lights.load(a.lights)
    else:
        remote = fetch(a.site, "/lights.json")
        L = Lights(remote) if isinstance(remote, dict) and remote.get("games") else Lights.load()
    target = Path(a.payload) if a.payload else HERE.parents[1] / "ledger" / "discord_payloads"
    if not target.exists():
        print(f"no payload at {target}")
        return 2
    f = newest(target)
    if not f:
        print(f"no payload files in {target}")
        return 2
    try:
        text, sent, desc = read_payload(f)
    except (OSError, ValueError) as exc:
        print(f"could not read {f.name}: {type(exc).__name__}")
        return 2
    games = site_games(a.site, L)
    rows = check(text, sent, games, L, a.days)
    bad = [r for r in rows if r["status"] == "MISMATCH"]
    loose = [r for r in rows if r["status"] == "UNMATCHED"]
    report = {"payload": desc, "sent_utc": sent.strftime("%Y-%m-%dT%H:%M:%SZ") if sent else None, "site": a.site,
              "site_games": len(games), "checked": len(rows) - len(loose), "mismatches": len(bad), "unmatched": len(loose), "rows": rows}
    if a.json:
        print(json.dumps(report, ensure_ascii=False, indent=1))
    else:
        print(f"Payload {desc}, posted {report['sent_utc']} · site {a.site} ({len(games)} games with a light)")
        if not rows:
            print("No game lines with a light found in the payload.")
        for r in rows:
            if r["status"] == "UNMATCHED":
                print(f"UNMATCHED   light {L.tag(r['discord'])}, no site game found within {a.days:g} days: {r['line']}")
                continue
            flag = "OK      " if r["status"] == "OK" else "MISMATCH"
            print(f"{flag} {r['sport'].upper():<12} {r['game']:<48} Discord {L.tag(r['discord']):<16} site {L.tag(r['site']):<16}"
                  f"{'' if r['site_p'] is None else ' (' + L.chance_text(r['site_p']) + ')'}")
            if r["status"] != "OK":
                print(f"         line: {r['line']}")
        print(f"{len(rows) - len(loose)} checked, {len(bad)} mismatch{'es' if len(bad) != 1 else ''}, {len(loose)} unmatched.")
    if not rows:
        return 2
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
