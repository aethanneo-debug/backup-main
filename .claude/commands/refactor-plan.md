---
description: Architect a safe, incremental refactor or migration plan
argument-hint: <what to restructure, e.g. "split server.ts" or "migrate finance to FastAPI">
---

Refactor goal: $ARGUMENTS

Delegate to the `architect` subagent for the plan (current state, target state with Mermaid + folder tree, phased steps with verification and rollback).

Show me the plan and wait. When I approve a phase, execute ONLY that phase, keep `npm run dev` and `npm run lint` working, and stop at the end of the phase for review.
