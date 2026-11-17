"""Builds the lights patch folders for the mini jobs from this repo's lights.json (the single source of truth).

    python tools/mini_lights/package.py [--out C:\\Users\\jwcob\\ClosingLine\\lights\\dist]

Writes <out>/<job>_lights_v2/ (+ .zip) for results_5pm, tips_check, john_desk and nhl_value. Registers nothing.
v2 (18 Nov 2026): green first. A 65%+ NBA Best value game is GREEN with a Best value tag ("🟢 (Best value)" in Discord).
"""
import argparse
import json
import shutil
import zipfile
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROOT = SRC.parents[1]
DEFAULT_OUT = Path(r"C:\Users\jwcob\ClosingLine\lights\dist_v2_green_first")

WHAT = {
    "results_5pm": ("the 5pm results job",
                    "* `scripts\\discord_alerts\\send.py`: every Discord post (the #tip-results digest and the desk lines) goes through the lights loader, "
                    "so an old green+star Best value marker is posted as 🟣; the text actually posted is kept in `ledger\\discord_payloads\\<desk>-latest.json`.\n"
                    "* `scripts\\tips_page\\john_discord.py`, `multi_discord.py` (they post directly): same 🟣 fix.\n"
                    "* Adds `scripts\\lights_check\\check_discord_lights.py` (the lights check, below)."),
    "john_desk": ("John's desk job",
                  "* `scripts\\discord_alerts\\send.py`: every desk alert goes through the lights loader (old green+star -> 🟣); the posted text is kept in "
                  "`ledger\\discord_payloads\\<desk>-latest.json`.\n"
                  "* `scripts\\tips_page\\john_discord.py`, `multi_discord.py` (they post to #john directly): same 🟣 fix.\n"
                  "* Adds `scripts\\lights_check\\check_discord_lights.py`."),
    "nhl_value": ("the NHL value job",
                  "* `scripts\\discord_alerts\\send.py`: every #nhl-value post goes through the lights loader (old green+star -> 🟣) and is kept in "
                  "`ledger\\discord_payloads\\nhl-value-latest.json`. (NHL has no Best value light; the alerts themselves are unchanged.)"),
    "tips_check": ("the tips check job",
                   "* `scripts\\tips_check\\run_scan.py`: high-chance cut-offs come from lights.json and use the light the site shows "
                   "(an NBA feed GREEN under 65% is a held value pick: orange on the site, so not high chance; Best value needs 60%+). "
                   "Fixes the EPL / Championship fallback, where orange started at 55% (the same as green), so an orange pick could not exist.\n"
                   "* The would-post high-chance line shows the light as `🟣 Best value` / `🟢 Green` instead of `(SUPER)` / `(GREEN)`."),
}


GREEN_FIRST = {
    "results_5pm": "* Discord (`send.py`, `john_discord.py`, `multi_discord.py`): a Best value line whose chance is 65%+ is posted as "
                   "`🟢 (Best value)`; 60–64% stays `🟣 Best value`; the word SUPER is never posted.\n"
                   "* `scripts\\tips_page\\export_tips.py`: ProbaLab site picks and open bets get a `best_value` flag, so the members "
                   "desk shows *Green + Best value*. The light itself and the NBA rule flags are unchanged by this patch.\n"
                   "* John's NBA rule (decided 18 Nov): once the feed sends GREEN for 65%+ Best value picks (ops apply.sql, run in "
                   "Supabase), they count toward the rule as GREEN. Nothing to change on the mini for that.\n"
                   "* `check_discord_lights.py`: a 65%+ Best value game must be `🟢 (Best value)` in Discord; 🟣, or a plain 🟢, is a MISMATCH.",
    "john_desk": "* Discord (`send.py`, `john_discord.py`, `multi_discord.py` to #john): a Best value line whose chance is 65%+ is posted as "
                 "`🟢 (Best value)`; 60–64% stays `🟣 Best value`; the word SUPER is never posted.\n"
                 "* `scripts\\tips_page\\export_tips.py`: ProbaLab site picks and open bets get a `best_value` flag (members desk). "
                 "The light itself and the NBA rule flags are unchanged by this patch.\n"
                 "* John's NBA rule (decided 18 Nov): once the feed sends GREEN for 65%+ Best value picks, they count toward the "
                 "rule as GREEN. Nothing to change on the mini for that.\n"
                 "* `check_discord_lights.py`: a 65%+ Best value game must be `🟢 (Best value)`; 🟣, or a plain 🟢, is a MISMATCH.",
    "nhl_value": "* Loader refresh only (NHL has no Best value light): same lights.json as the site, and the word SUPER is never posted.",
    "tips_check": "* `run_scan.py` already uses the site's light (patched last time), so with the refreshed loader a 65%+ NBA Best value "
                  "pick is GREEN (high chance, `🟢 Green`), and 60–64% stays `🟣 Best value`. The would-post line does not add "
                  "\"(Best value)\" (it is not posted to Discord).",
}


def readme(job: str) -> str:
    who, changes = WHAT[job]
    check = job in ("results_5pm", "john_desk")
    return f"""# Lights patch v2 (green first): {job}

## New in v2 (18 Nov 2026): green first
A 65%+ NBA game that also beats our fair price is **GREEN** with a Best value tag, the same as probalabsports.com.
Best value as the light is only for 60–64%. The word "Super" is never shown or posted.
{GREEN_FIRST[job]}

**Already patched last time (v1)?** Just run the same steps again: files patched by v1 are listed as `ok (already
patched)` and stay as they are; the loader in `scripts\\probalab_lights\\` is refreshed (that is where the new rule
lives){", the members-desk export is patched" if check else ""}{" and the lights check is refreshed" if check else ""}.

One lights config for the site and the mini jobs: `probalab_lights\\lights.json` is a copy of the site's `lights.json`
(game cut-offs per sport, Best value, the props scale, colours, labels and Discord emoji: 🟢 green, 🟠 orange, 🔴 red,
🟣 Best value). This folder patches {who} so Discord uses 🟣 for Best value instead of green+star, and the light
rules come from that file.

## What changes
{changes}
* Copies `probalab_lights\\` (lights.json + a small loader, standard library only) into `scripts\\probalab_lights\\`.

Each edited file is backed up first as `<file>.bak-lights`. A file whose expected text is not found (the copy on the
mini may be newer than the one this patch was written against) is left alone and listed as `LEFT`; nothing is
half-patched. Running it twice is safe (patched files are skipped). No keys are read or printed. **Nothing is
registered or rescheduled**: the existing scheduled tasks keep running the same scripts.

Note: the copies of these jobs on the main PC (zips from 15–16 Nov) never write a green+star marker themselves; the
`send.py` hook converts it at post time wherever it comes from, and the apply step lists any file on the mini that
still writes one.

## Steps (on the mini, in a normal PowerShell; stop nothing)
```powershell
# 1. copy this folder into the job folder, e.g. C:\\...\\{job}\\{job}_lights\\
cd C:\\path\\to\\{job}\\{job}_lights
# 2. dry run: shows what would change, changes nothing
python apply_lights_patch.py
# 3. apply
python apply_lights_patch.py --apply
# 4. this folder's own tests (offline)
python -m pytest -q tests
# undo (puts back the .bak-lights copies)
python apply_lights_patch.py --undo
```
If the job folder is somewhere else: `python apply_lights_patch.py --job C:\\path\\to\\{job} --apply`.
""" + ("""
## The lights check
Compares the light shown in the latest Discord payload with the light the site shows for the same games:
```powershell
cd C:\\path\\to\\JOB
python scripts\\lights_check\\check_discord_lights.py                 # newest file in ledger\\discord_payloads
python scripts\\lights_check\\check_discord_lights.py --payload ledger\\discord_payloads\\tip-results-latest.json
python scripts\\lights_check\\check_discord_lights.py --payload some_export.json --json
```
It reads the payload (saved by the patched send.py, a Discord message export, or a text file such as tips_check's
would-post file), finds every line with a light (🟣 🟢 🟠 🔴, the old green+star, or SUPER / Best value / GREEN /
ORANGE / RED) and two teams or players, matches it to the site game starting within 4 days of the post
(`--days` to change) and compares with the site's light, using the site's own `/lights.json` and public feeds
(read only, no key). It prints `OK`, `MISMATCH` (both lights shown) or `UNMATCHED` (a light with no site game found).
Exit code 0 = all match, 1 = a mismatch, 2 = nothing to check. The #tip-results digest in the 15–16 Nov copy lists
totals only (no game lines), so the check has game lines to compare only when a post lists games with lights.
""".replace("JOB", job) if check else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    out = Path(ap.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)
    for job in WHAT:
        d = out / f"{job}_lights_v2"
        if d.exists():
            shutil.rmtree(d)
        (d / "probalab_lights").mkdir(parents=True)
        (d / "tests").mkdir()
        shutil.copy2(SRC / "probalab_lights" / "__init__.py", d / "probalab_lights" / "__init__.py")
        shutil.copy2(ROOT / "lights.json", d / "probalab_lights" / "lights.json")
        for f in ("apply_lights_patch.py", "check_discord_lights.py"):
            shutil.copy2(SRC / f, d / f)
        shutil.copy2(SRC / "tests" / "test_lights_patch.py", d / "tests" / "test_lights_patch.py")
        (d / "job.json").write_text(json.dumps({"job": job, "version": 2, "rule": "green first"}) + "\n", encoding="utf-8")
        (d / "README.md").write_text(readme(job), encoding="utf-8")
        z = out / f"{job}_lights_v2.zip"
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in sorted(d.rglob("*")):
                if f.is_file() and "__pycache__" not in f.parts:
                    zf.write(f, f.relative_to(out))
        print("wrote", d, "and", z.name)


if __name__ == "__main__":
    main()
