---
description: Compare Express (server.ts) and FastAPI backends — routes, shapes, auth, and schema drift
---

Use the `codebase-analyst` subagent to produce a backend parity report:

1. Table of every route: `Path | Method | Express (line) | FastAPI (line) | Response shape match? | Auth/RBAC match? | Notes`.
2. Data model drift: `src/types.ts` vs `backend_fastapi/models.py` vs `backend_fastapi/schemas.py` vs `database/schema.sql` — missing tables/fields, type mismatches, naming (camelCase vs snake_case) differences.
3. Password hashing / JWT differences between the two backends and what a user migration requires.
4. Recommended migration order (smallest-risk domain first) with effort estimates.

Read-only. Do not change files.
