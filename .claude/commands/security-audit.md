---
description: Full security audit — auth, route-by-route RBAC table, secrets, PII, uploads, CORS, dependencies
argument-hint: [optional scope]
---

Run the `security-auditor` subagent. Scope: $ARGUMENTS (default: whole project, both backends).

Required deliverable: the complete route RBAC table for every Express route, plus prioritized findings with exact code fixes.

Then offer to implement the fixes in order, starting with a shared `requireRole(...roles)` and `requireSelfOrRole(...)` middleware in `server.ts`. Don't start implementing until I confirm.
