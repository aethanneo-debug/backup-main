# Known Issues & Technical Debt (verified from the code — keep this list updated)

Prioritized. When you fix one, remove or update its entry here.

## 🔴 Critical — security
1. **Master/dev password backdoor.** In `/api/auth/login` and `/api/auth/change-password`, any user without `passwordHash` authenticates with `password123` **or** `sandbox-master-pass`. The seeded users in `data_store.json` have no hashes. Must be gated behind `NODE_ENV !== "production"` at minimum, ideally removed with proper seeded hashes.
2. **Hardcoded JWT secret fallbacks** — `server.ts` (`"integra-sync-secure-capstone-key"`) and `backend_fastapi/main.py` (`"superprivate_hsac_rab1_secret_9921_abc"`). Server should refuse to start in production without `JWT_SECRET`.
3. **Inconsistent server-side RBAC.** Role checks are hand-written per route; many routes rely only on `authenticateToken`. Needs a `requireRole(...roles)` middleware and an audit of all ~100 routes, plus ownership checks on `/api/employees/:employeeId/*`.
4. **PII in git.** `data_store.json`, `data_store.backup.json` are committed and contain employee records. `backend_fastapi/generated_employee_credentials.csv` is gitignored — good — keep it that way.
5. **FastAPI CORS** uses `allow_origins=["*"]` with `allow_credentials=True`.
6. **PBKDF2 at 1000 iterations** (server.ts) is far below current guidance; FastAPI uses bcrypt — the two backends hash differently, so users can't move between them without a migration.
7. JWT stored in `localStorage` (XSS-exposed). Acceptable for now; note it in any security review.

## 🟠 High — correctness
8. **Backup restore is a stub.** `POST /api/backups/:id/restore` logs an audit event and returns success without restoring anything.
9. **Sync full-file writes on every mutation.** `saveDB()` rewrites the whole `data_store.json` via `writeFileSync`, and `logEvent()` calls it too (double writes per request). No atomic write (temp file + rename) → a crash mid-write can corrupt the DB.
10. **DEPLOYMENT.md FastAPI command is wrong.** `main.py` uses relative imports (`from .database import ...`), so `cd backend_fastapi && uvicorn main:app` fails. Correct: from repo root, `uvicorn backend_fastapi.main:app`.
11. **Backend parity gap.** FastAPI implements ~19 of ~100 Express routes; frontend is not wired to it.
12. Budget math uses JS floats — verify rounding on ledger/allocation totals.

## 🟡 Medium — maintainability
13. `server.ts` (~4.5k lines) and `FinanceView.tsx` (~3.3k lines) are monoliths.
14. `App.tsx` holds ~21 `useState`s and routes by string `activeTab` — no router, no URL deep-linking, back button doesn't work.
15. ~30 one-off patch/fix/test scripts and scratch `.txt` files at repo root (`patch_*.cjs`, `fix*.py`, `formatted.js`, `ls_out.txt`, `modal.txt`, `put_chunk.txt`, `wait.sh`, `bun.lock` alongside `package-lock.json`…).
16. Heavy `any` usage in `server.ts` handlers (~300 occurrences).
17. No automated tests, no ESLint/Prettier; `npm run lint` is only `tsc --noEmit`.
18. `package.json` name is still `"react-example"`; `metadata.json` name is "Remix Remix: Remix: …".
19. Files (PDS, documents) are stored as base64 inside the JSON DB with a 50 MB body limit.

## 🧩 Existing TypeScript errors (`npm run lint` fails with 13 errors as of the initial analysis)
The PostToolUse typecheck hook only reports errors in files you edit, so these won't block unrelated work — but fix them when you touch the file.
- `src/components/HrUnifiedRequests.tsx:461` — comparison `"return"` vs `"verify"` can never be true → **likely a real logic bug** (a branch that never runs).
- `src/components/FinanceView.tsx:2580` — `uacsCode` missing from `BudgetAllocation` type (type drift).
- `src/App.tsx:423` — `requirePdsUpload` missing from `User` type (server returns it; add to type).
- `src/components/UserAccountsView.tsx:90` — status state typed too narrowly (`"Archived" | "Active"`) but receives `"Deactivated"` / `"Pending Password Change"`.
- `src/components/PersonalDataSheetForm.tsx:373,378,701` — `salary`, `position` missing from PDS form type.
- `src/components/EmployeePortalView.tsx:276,983,986,989` — two incompatible document shapes mixed in one state array (`filename` vs `size`/`content`).
- `src/components/AssetsView.tsx:415` — `title` prop on a lucide icon (wrap in a `<span title>` instead).
