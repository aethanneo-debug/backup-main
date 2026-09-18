---
description: Safely identify and remove leftover patch scripts, scratch files, and dead code
---

Goal: clean the repo root of historical one-off scripts and scratch files WITHOUT breaking anything.

1. List every root-level file that is not part of the app runtime/build/config (candidates: `patch_*.cjs`, `patch-*.cjs`, `patch*.js`, `fix*.cjs`, `fix*.py`, `rewrite_*.cjs`, `update_*.cjs`, `add_*.cjs`, `test_*.{js,cjs,ts,sh}`, `test-*.js`, `formatted.js`, `*.txt` scratch files, `wait.sh`, duplicate lockfile `bun.lock`).
2. For EACH candidate, prove it's unused: grep for references in `package.json` scripts, source files, docs, and other scripts. Mark anything referenced as KEEP.
3. Show me the table `File | Purpose (1 line) | Referenced? | Action (delete / move to scripts/archive / keep)`.
4. STOP and wait for my approval.
5. After approval: use `git rm` for deletions (so it's reversible from git), move keepers to `scripts/`, run `npm run lint` and `npm run build`, and summarize.

Also suggest `.gitignore` additions (e.g. `data_store.json`, `data_store.backup.json`, `__pycache__/`) and explain the impact of untracking the live data file.
