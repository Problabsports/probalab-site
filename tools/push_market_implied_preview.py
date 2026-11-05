#!/usr/bin/env python3
"""Commit + push data/market-implied.json to main only.

Safety:
- refuses if the working tree is dirty beyond this one file
- git pull --ff-only origin main before commit/push
- never force-pushes
"""
from __future__ import annotations
import subprocess, sys
from pathlib import Path

SITE = Path("/workspace/probalab-site")
BRANCH = "main"
FILE = "data/market-implied.json"

def git(*a):
    return subprocess.run(["git", "-C", str(SITE), *a], capture_output=True, text=True)

def main():
    cur = git("branch", "--show-current").stdout.strip()
    if cur != BRANCH:
        porcelain = git("status", "--porcelain").stdout.strip().splitlines()
        other = [l for l in porcelain if FILE not in l]
        if other:
            print(f"dirty tree (not only {FILE}); refuse"); return 1
        if git("checkout", BRANCH).returncode:
            print(f"not on {BRANCH} (on {cur}); checkout failed"); return 1

    porcelain = git("status", "--porcelain").stdout.strip().splitlines()
    other = [l for l in porcelain if FILE not in l]
    if other:
        print("dirty tree; refuse:\n" + "\n".join(other[:20])); return 1

    if git("fetch", "-q", "origin", BRANCH).returncode:
        print("fetch failed"); return 1
    pull = git("pull", "--ff-only", "-q", "origin", BRANCH)
    if pull.returncode:
        print("pull --ff-only failed:", (pull.stderr or pull.stdout)[-300:]); return 1

    porcelain = git("status", "--porcelain").stdout.strip().splitlines()
    other = [l for l in porcelain if FILE not in l]
    if other:
        print("dirty after pull; refuse"); return 1
    if not any(FILE in l for l in porcelain):
        print("no change"); return 0

    git("add", FILE)
    c = git("commit", "-m", "Market implied refresh")
    if c.returncode:
        print("commit failed:", c.stderr[-200:]); return 1
    r = git("push", "-q", "origin", BRANCH)
    if r.returncode:
        print("push failed:", r.stderr[-200:]); return 1
    print("pushed", BRANCH); return 0

if __name__ == "__main__":
    sys.exit(main())
