"""Offline tests for the lights patch (no network, no Discord). Run from the patch folder:  python -m pytest -q tests"""
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from probalab_lights import LIGHTS, Lights, fix_discord_text  # noqa: E402
import check_discord_lights as C  # noqa: E402


def test_lights_json_values():
    d = LIGHTS.data
    assert [d["games"][s]["green_min"] for s in ("nba", "nfl", "nhl", "epl", "championship", "tennis")] == [0.65, 0.65, 0.65, 0.55, 0.55, 0.70]
    assert d["best_value"]["sports"] == ["nba"] and d["best_value"]["light"] == "SUPER"
    assert [LIGHTS.emoji(x) for x in ("SUPER", "GREEN", "ORANGE", "RED")] == ["🟣", "🟢", "🟠", "🔴"]
    assert LIGHTS.tag("SUPER") == "🟣 Best value"
    assert LIGHTS.scale_text("nba") == {"GREEN": "65%+", "ORANGE": "55–64%", "RED": "under 55%"}
    assert (d["props"]["green_min"], d["props"]["orange_min"]) == (0.60, 0.55)


def test_rules_match_the_site():
    assert LIGHTS.shown_light("nba", "GREEN", 0.63) == "ORANGE"      # held value pick keeps its cut-off light
    assert LIGHTS.shown_light("nba", "SUPER", 0.59) == "ORANGE"      # Best value needs 60%+
    assert LIGHTS.shown_light("nba", "SUPER", 0.61) == "SUPER"
    assert LIGHTS.shown_light("nfl", "SUPER", 0.70) == "GREEN"       # Best value is NBA only
    assert LIGHTS.game_light("epl", 0.50) == "ORANGE" and LIGHTS.game_light("tennis", 0.69) == "ORANGE"
    assert LIGHTS.props_light(0.595) == "ORANGE" and LIGHTS.props_light(0.6) == "GREEN" and LIGHTS.props_light(0.549) == "RED"
    # shown chances round down and lights are judged on them: 54.9% shows 54% and is red
    assert LIGHTS.chance_text(0.549) == "54%" and LIGHTS.game_light("nba", 0.549) == "RED"
    assert LIGHTS.chance_text(0.57) == "57%" and LIGHTS.game_light("nba", 0.6499) == "ORANGE"


def test_discord_text_uses_purple_for_best_value():
    assert fix_discord_text("🟢⭐ POR @ MIN") == "🟣 POR @ MIN"
    assert fix_discord_text(":green_circle: :star: POR @ MIN") == "🟣 POR @ MIN"
    assert fix_discord_text("🟢 DEN") == "🟢 DEN", "plain green is untouched"
    assert fix_discord_text(None) == ""


def test_light_marker():
    assert LIGHTS.light_marker("🟢⭐ x")[0] == "SUPER"
    assert LIGHTS.light_marker("🎯 High chance — NBA (🟣 Best value)")[0] == "SUPER"
    assert LIGHTS.light_marker("🎯 High chance — EPL (GREEN)")[0] == "GREEN"
    assert LIGHTS.light_marker("Green Bay Packers @ Detroit Lions") == (None, None), "team names are not lights"


def _games():
    t = datetime(2026, 11, 18, 0, 0, tzinfo=timezone.utc)
    mk = lambda sport, away, home, aa, ha, light, p: {"sport": sport, "id": away + home, "away": away, "home": home, "start": t, "light": light, "p": p,
                                                      "pick": home, "teams": [C.aliases(away, aa, sport), C.aliases(home, ha, sport)]}
    return [mk("nba", "Portland Trail Blazers", "Minnesota Timberwolves", "POR", "MIN", "SUPER", 0.61),
            mk("nba", "Phoenix Suns", "Denver Nuggets", "PHX", "DEN", "GREEN", 0.77),
            mk("nhl", "Montréal Canadiens", "New York Rangers", "MTL", "NYR", "RED", 0.52)]


def test_check_compares_lights():
    sent = datetime(2026, 11, 18, 6, 0, tzinfo=timezone.utc)
    text = "🟢⭐ POR @ MIN · Timberwolves 61%\n🔴 Suns @ Nuggets\n\n🎯 High chance — NHL (RED)\nMontréal Canadiens @ New York Rangers\n\n🟢 Nowhere @ Imaginary\nJohn tips today 3/5"
    rows = C.check(text, sent, _games(), LIGHTS)
    st = {(r["status"], r["game"] or r["line"]) for r in rows}
    assert ("OK", "Portland Trail Blazers @ Minnesota Timberwolves") in st
    assert ("MISMATCH", "Phoenix Suns @ Denver Nuggets") in st
    assert ("OK", "Montréal Canadiens @ New York Rangers") in st
    assert ("UNMATCHED", "🟢 Nowhere @ Imaginary") in st
    assert len(rows) == 4


def test_apply_dry_run_then_apply_on_a_sample_job(tmp_path):
    job = tmp_path / "nhl_value"
    send = job / "scripts" / "discord_alerts" / "send.py"
    send.parent.mkdir(parents=True)
    send.write_text('import sys\nfrom pathlib import Path\n\n\ndef load_env(path=None):\n    pass\n\n\ndef send_alert(desk, content, wait=False):\n'
                    '    text = (content or "").strip()\n    if not text:\n        raise ValueError("discord alert text is empty")\n'
                    '    message_id = None\n    status = 204\n    return {"ok": True, "status": status, "message_id": message_id, "desk": desk}\n', encoding="utf-8")
    before = send.read_text(encoding="utf-8")
    run = lambda *a: subprocess.run([sys.executable, str(HERE / "apply_lights_patch.py"), "--job", str(job), "--name", "nhl_value", *a],
                                    capture_output=True, text=True, encoding="utf-8")
    r = run()
    assert r.returncode == 0 and "DRY RUN" in r.stdout and send.read_text(encoding="utf-8") == before, r.stdout + r.stderr
    r = run("--apply")
    assert r.returncode == 0, r.stdout + r.stderr
    after = send.read_text(encoding="utf-8")
    assert "_lights_fix(text)" in after and "_lights_save(desk" in after and (send.parent / "send.py.bak-lights").is_file()
    assert (job / "scripts" / "probalab_lights" / "lights.json").is_file()
    assert "already patched" in run("--apply").stdout
    assert run("--undo").returncode == 0 and send.read_text(encoding="utf-8") == before


def test_apply_leaves_a_file_it_does_not_recognise(tmp_path):
    job = tmp_path / "nhl_value"
    send = job / "scripts" / "discord_alerts" / "send.py"
    send.parent.mkdir(parents=True)
    send.write_text("def send_alert(desk, content):\n    return None\n", encoding="utf-8")
    r = subprocess.run([sys.executable, str(HERE / "apply_lights_patch.py"), "--job", str(job), "--name", "nhl_value", "--apply"],
                       capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 1 and "LEFT" in r.stdout
    assert send.read_text(encoding="utf-8") == "def send_alert(desk, content):\n    return None\n"


# ---------------------------------------------------------------- green first (patch v2, 18 Nov 2026)
def test_green_first_rules():
    assert LIGHTS.shown_light("nba", "SUPER", 0.77) == "GREEN"            # 65%+ Best value is GREEN
    assert LIGHTS.shown_light("nba", "SUPER", 0.6499) == "SUPER"          # Best value light only below the green range
    assert LIGHTS.best_value_tag("nba", "SUPER", 0.77) and LIGHTS.best_value_tag("nba", "SUPER", 0.61)
    assert LIGHTS.best_value_tag("nba", "GREEN", 0.77, True), "newer feed: GREEN + best_value true"
    assert not LIGHTS.best_value_tag("nba", "GREEN", 0.77) and not LIGHTS.best_value_tag("nfl", "SUPER", 0.8)
    assert LIGHTS.discord_marker("nba", "SUPER", 0.77) == "🟢 (Best value)"
    assert LIGHTS.discord_marker("nba", "GREEN", 0.764, True) == "🟢 (Best value)"
    assert LIGHTS.discord_marker("nba", "SUPER", 0.61) == "🟣 Best value"
    assert LIGHTS.discord_marker("nba", "GREEN", 0.70) == "🟢 Green"


def test_discord_text_green_first():
    f = fix_discord_text
    assert f("🟣 LA Clippers 77% · Jazz @ Clippers") == "🟢 (Best value) LA Clippers 77% · Jazz @ Clippers"
    assert f("🟣 Best value Lakers 76%") == "🟢 (Best value) Lakers 76%"
    assert f("🟢⭐ Lakers 76%") == "🟢 (Best value) Lakers 76%", "old green+star at 65%+ is green + tag"
    assert f("🟣 Best value · Bulls 61%") == "🟣 Best value · Bulls 61%", "below the green range stays Best value"
    assert f("🟣 Clippers 77% (+9.8% value)") == "🟢 (Best value) Clippers 77% (+9.8% value)", "signed % is not a chance"
    assert f("🟣 Clippers") == "🟣 Clippers", "no chance on the line: unchanged (the check flags it)"
    assert f("🟢 Celtics 70%") == "🟢 Celtics 70%", "plain green untouched"
    assert "SUPER" not in f("SUPER GREEN Lakers 76%") and f("SUPER GREEN Lakers 76%") == "🟢 (Best value) Lakers 76%"
    assert f("SUPER pick: Bulls 61%") == "Best value pick: Bulls 61%", "never the word SUPER"
    assert f("Green Bay Packers @ Detroit Lions 70%") == "Green Bay Packers @ Detroit Lions 70%"
    assert f("🟣 Clippers 77%\n🟣 Bulls 61%") == "🟢 (Best value) Clippers 77%\n🟣 Bulls 61%", "line by line"
    assert f(f("🟣 Clippers 77%")) == "🟢 (Best value) Clippers 77%", "running it twice changes nothing"


def test_check_green_first():
    t = datetime(2026, 11, 18, 0, 0, tzinfo=timezone.utc)
    g = {"sport": "nba", "id": "401910006", "away": "Utah Jazz", "home": "LA Clippers", "start": t, "light": "GREEN", "p": 0.777,
         "pick": "LA Clippers", "best_value": True, "teams": [C.aliases("Utah Jazz", "UTAH", "nba"), C.aliases("LA Clippers", "LAC", "nba")]}
    sent = datetime(2026, 11, 18, 6, 0, tzinfo=timezone.utc)
    st = lambda line: C.check(line, sent, [g], LIGHTS)[0]["status"]
    assert st("🟢 (Best value) Utah Jazz @ LA Clippers · 77%") == "OK"
    assert st("🟣 Utah Jazz @ LA Clippers · 77%") == "MISMATCH", "purple for a green-range game"
    assert st("🟢 Utah Jazz @ LA Clippers · 77%") == "MISMATCH", "green without the (Best value) tag"
    plain = dict(g, best_value=False)
    assert C.check("🟢 (Best value) Utah Jazz @ LA Clippers", sent, [plain], LIGHTS)[0]["status"] == "MISMATCH", "tag on a plain green"
    assert C.check("🟢 Utah Jazz @ LA Clippers", sent, [plain], LIGHTS)[0]["status"] == "OK"


EXPORT_SAMPLE = '''import sys


def probalab_site_tips(now=None):
    out = []
    for g in []:
            out.append({
                "bet_id": bid, "pick_id": pid, "sport": sport, "game": game,
                "selection": sel, "market": market, "light": light, "win_pct": round(p, 4),
                "kickoff_utc": ko,
            })
    return out


def refresh(doc, pl_latest):
    for row in doc.get("open_bets") or []:
        current = pl_latest.get(row.get("pick_id")) or {}
        if current.get("light"):
            row["light"] = P.norm_light(current["light"])
            row["win_pct"] = _f(current.get("pick_p"))
'''


def test_export_tips_gets_best_value(tmp_path):
    job = tmp_path / "results_5pm"
    ex = job / "scripts" / "tips_page" / "export_tips.py"
    ex.parent.mkdir(parents=True)
    ex.write_text(EXPORT_SAMPLE, encoding="utf-8")
    r = subprocess.run([sys.executable, str(HERE / "apply_lights_patch.py"), "--job", str(job), "--name", "results_5pm", "--apply"],
                       capture_output=True, text=True, encoding="utf-8")
    assert "patch  scripts/tips_page/export_tips.py" in r.stdout, r.stdout + r.stderr
    s = ex.read_text(encoding="utf-8")
    assert '"best_value": _pl_best_value(sport, g.get("light"), p, g.get("best_value")),' in s
    assert 'row["best_value"] = _pl_best_value(row.get("sport"), current.get("light"), current.get("pick_p"), current.get("best_value"))' in s
    assert '"light": light, "win_pct": round(p, 4),' in s, "the light itself is unchanged"
    ns = {}
    sys.path.insert(0, str(job / "scripts"))
    try:
        exec(compile(s.split("\ndef probalab_site_tips(")[0], "export_tips", "exec"), ns)
        assert ns["_pl_best_value"]("NBA", "SUPER", 0.687) is True
        assert ns["_pl_best_value"]("NBA", "GREEN", 0.77, True) is True
        assert ns["_pl_best_value"]("NBA", "GREEN", 0.70) is False
        assert ns["_pl_best_value"]("NFL", "SUPER", 0.8) is False
    finally:
        sys.path.remove(str(job / "scripts"))
    assert "already patched" in subprocess.run([sys.executable, str(HERE / "apply_lights_patch.py"), "--job", str(job), "--name", "results_5pm", "--apply"],
                                               capture_output=True, text=True, encoding="utf-8").stdout


def test_v1_patched_job_gets_the_new_rule_by_reapplying(tmp_path):
    """A job patched last time (send.py already has the hook) only needs the refreshed loader."""
    job = tmp_path / "nhl_value"
    send = job / "scripts" / "discord_alerts" / "send.py"
    send.parent.mkdir(parents=True)
    send.write_text("# patched by v1: probalab_lights hook\nimport sys\nfrom pathlib import Path\n", encoding="utf-8")
    old = job / "scripts" / "probalab_lights"
    old.mkdir(parents=True)
    (old / "__init__.py").write_text("# v1 loader\n", encoding="utf-8")
    r = subprocess.run([sys.executable, str(HERE / "apply_lights_patch.py"), "--job", str(job), "--name", "nhl_value", "--apply"],
                       capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0 and "already patched" in r.stdout, r.stdout + r.stderr
    new = (old / "__init__.py").read_text(encoding="utf-8")
    assert "def discord_marker" in new and "def best_value_tag" in new, "loader refreshed with the green-first rule"
    assert (old / "lights.json").is_file()
    assert json.loads((old / "lights.json").read_text(encoding="utf-8"))["order"][0] == "GREEN"
