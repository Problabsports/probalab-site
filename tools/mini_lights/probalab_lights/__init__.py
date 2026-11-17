"""ProbaLab lights for the mini jobs: reads lights.json (the same file the site uses; single source of truth).

    from probalab_lights import LIGHTS
    LIGHTS.emoji("SUPER")              -> "🟣"
    LIGHTS.tag("SUPER")                -> "🟣 Best value"
    LIGHTS.game_light("nhl", 0.62)     -> "ORANGE"
    LIGHTS.shown_light("nba", "GREEN", 0.63) -> "ORANGE"   (same rule as the site: held value keeps its cut-off light)
    LIGHTS.shown_light("nba", "SUPER", 0.77) -> "GREEN"    (green first; LIGHTS.best_value_tag(...) -> True)
    fix_discord_text(text)             -> text with any old green+star Best value marker replaced by 🟣

Mirrors lights-core.mjs on the site; the site's tests run parity.py against this module so they cannot drift.
Standard library only. Never raises from fix_discord_text / save_payload (Discord posts must not fail because of it).
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_PATH = HERE / "lights.json"
_ALIASES = {"SUPER_GREEN": "SUPER", "SUPERGREEN": "SUPER", "BEST_VALUE": "SUPER", "BESTVALUE": "SUPER"}
DASH = "–"


def _pct(x) -> int:
    # JS Math.round: halves round up (Python's round() is banker's rounding)
    import math
    return int(math.floor(float(x) * 100 + 0.5))


def shown_pct(p):
    """The whole % a chance is shown as: rounded DOWN (lights.json "display"); lights are judged on it."""
    import math
    n = _num(p)
    return None if n is None else int(math.floor(n * 100 + 1e-7))


def chance_text(p):
    s = shown_pct(p)
    return "\u2014" if s is None else f"{s}%"


def _num(p):
    try:
        n = float(p)
    except (TypeError, ValueError):
        return None
    return n if n == n and n not in (float("inf"), float("-inf")) else None


class Lights:
    def __init__(self, data: dict):
        self.data = data
        self.lights = data["lights"]
        self.games = data["games"]
        self.best_value = data["best_value"]
        self.props = data["props"]
        self.order = list(data["order"])

    @classmethod
    def load(cls, path=None) -> "Lights":
        """lights.json beside this module (the packaged copy), else the site repo's own (when run from the repo)."""
        cands = [path, os.environ.get("PROBALAB_LIGHTS_JSON"), DEFAULT_PATH, HERE.parents[2] / "lights.json"]
        p = next(Path(c) for c in cands if c and Path(c).is_file())
        return cls(json.loads(p.read_text(encoding="utf-8")))

    # ---------------------------------------------------------------- names
    def norm(self, light) -> str:
        k = re.sub(r"[-\s]+", "_", str(light or "").strip().upper())
        k = _ALIASES.get(k, k)
        return k if k in self.lights else ""

    def label(self, light) -> str:
        k = self.norm(light)
        return self.lights[k]["label"] if k else str(light or "")

    def label_long(self, light) -> str:
        k = self.norm(light)
        return self.lights[k]["label_long"] if k else str(light or "")

    def emoji(self, light) -> str:
        k = self.norm(light)
        return self.lights[k]["emoji"] if k else ""

    def colour(self, light) -> str:
        k = self.norm(light)
        return self.lights[k]["colour"] if k else ""

    def tag(self, light) -> str:
        """'🟣 Best value', '🟢 Green', ... ('' for an unknown light)."""
        k = self.norm(light)
        return f"{self.emoji(k)} {self.label(k)}" if k else ""

    def is_tip(self, light) -> bool:
        return self.norm(light) in ("SUPER", "GREEN")

    # ---------------------------------------------------------------- rules (same as lights-core.mjs)
    def sport_cfg(self, sport):
        return self.games.get(str(sport or "").lower())

    def game_light(self, sport, p):
        c, v = self.sport_cfg(sport), shown_pct(p)
        if not c or v is None:
            return None
        return "GREEN" if v >= _pct(c["green_min"]) else "ORANGE" if v >= _pct(c["orange_min"]) else "RED"

    def chance_text(self, p):
        """'54%' for 0.549: rounded down, the number its light is judged on."""
        return chance_text(p)

    def shown_light(self, sport, feed_light, p):
        c, k, n = self.sport_cfg(sport), self.norm(feed_light), _num(p)
        if not k:
            return self.game_light(sport, n)
        if not c or n is None:
            return k
        if k == "SUPER":
            if str(sport).lower() not in self.best_value["sports"]:
                return self.game_light(sport, n)
            v = shown_pct(n)
            # green first: a Best value pick in the green range shows GREEN (+ Best value tag), counted as green only
            if v < _pct(self.best_value["min_p"]) or v >= _pct(c["green_min"]):
                return self.game_light(sport, n)
            return "SUPER"
        if k == "GREEN" and c.get("guard") and shown_pct(n) < _pct(c["green_min"]):
            return self.game_light(sport, n)
        return k

    def best_value_tag(self, sport, feed_light, p) -> bool:
        """Same as bestValueTag in lights-core.mjs: feed SUPER, in a Best value sport, at min_p or more (shown %).
        True for the Best value light and for a green pick that also beats our fair price."""
        v = shown_pct(p)
        if self.norm(feed_light) != "SUPER" or v is None:
            return False
        return str(sport or "").lower() in self.best_value["sports"] and v >= _pct(self.best_value["min_p"])

    def props_light(self, p):
        v = shown_pct(p)
        if v is None:
            return None
        return "GREEN" if v >= _pct(self.props["green_min"]) else "ORANGE" if v >= _pct(self.props["orange_min"]) else "RED"

    def scale_text(self, sport):
        c = self.sport_cfg(sport)
        if not c:
            return None
        g, o = _pct(c["green_min"]), _pct(c["orange_min"])
        return {"GREEN": f"{g}%+", "ORANGE": f"{o}{DASH}{g - 1}%", "RED": f"under {o}%"}

    # ---------------------------------------------------------------- Discord
    def legacy_best_value(self):
        return list(self.data.get("discord", {}).get("legacy_best_value") or [])

    def fix_discord_text(self, text: str) -> str:
        """Best value is 🟣 in Discord: replace any old green+star marker. Nothing else changes."""
        out = str(text or "")
        purple = self.emoji("SUPER")
        for old in sorted(self.legacy_best_value(), key=len, reverse=True):
            out = out.replace(old, purple)
        return out

    def light_marker(self, text: str):
        """The light a piece of Discord text shows: (light, how) or (None, None).
        Emoji first (old green+star counts as Best value), then the words SUPER / Best value / GREEN / ORANGE / RED."""
        s = str(text or "")
        for old in self.legacy_best_value():
            if old in s:
                return "SUPER", "legacy green+star"
        for k in self.order:
            e = self.emoji(k)
            if e and e in s:
                return k, "emoji"
        m = re.search(r"\b(SUPER(?:[ _-]?GREEN)?|BEST VALUE|GREEN|ORANGE|RED)\b", s, re.I)
        if m:
            w = m.group(1).upper()
            # plain colour words count only in caps or inside brackets, so "red card" or "Green Bay" are not lights
            bracketed = re.search(r"[\(\[]\s*" + re.escape(m.group(1)) + r"\s*[\)\]]", s)
            if w.startswith("SUPER") or w == "BEST VALUE" or m.group(1).isupper() or bracketed:
                return self.norm(w.replace(" ", "_")), "word"
        return None, None


LIGHTS = Lights.load()


def fix_discord_text(text: str) -> str:
    try:
        return LIGHTS.fix_discord_text(text)
    except Exception:  # noqa: BLE001 - never block a Discord post
        return text


def payload_dir() -> Path:
    env = os.environ.get("PROBALAB_DISCORD_PAYLOADS", "").strip()
    if env:
        return Path(env)
    # <job>/scripts/probalab_lights/__init__.py -> <job>/ledger/discord_payloads
    return HERE.parents[1] / "ledger" / "discord_payloads"


def save_payload(desk: str, content: str, message_id=None, keep: int = 30) -> None:
    """Keep the latest posted text per desk (for the lights check). Never raises; never stores webhook URLs."""
    try:
        d = payload_dir()
        d.mkdir(parents=True, exist_ok=True)
        row = {"desk": desk, "sent_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "message_id": message_id, "content": content}
        safe = re.sub(r"[^a-z0-9_-]+", "-", str(desk).lower())
        fd, tmp = tempfile.mkstemp(prefix=".payload_", dir=d)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(row, f, ensure_ascii=False, indent=1)
        os.replace(tmp, d / f"{safe}-latest.json")
        hist = d / f"{safe}-history.jsonl"
        lines = hist.read_text(encoding="utf-8").splitlines() if hist.exists() else []
        lines = (lines + [json.dumps(row, ensure_ascii=False)])[-keep:]
        hist.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
