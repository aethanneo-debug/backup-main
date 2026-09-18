---
description: Scaffold a new API endpoint end-to-end (type → route with RBAC + audit → frontend call)
argument-hint: <METHOD /api/path — what it does — which roles>
---

Create a new endpoint: $ARGUMENTS

Follow the project pattern exactly:
1. **Types** — add/extend interfaces in `src/types.ts`.
2. **Route** in `server.ts`, placed next to related routes: `authenticateToken` → validate input (400) → role check (403) → ownership check if employee-scoped → mutate `db` → `logEvent(...)` for state changes → `saveDB()` → `{ status: "success", data }`.
3. **Seed/migration** — if a new `db` collection is needed, initialize it in `getInitialData()` so existing `data_store.json` files upgrade safely.
4. **Frontend** — call it with `apiCall`, handle loading/error, guard arrays.
5. **FastAPI parity** — tell me whether the equivalent exists in `backend_fastapi/` and what it would take (don't implement unless I ask).
6. Run `npm run lint`, then smoke-test with curl if the dev server is up (log in as a permitted role AND a forbidden role to prove the 403).

If the roles aren't specified, ask me before writing the route.
