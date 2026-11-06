"""Tips snapshot extension: PL site record, read from the SAME sources and rules as the public Record pages.

NBA/NFL: probalab-feed, current season, games with a pick, status post, won not null; light as frozen on the feed.
NHL: /data/nhl-pretip.json (pick, light, won frozen at puck drop) + /data/nhl-picks.json for teams/dates.
Units: hypothetical flat 1u at the PL price captured in the ledger for that game (no price -> units null).
John's bets: the matched game's record light is attached as `record_light` for like-for-like colour comparison;
a bet whose matched pick is for a different game is unmatched (pick_id/light cleared).
"""
import json
import re
import urllib.request
from math import isfinite

FEED = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-feed?sport={}"
SITE = "https://probalabsports.com/data/{}"


def number(v):
    try:
        n = float(v)
        return n if isfinite(n) else None
    except (TypeError, ValueError):
        return None


def get(url):
    req = urllib.request.Request(url, headers={"accept": "application/json", "user-agent": "probalab-tips-export"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def gid(pick_id):
    m = re.search(r"(\d+)$", str(pick_id or ""))
    return m.group(1) if m else None


def record_rows():
    out = []
    for sp in ("nba", "nfl"):
        f = get(FEED.format(sp))
        for g in f.get("games", []):
            if g.get("season") != f.get("season") or not g.get("pick") or g.get("status") != "post" or g.get("won") is None:
                continue
            out.append({"game_id": str(g["game_id"]), "sport": sp.upper(), "game": f"{g['away']} @ {g['home']}",
                        "selection": g["pick"], "light": g.get("light"), "won": bool(g["won"]),
                        "tipoff_utc": g.get("start_utc"), "win_pct": number(g.get("pick_p"))})
    picks = get(SITE.format("nhl-picks.json"))
    picks = {str(p.get("id")): p for p in (picks if isinstance(picks, list) else picks.get("games", []))}
    for i, s in (get(SITE.format("nhl-pretip.json")).get("games") or {}).items():
        if not isinstance(s.get("won"), bool):
            continue
        p = picks.get(str(i), {})
        out.append({"game_id": str(i), "sport": "NHL", "game": f"{p.get('away', '?')} @ {p.get('home', '?')}",
                    "selection": s.get("pick"), "light": s.get("light"), "won": s["won"],
                    "tipoff_utc": p.get("date"), "win_pct": number(s.get("pick_p"))})
    return out


def enrich_snapshot(doc, latest, row_sport):
    prices = {}
    for pid, r in latest.items():
        if r.get("source") == "probalab" and gid(pid):
            prices[gid(pid)] = number(r.get("price"))
    rec = record_rows()
    by_id = {r["game_id"]: r for r in rec}
    history = []
    for r in rec:
        price = prices.get(r["game_id"])
        covered = price is not None and price > 1
        res = "W" if r["won"] else "L"
        history.append({"pick_id": r["game_id"], "tag": "PL", "sport": r["sport"], "game": r["game"],
                        "selection": r["selection"], "light": r["light"], "tipoff_utc": r["tipoff_utc"],
                        "result": res, "win_pct": r["win_pct"],
                        "price_taken": price if covered else None, "units": 1 if covered else None,
                        "pnl_units": (round(price - 1, 6) if res == "W" else -1) if covered else None})
    doc["pl_results"] = history

    def teams(g):
        return set(t.strip() for t in str(g or "").split(" @ "))

    for key in ("open_bets", "results"):
        for b in doc.get(key) or []:
            b["light_at_placement"] = b.get("light")
            pid = b.get("pick_id")
            if not pid:
                continue
            src = latest.get(pid) or {}
            # a bet must be on the same game as its matched pick
            if src.get("game") and b.get("game") and teams(src.get("game")) != teams(b.get("game")) and \
                    not (teams(b.get("game")) & {str(src.get("selection"))} and len(teams(src.get("game")) & teams(b.get("game"))) == 2):
                b["mismatch_note"] = f"was matched to {pid} ({src.get('game')}), a different game"
                b["pick_id"] = None
                b["light"] = None
                b["light_at_placement"] = None
                continue
            r = by_id.get(gid(pid))
            if r:
                b["record_light"] = r["light"]
                b["pick_side"] = r["selection"]
    doc["comparison_assumptions"] = {
        "pl_source": "public Record pages: probalab-feed (NBA/NFL), nhl-pretip.json (NHL); frozen light and result",
        "pl_stake": "flat 1u at ledger-captured PL price, before commission; missing price -> excluded from units/ROI",
        "my_colour": "light of the matched pick at the last capture before placement (John: judged at placement); record_light = final site light",
    }
    return doc
