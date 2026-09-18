---
description: Full senior-level analysis of the whole project (or one area) — architecture, quality, security, UX, and a prioritized action plan
argument-hint: [optional area, e.g. "finance" or "auth"]
---

Perform a senior-engineer analysis of this project. Focus area: $ARGUMENTS (if empty, analyze the entire project).

Run these subagents **in parallel**, each scoped to the focus area:
1. `codebase-analyst` — architecture map, data flow, dead code, duplication, size/complexity hotspots.
2. `security-auditor` — auth, RBAC route table, secrets, PII.
3. `ui-designer` — READ-ONLY UX/design-consistency audit of the relevant views (do not edit anything).

Then also run `npm run lint` yourself and note the error count.

Combine the results into one report:
- **Executive summary** (5 bullets max — the health of the project in plain language)
- **Architecture** (Mermaid diagram + short explanation)
- **Top 10 issues** ranked by impact × effort, each with file:line, severity, and the fix
- **Quick wins** (< 30 min each)
- **Roadmap** — 3 phases (Stabilize → Restructure → Scale)

Update `.claude/context/known-issues.md` with any NEW verified issues (ask before removing entries).
