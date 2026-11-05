#!/usr/bin/env python3
"""Commit + push NHL/EPL season result JSON to main only.

Safety:
- refuses if the working tree is dirty beyond these season files
- git pull --ff-only origin main before commit/push
- never force-pushes
"""
from __future__ import annotations
import subprocess, sys
from pathlib import Path

SITE = Path("/workspace/probalab-site")
BRANCH = "main"
FILES = ["data/nhl-season.json", "data/epl-season.json"]

def git(*a):
    return subprocess.run(["git", "-C", str(SITE), *a], capture_output=True, text=True)

def main():
    cur = git("branch", "--show-current").stdout.strip()
    porcelain = git("status", "--porcelain").stdout.strip().splitlines()
    other = [l for l in porcelain if not any(f in l for f in FILES)]
    if cur != BRANCH:
        if other:
            print(f"on {cur}; dirty beyond season files; refuse"); return 1
        # stash-free checkout only when tree is clean except our files
        if git("checkout", BRANCH).returncode:
            print(f"checkout {BRANCH} failed"); return 1

    porcelain = git("status", "--porcelain").stdout.strip().splitlines()
    other = [l for l in porcelain if not any(f in l for f in FILES)]
    if other:
        print("dirty tree; refuse:\n" + "\n".join(other[:20])); return 1

    if git("fetch", "-q", "origin", BRANCH).returncode:
        print("fetch failed"); return 1
    pull = git("pull", "--ff-only", "-q", "origin", BRANCH)
    if pull.returncode:
        print("pull --ff-only failed:", (pull.stderr or pull.stdout)[-300:]); return 1

    porcelain = git("status", "--porcelain").stdout.strip().splitlines()
    other = [l for l in porcelain if not any(f in l for f in FILES)]
    if other:
        print("dirty after pull; refuse"); return 1
    changed = [f for f in FILES if any(f in l for l in porcelain)]
    if not changed:
        print("no change"); return 0

    git("add", *changed)
    c = git("commit", "-m", "Season results refresh (NHL + EPL)")
    if c.returncode:
        print("commit failed:", c.stderr[-200:]); return 1
    r = git("push", "-q", "origin", BRANCH)
    if r.returncode:
        print("push failed:", r.stderr[-200:]); return 1
    print("pushed", BRANCH, ",".join(changed)); return 0

if __name__ == "__main__":
    sys.exit(main())
