#!/usr/bin/env python3
"""Commit + push data/market-implied.json to preview/today-accuracy only (never main)."""
from __future__ import annotations
import subprocess, sys
from pathlib import Path

SITE = Path("/workspace/probalab-site")
BRANCH = "preview/today-accuracy"
FILE = "data/market-implied.json"

def git(*a):
    return subprocess.run(["git", "-C", str(SITE), *a], capture_output=True, text=True)

def main():
    st = git("status", "--porcelain", FILE)
    if not st.stdout.strip():
        print("no change"); return 0
    # Stay on preview branch; refuse if somehow on main
    cur = git("branch", "--show-current").stdout.strip()
    if cur != BRANCH:
        # try checkout preview without disturbing unrelated work
        if git("checkout", BRANCH).returncode:
            print(f"not on {BRANCH} (on {cur}); skip push"); return 1
    git("add", FILE)
    c = git("commit", "-m", "Market implied refresh (preview)")
    if c.returncode:
        print("commit failed:", c.stderr[-200:]); return 1
    git("fetch", "-q", "origin", BRANCH)
    if git("pull", "--rebase", "-q", "origin", BRANCH).returncode:
        git("rebase", "--abort")
        print("rebase failed"); return 1
    r = git("push", "-q", "origin", BRANCH)
    if r.returncode:
        print("push failed:", r.stderr[-200:]); return 1
    print("pushed", BRANCH); return 0

if __name__ == "__main__":
    sys.exit(main())
