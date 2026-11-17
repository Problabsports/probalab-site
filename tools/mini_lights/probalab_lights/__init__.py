"""ProbaLab lights for the mini jobs: reads lights.json (the same file the site uses; single source of truth).

    from probalab_lights import LIGHTS
    LIGHTS.emoji("SUPER")              -> "🟣"
    LIGHTS.tag("SUPER")                -> "🟣 Best value"
    LIGHTS.game_light("nhl", 0.62)     -> "ORANGE"
    LIGHTS.shown_light("nba", "GREEN", 0.63) -> "ORANGE"   (same rule as the site: held value keeps its cut-off light)
    LIGHTS.shown_light("nba", "SUPER", 0.77) -> "GREEN"    (green first; LIGHTS.best_value_tag(...) -> True)
    LIGHTS.discord_marker("nba", "SUPER", 0.77) -> "🟢 (Best value)"   (green first; 0.61 -> "🟣 Best value")
    fix_discord_text(text)             -> old green+star Best value marker replaced by 🟣; a Best value line whose
                                          chance is in the green range becomes "🟢 (Best value)"; never "SUPER"

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
# Discord text helpers (fix_discord_text): a chance is an unsigned whole or decimal %; Best value markers.
_CHANCE = re.compile(r"(?<![+\-\u2212\d.])(\d{1,3}(?:\.\d+)?)\s?%")
_SUPER_WORD = re.compile(r"\bSUPER(?:[ _-]?GREEN)?\b")
_BV_WORD = re.compile(r"\bbest value\b", re.I)
_PURPLE_TAG = re.compile("\U0001F7E3(?:\\s*Best value)?")
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

    def best_value_tag(self, sport, feed_light, p, feed_flag=False) -> bool:
        """Same as bestValueTag in lights-core.mjs: feed SUPER (or the newer feed's best_value: true flag), in a Best
        value sport, at min_p or more (shown %). True for the Best value light and for a green pick that also beats
        our fair price."""
        v = shown_pct(p)
        if (self.norm(feed_light) != "SUPER" and feed_flag is not True) or v is None:
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

    def discord_marker(self, sport, feed_light, p, feed_flag=False) -> str:
        """The light marker a Discord line uses for a game, green first (same rule as the site):
        '🟢 (Best value)' for a green pick that also beats our fair price, '🟣 Best value' below the green range,
        else '🟢 Green' / '🟠 Orange' / '🔴 Red' ('' when unknown)."""
        light = self.shown_light(sport, feed_light, p)
        if not light:
            return ""
        if light == "GREEN" and self.best_value_tag(sport, feed_light, p, feed_flag):
            return f"{self.emoji('GREEN')} ({self.label('SUPER')})"
        return self.tag(light)

    def _green_cut(self, sport="nba"):
        c = self.sport_cfg(sport)
        return _pct(c["green_min"]) if c else None

    def _line_chance(self, line: str):
        """The one chance shown on a line ('LA Clippers 77%' -> 77), or None when there is none or more than one.
        Signed numbers (+9.8% value, -2% vs close) are not chances."""
        vals = {int(float(m)) for m in _CHANCE.findall(line) if 50 <= float(m) <= 100}
        return vals.pop() if len(vals) == 1 else None

    def fix_discord_text(self, text: str) -> str:
        """Discord text, green first (lights.json):
        * an old green+star marker is Best value (🟣);
        * a Best value line (🟣, or the word Best value / SUPER) whose one chance is in the NBA green range becomes
          '🟢 (Best value)': green light, Best value as a tag;
        * the word SUPER / SUPER GREEN is never posted: it becomes 'Best value'.
        A line with no chance, or two different chances, keeps its marker (the lights check will flag it)."""
        out = str(text or "")
        purple = self.emoji("SUPER")
        for old in sorted(self.legacy_best_value(), key=len, reverse=True):
            out = out.replace(old, purple)
        green, cut, word = self.emoji("GREEN"), self._green_cut("nba"), self.label("SUPER")
        lines = []
        for line in out.split("\n"):
            line = _SUPER_WORD.sub(word, line)
            v = self._line_chance(line)
            if cut is not None and v is not None and v >= cut and (purple in line or _BV_WORD.search(line)):
                if purple in line:
                    line = _PURPLE_TAG.sub(f"{green} ({word})", line, count=1)
                elif "(" + word.lower() + ")" not in line.lower():
                    line = _BV_WORD.sub(f"{green} ({word})", line, count=1)
                line = line.replace(f"{green} ({word}) ({word})", f"{green} ({word})")
            lines.append(line)
        return "\n".join(lines)

    def line_best_value(self, text: str) -> bool:
        """True when a Discord line carries the Best value tag or light (🟣, '(Best value)', 'Best value')."""
        s = str(text or "")
        return self.emoji("SUPER") in s or bool(_BV_WORD.search(s))

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
