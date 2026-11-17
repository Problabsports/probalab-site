#!/usr/bin/env python3
"""Lights patch for a ProbaLab mini job: Discord and the tips check read lights.json (Best value is 🟣, not green+star).

Default is a DRY RUN: it prints what would change and changes nothing. Add --apply to write.
  python apply_lights_patch.py                      job folder = the folder this patch folder sits in
  python apply_lights_patch.py --job C:\\path\\to\\results_5pm
  python apply_lights_patch.py --job C:\\path\\to\\results_5pm --apply
  python apply_lights_patch.py --job C:\\path\\to\\results_5pm --undo   restore the .bak-lights copies

What --apply does (only text edits listed below; each file is backed up first as <file>.bak-lights):
  * copies probalab_lights\\ (lights.json + loader) into <job>\\scripts\\probalab_lights\\
  * send.py: every Discord post goes through the lights loader (old green+star -> 🟣) and the text actually posted is
    kept in <job>\\ledger\\discord_payloads\\<desk>-latest.json for the lights check
  * john_discord.py / multi_discord.py (they post directly): same green+star -> 🟣 fix
  * tips_check run_scan.py: cut-offs from lights.json (fixes EPL orange: it was 55%, the same as green) and the
    high-chance text shows the light as "🟣 Best value" / "🟢 Green"
  * results_5pm / john_desk: copies check_discord_lights.py into <job>\\scripts\\lights_check\\
A file whose expected text is not found is left alone and reported (the job on the mini may be newer than this
patch). Files already patched are skipped. Nothing is registered or scheduled; no keys are read or printed.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MARK = "probalab_lights"  # present in every patched file

SEND_HELPERS = '''
# ---- ProbaLab lights (added by the lights patch): lights.json decides how a light looks in Discord (Best value is
# 🟣, never green+star), and the text actually posted is kept for the lights check. Never blocks a post.
def _lights_fix(text: str) -> str:
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from probalab_lights import fix_discord_text
        return fix_discord_text(text)
    except Exception:  # noqa: BLE001
        return text


def _lights_save(desk: str, text: str, message_id) -> None:
    try:
        from probalab_lights import save_payload
        save_payload(desk, text, message_id)
    except Exception:  # noqa: BLE001
        pass


def load_env('''

DIRECT_HELPER = '''
# ---- ProbaLab lights (added by the lights patch): Best value is 🟣 in Discord, never green+star.
def _lights_fix(text):
    try:
        import sys as _sys
        from pathlib import Path as _Path
        _sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
        from probalab_lights import fix_discord_text
        return fix_discord_text(text)
    except Exception:  # noqa: BLE001
        return text

'''

TIPS_IMPORT = '''# ProbaLab lights (added by the lights patch): cut-offs and light names from lights.json, loaded on first use
# (keeps this file's top-level imports standard-library only).
def _lights():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from probalab_lights import LIGHTS
    return LIGHTS


TIP_LIGHTS = {"SUPER", "GREEN"}'''

# (relative path, [(old, new), ...]); "{H}" marks an insertion of a helper block.
EDITS = {
    "send": ("scripts/discord_alerts/send.py", [
        ("\n\ndef load_env(", "\n" + SEND_HELPERS),
        ('''    text = (content or "").strip()
    if not text:
        raise ValueError("discord alert text is empty")''', '''    text = (content or "").strip()
    if not text:
        raise ValueError("discord alert text is empty")
    text = _lights_fix(text)'''),
        ('''    return {"ok": True, "status": status, "message_id": message_id, "desk": desk}''',
         '''    _lights_save(desk, text[:1900], message_id)
    return {"ok": True, "status": status, "message_id": message_id, "desk": desk}'''),
    ]),
    "john_discord": ("scripts/tips_page/john_discord.py", [
        ('data=json.dumps({"content": message(resolved), "allowed_mentions": {"parse": []}})',
         'data=json.dumps({"content": _lights_fix(message(resolved)), "allowed_mentions": {"parse": []}})'),
        ("\n\ndef ", "\n" + DIRECT_HELPER + "\ndef "),
    ]),
    "multi_discord": ("scripts/tips_page/multi_discord.py", [
        ("    content = multis.format_discord_message(multi, kind=kind)",
         "    content = _lights_fix(multis.format_discord_message(multi, kind=kind))"),
        ("\n\ndef ", "\n" + DIRECT_HELPER + "\ndef "),
    ]),
    "tips_check": ("scripts/tips_check/run_scan.py", [
        ('TIP_LIGHTS = {"SUPER", "GREEN"}', TIPS_IMPORT),
        ('''    return "GREEN" if p >= 0.65 else "ORANGE" if p >= 0.55 else "RED"''',
         '''    return _lights().game_light("nhl", p)'''),
        ('''            light = norm_light(g.get("light") or "")
            if not light:
                thr = HC_THRESHOLDS.get(sport, 0.65)
                light = "GREEN" if p >= thr else "ORANGE" if p >= 0.55 else "RED"''',
         '''            light = norm_light(g.get("light") or "")
            # the light the site shows (lights.json): feed light checked against the cut-offs, else from the chance
            light = _lights().shown_light(sport.lower(), light, p) if _lights().sport_cfg(sport.lower()) else light
            if not light:
                thr = HC_THRESHOLDS.get(sport, 0.65)
                light = "GREEN" if p >= thr else "ORANGE" if p >= 0.55 else "RED"'''),
        ('''    pct = f"{float(row['pick_p'])*100:.0f}%" if float(row.get("pick_p") or 0) <= 1 else f"{float(row['pick_p']):.0f}%"''',
         '''    _p = float(row.get("pick_p") or 0)
    pct = _lights().chance_text(_p if _p <= 1 else _p / 100)  # rounded down, like its light (54.9% shows 54%)'''),
        ('''        f"🎯 High chance — {row['sport']} ({row['light']})",''',
         '''        f"🎯 High chance — {row['sport']} ({_lights().tag(row['light']) or row['light']})",'''),
    ]),
}
JOBS = {
    "results_5pm": {"edits": ["send", "john_discord", "multi_discord"], "check": True},
    "john_desk": {"edits": ["send", "john_discord", "multi_discord"], "check": True},
    "nhl_value": {"edits": ["send"], "check": False},
    "tips_check": {"edits": ["tips_check"], "check": False},
}
LEGACY = re.compile(r"🟢\s*⭐|⭐\s*🟢|🟢\s*🌟|:green_circle:\s*:star:|:star:\s*:green_circle:|\\U0001F7E2.{0,12}\\u2b50|\\u2b50.{0,12}\\U0001F7E2", re.I)


def plan_file(path: Path, edits):
    """(new_text, status): status is 'patch', 'already', 'missing' or 'anchor: <text>'."""
    if not path.is_file():
        return None, "missing"
    s = path.read_text(encoding="utf-8")
    if MARK in s:
        return None, "already"
    nl = "\r\n" if "\r\n" in s else "\n"
    out = s.replace("\r\n", "\n")
    for old, new in edits:
        if out.count(old) < 1:
            return None, "anchor: " + old.strip().splitlines()[0][:70]
        out = out.replace(old, new, 1)
    return out.replace("\n", nl), "patch"


def main(argv=None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--job", help="the job folder (has scripts\\ inside); default: the folder above this patch folder")
    ap.add_argument("--name", help="job type: " + ", ".join(JOBS) + " (default from job.json)")
    act = ap.add_mutually_exclusive_group()
    act.add_argument("--apply", action="store_true", help="write the changes (default is a dry run)")
    act.add_argument("--undo", action="store_true", help="put back the .bak-lights copies")
    a = ap.parse_args(argv)
    meta = json.loads((HERE / "job.json").read_text(encoding="utf-8")) if (HERE / "job.json").is_file() else {}
    name = a.name or meta.get("job")
    if name not in JOBS:
        print("unknown job; use --name " + " | ".join(JOBS))
        return 2
    job = Path(a.job) if a.job else HERE.parent
    if not (job / "scripts").is_dir():
        print(f"{job} has no scripts folder: pass --job <the {name} folder>")
        return 2
    spec = JOBS[name]
    print(f"{'APPLY' if a.apply else 'UNDO' if a.undo else 'DRY RUN'}: lights patch for {name} in {job}")

    if a.undo:
        n = 0
        for key in spec["edits"]:
            p = job / EDITS[key][0]
            b = p.with_name(p.name + ".bak-lights")
            if b.is_file():
                shutil.copy2(b, p)
                n += 1
                print(f"  restored {EDITS[key][0]}")
        print(f"{n} file(s) restored. probalab_lights\\ and lights_check\\ folders are left (unused once restored).")
        return 0

    problems = 0
    for key in spec["edits"]:
        rel, edits = EDITS[key]
        p = job / rel
        new, status = plan_file(p, edits)
        if status == "missing":
            print(f"  skip   {rel} (not in this job)")
        elif status == "already":
            print(f"  ok     {rel} (already patched)")
        elif status.startswith("anchor"):
            problems += 1
            print(f"  LEFT   {rel}: expected text not found ({status[8:]}). This file differs from the version the patch "
                  f"was written for; nothing changed in it.")
        else:
            print(f"  patch  {rel}")
            if a.apply:
                shutil.copy2(p, p.with_name(p.name + ".bak-lights"))
                p.write_text(new, encoding="utf-8", newline="")
    dst = job / "scripts" / "probalab_lights"
    print(f"  copy   probalab_lights\\ (lights.json + loader) -> scripts\\probalab_lights\\")
    if a.apply:
        shutil.copytree(HERE / "probalab_lights", dst, dirs_exist_ok=True)
    if spec["check"]:
        print(f"  copy   check_discord_lights.py -> scripts\\lights_check\\")
        if a.apply:
            (job / "scripts" / "lights_check").mkdir(parents=True, exist_ok=True)
            shutil.copy2(HERE / "check_discord_lights.py", job / "scripts" / "lights_check" / "check_discord_lights.py")

    # anything else in the job that writes the old green+star (send.py already fixes it at post time; listed for info)
    left = []
    for f in (job / "scripts").rglob("*.py"):
        if "probalab_lights" in f.parts or f.name.endswith(".bak-lights"):
            continue
        try:
            for i, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                if LEGACY.search(line):
                    left.append(f"{f.relative_to(job)}:{i}")
        except OSError:
            pass
    if left:
        print("  note   old green+star Best value marker still written here (send.py turns it into 🟣 when posting):")
        for x in left[:20]:
            print("           " + x)
    print("Done." if a.apply else "Dry run only: nothing changed. Run again with --apply to write.")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
