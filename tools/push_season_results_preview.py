#!/usr/bin/env python3
"""Commit + push NHL/EPL season result JSON to main only.

Safety:
- stages and commits only these season files; unrelated dirty or untracked files are left alone
- git pull --rebase origin main (with autostash) before push
- never force-pushes
- refuses if not already on main (does not switch branches)
"""
from __future__ import annotations
import subprocess, sys
from pathlib import Path

SITE = Path("/workspace/probalab-site")
BRANCH = "main"
FILES = ["data/nhl-season.json", "data/epl-season.json"]


def git(*a):
    return subprocess.run(["git", "-C", str(SITE), *a], capture_output=True, text=True)


def changed(path: str) -> bool:
    r = git("status", "--porcelain", "--", path)
    return bool(r.stdout.strip())


def main():
    cur = git("branch", "--show-current").stdout.strip()
    if cur != BRANCH:
        print(f"not on {BRANCH} (on {cur}); refuse"); return 1

    changed_files = [f for f in FILES if changed(f)]
    if not changed_files:
        print("no change"); return 0

    if git("fetch", "-q", "origin", BRANCH).returncode:
        print("fetch failed"); return 1

    add = git("add", "--", *changed_files)
    if add.returncode:
        print("add failed:", (add.stderr or add.stdout)[-200:]); return 1
    c = git("commit", "-m", "Season results refresh (NHL + EPL)", "--", *changed_files)
    if c.returncode:
        print("commit failed:", (c.stderr or c.stdout)[-200:]); return 1

    pull = git("-c", "rebase.autostash=true", "pull", "--rebase", "-q", "origin", BRANCH)
    if pull.returncode:
        print("pull --rebase failed:", (pull.stderr or pull.stdout)[-300:])
        if Path(SITE / ".git" / "rebase-merge").exists() or Path(SITE / ".git" / "rebase-apply").exists():
            git("rebase", "--abort")
            print("rebase aborted; local commit kept, not pushed")
        return 1

    r = git("push", "-q", "origin", BRANCH)
    if r.returncode:
        print("push failed:", (r.stderr or r.stdout)[-200:]); return 1
    print("pushed", BRANCH, ",".join(changed_files)); return 0


if __name__ == "__main__":
    sys.exit(main())
