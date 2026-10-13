# Known Issues & Technical Debt (verified from the code — keep this list updated)

Prioritized. When you fix one, remove or update its entry here.

## 🔴 Critical — security
1. **Master/dev password backdoor.** In `/api/auth/login` and `/api/auth/change-password`, any user without `passwordHash` authenticates with `password123` **or** `sandbox-master-pass`. The seeded users in `data_store.json` have no hashes. Must be gated behind `NODE_ENV !== "production"` at minimum, ideally removed with proper seeded hashes.
2. **Hardcoded JWT secret fallbacks** — `server.ts` (`"integra-sync-secure-capstone-key"`) and `backend_fastapi/main.py` (`"superprivate_hsac_rab1_secret_9921_abc"`). Server should refuse to start in production without `JWT_SECRET`.
3. **Inconsistent server-side RBAC.** Role checks are hand-written per route; many routes rely only on `authenticateToken`. Needs a `requireRole(...roles)` middleware and an audit of all ~100 routes, plus ownership checks on `/api/employees/:employeeId/*`. A concrete case (found 2026-10-08): `POST /api/activities` has no role check at all. Any signed-in user, Personnel included, can create an activity assigned to anyone with any allotted budget, then file a liquidation or reimbursement claim against it.
4. **PII in git.** `data_store.json`, `data_store.backup.json` are committed and contain employee records. `backend_fastapi/generated_employee_credentials.csv` is gitignored — good — keep it that way.
5. **FastAPI CORS** uses `allow_origins=["*"]` with `allow_credentials=True`.
6. **PBKDF2 at 1000 iterations** (server.ts) is far below current guidance; FastAPI uses bcrypt — the two backends hash differently, so users can't move between them without a migration.
7. JWT stored in `localStorage` (XSS-exposed). Acceptable for now; note it in any security review.
7a. **Archived accounts keep working until their token expires** (found 2026-10-08). Login refuses Archived/Deactivated accounts. But `authenticateToken` only reloads the user and never re-checks `status`, so a token issued before archiving stays valid for up to 8 hours on every route. That includes Admin-only writes such as replacing the Accountant signatory. Fix: reject those statuses with 401 right after the user lookup. Not done yet: it's an auth change that needs approval.
7b. ~~`/api/dashboard/summary` sent the 8 newest audit entries, recent requests and recent transactions to every role.~~ Fixed 2026-10-08: only the Administrator receives these lists.

## 🟠 High — correctness
8. **Backup restore is a stub.** `POST /api/backups/:id/restore` logs an audit event and returns success without restoring anything.
9. **Sync full-file writes on every mutation.** `saveDB()` rewrites the whole `data_store.json` via `writeFileSync`, and `logEvent()` calls it too (double writes per request). No atomic write (temp file + rename) → a crash mid-write can corrupt the DB.
10. **DEPLOYMENT.md FastAPI command is wrong.** `main.py` uses relative imports (`from .database import ...`), so `cd backend_fastapi && uvicorn main:app` fails. Correct: from repo root, `uvicorn backend_fastapi.main:app`.
11. **Backend parity gap.** FastAPI implements ~19 of ~100 Express routes; frontend is not wired to it. It has none of the liquidation, training/TDP, cash-advance or signatory routes. That includes `/api/signatories` (Utilities → Manage Signatories, added 2026-10-08) and the `signatories` collection, which has no table in `database/schema.sql`. Requirement 4's claim type (Liquidation or Reimbursement) and its cash-advance checks have no counterpart either. Nor do requirement 5's correction requests (`corrections`, every round of a Return's checklist), the file history (`replaces` / `supersededAt` / `replacedBy`) or the stage guards. Nor does requirement 6's training budget rule (`seminarBudget` in `src/trainingBudget.ts`: a non-attendee's share released at once unless their cash advance is still out, a closed seminar counting only its spending, a floor of spending plus every advance still out with a non-attendee's cash on top of the attendees' shares, an attendee's advance netted against HR's hand entries, the "returned", "released" and "held" totals), its ceiling guards (re-holds, seats, closed or missing years, auto-enrolment), the seminar delete and roster guards, or `POST /api/cash-advances/:id/refund`. `database/schema.sql` has no liquidation-report or cash-advance table at all.
12. Budget math uses JS floats. The training budget rounds to centavos in `src/trainingBudget.ts` (requirement 6), but the division buckets don't: `applyBudgetDeduction` adds `budgetUtilized` without rounding.
12a. ~~**Liquidation resubmit and review stage guards**~~ (found 2026-10-08). Fixed by instructor requirements 4 and 5 (2026-10-08 and 2026-10-09):
    - `PUT /api/liquidation-submissions/:id/resubmit` answers 409 unless the report is "Returned" and its claim unpaid.
    - Resubmit applies only the parts the reviewer ticked on the Return's checklist (`corrections`); everything else keeps its stored value.
    - A plain `totalSpent` is read strictly and can't override an itemised report.
    - `hr-action` answers 409 unless "Pending HR Review", and `finance-action` unless "Verified & Forwarded", so a second Validate can't count the spending twice.
    - Finance's cash advance record always wins over typed figures, even once that advance is settled.
    - A report validated (or approved by the Division Chief) under the old rules and then returned can't be resubmitted (409), and Validate refuses a report already validated or approved, so nothing is counted twice. None existed in the live data on 2026-10-09; one would stay where it is until someone decides what to do with it.
12b. ~~**Deleting a seminar deletes its history**~~ (found 2026-10-08). Fixed 2026-10-13 (requirement 6's security re-check):
    - `DELETE /api/training/programs/:id` answers 409 when the seminar has history: attendance, spending, a liquidation report, any cash advance, a training evaluation, or an expense row.
    - It also answers 409 in a closed fiscal year, so that year's figures stay as they were carried over.
    - Otherwise it deletes the seminar and its enrolments, with an audit entry ("Delete Training Program").
    - Roles are checked with `UserRole`, so the Administrator can delete too.
    - A roster edit keeps any enrolment with a cash advance or an evaluation on file, as it already kept those with attendance.
12c. **A cash advance isn't checked against the assignee** (found 2026-10-08). `POST /api/cash-advances` takes any `employeeId` with any `activityId`, so a mistaken or crafted request can fund someone who isn't assigned. The claim-type checks then treat that advance as the assignment's. Fix: compare with the enrolment's `employeeId` or the activity's `assignedEmployeeId`.
    - Also (noted 2026-10-13): the ceiling on an advance is the participant's allowance, but `facts.allocated > 0 &&` skips it when the allowance is ₱0, so a ₱0 seminar's advance is uncapped. Since requirement 6 the training budget holds whatever cash is out, so the figures stay true, but nothing stops the release.
    - Advances that can't be closed: an attendee's advance stays "Released" if their report is Returned and never resubmitted. "Did not attend" is refused once a report exists, and the refund needs it. The cash stays held in the training budget, so the money is safe. General-activity advances have no refund path at all.
    - A refund quotes the whole advance even when part of it was spent. This happens if HR entered expenses for a participant (from the advance) before marking them "Did not attend". The training budget nets those entries, so its figures are right. But three texts still quote the whole advance: the attendance message, the desk's "collect the full refund", and the refund record "Refund of PHP …". New entries for a non-attendee are refused (requirement 6), so this needs entries made first.
12d. **A report the Administrator files for someone else is stored as the Administrator's** (pre-existing, noted 2026-10-08). For general activities only, the Administrator may file on an assignee's behalf. The report's `employeeId` is then the Administrator's own.
    - It appears in their settlement log, not the assignee's.
    - ~~The assignee could file a second report for the same activity.~~ Fixed 2026-10-08: a second report on any assignment is now refused, whoever filed the first.
    - Fix: stamp the assignee, or drop the exception.
12e. **Liquidation reports are visible to every officer** (found 2026-10-09, pre-existing). `GET /api/liquidation-submissions` gives Personnel only their own reports, but every other role, the Budget Officer included, gets every report with its file contents and, since requirement 5, its correction history. Narrow it to the roles that review reports (HR, Finance, Administrator).
12f. **Anyone can mark anyone's notification read** (found 2026-10-09, pre-existing). `POST /api/notifications/:id/read` doesn't check that the notice is the caller's, and returns the whole notice. Apply GET's filter, answer 404 otherwise, and drop `data` from the response. Requirement 5's "returned" notice carries the reviewer's remarks, so it now uses a random id; most other notices still have guessable `notif-<timestamp>` ids.
12g. **Report numbers have the year fixed at 2026** (noticed 2026-10-09). `nextLiquidationSubmissionNo` uses the prefix "LIQSUB-2026-" whatever the date, and keeps the old count-based format ("LIQSUB-2026-09", then "LIQSUB-2026-010"). The serial number (`LR-…-YYYY-MM-NNN`) is dated correctly.
12h. **HR can't see a report's files** (pre-existing). HR's Request Details for a liquidation report lists no supporting documents, and the Return checklist names the files without opening them. Finance's desk does show them.
12i. **Seminar spending is counted in two budgets** (confirmed 2026-10-09 in requirement 6; the user chose to report it only). When Finance validates a seminar report, the spending goes into the seminar's `usedBudget` (the TDP training budget). `autoDeductLiquidation` also deducts it from the claimant's division "Training" bucket.
    - In the test, two Legal Division attendees' ₱5,500 also left Legal's Training bucket.
    - A division with no Training bucket falls back to its general bucket. An office with neither (e.g. the Office of the Chief Regional Adjudicator) gets a "Budget Auto-Deduction Skipped" notice.
    - General activities are fine: they reserve nothing in a bucket, and validation deducts the actual spending once.
    - `unliquidatedAdvances` is read in every bucket's remaining balance but nothing ever sets it, so released cash advances reserve nothing in division buckets either. (The training budget does: since requirement 6, a seminar never holds less than its spending plus every advance still out.)
12j. **Seminar edits leave no audit trail** (found 2026-10-10 in requirement 6's security review, pre-existing). `PUT /api/training/programs/:id` writes no audit entry, so a change of allocation, seats or dates leaves no trace.
    - Fixed 2026-10-13, from the same review:
      - A new seminar must be in the active fiscal year (400 otherwise).
      - An increase to a seminar filed under a fiscal year that doesn't exist is refused, as in a closed year.
      - Deleting a seminar can no longer remove its spending (12b).
      - Auto-enrolment of a new or edited employee only considers seminars still to come (not started, not closed), and skips one that is full or over the ceiling. HR is told once per employee and seminar, not on every profile edit.
      - A seminar edit re-prices the participants' allowances (the cash-advance ceiling) whether or not the roster is sent.
      - A seminar edit can't cut the seats below the participants it keeps, not counting anyone marked "Did not attend" (400). Pricing uses the roster before the save, so a save that trims seats and unticks someone can be priced a little high. That is conservative: when the budget is nearly full, HR saves in two steps.
      - Liquidation reminders skip participants marked "Did not attend".

## 🟡 Medium — maintainability
13. `server.ts` (~4.5k lines) and `FinanceView.tsx` (~3.3k lines) are monoliths. `EmployeePortalView.tsx` has grown to ~2.1k lines: requirement 5 added the correction flow to it. `finance/CashAdvanceDesk.tsx` is ~430 lines after requirement 6's refund list (the form itself is `AdvanceRefundForm.tsx`); its lists could become subcomponents. Next step: move the Liquidations tab into `src/components/liquidation/`, with a hook for the correction draft (access rules, replacement files, pending report, auto-open).
13a. **Dead code** (confirmed 2026-10-09):
    - `src/components/ApprovalManagementView.tsx` is imported nowhere. It still calls `chief-action`, which now always answers 409.
    - `RequestsView.tsx`'s `handleHRLiquidationAction` is never called. It sends a Return with no checklist, which now answers 400. Its state (`liqSubmissions`, `liqRemarks`, `selectedLiqSub`) is never read, but `fetchLiquidationSubmissions()` still runs on mount.
    - Both are safe to delete.
13b. The Return dialog borrows its form styles from `utilities/signatoryFormParts`. Move the shared ones to `src/components/ui/`.
14. `App.tsx` holds ~21 `useState`s and routes by string `activeTab` — no router, no URL deep-linking, back button doesn't work.
15. ~30 one-off patch/fix/test scripts and scratch `.txt` files at repo root (`patch_*.cjs`, `fix*.py`, `formatted.js`, `ls_out.txt`, `modal.txt`, `put_chunk.txt`, `wait.sh`, `bun.lock` alongside `package-lock.json`…).
16. Heavy `any` usage in `server.ts` handlers (~300 occurrences).
17. No automated tests, no ESLint/Prettier; `npm run lint` is only `tsc --noEmit`.
18. `package.json` name is still `"react-example"`; `metadata.json` name is "Remix Remix: Remix: …".
19. Files (PDS, documents) are stored as base64 inside the JSON DB with a 50 MB body limit.

## 🧩 Existing TypeScript errors (`npm run lint` fails with 1 error as of 2026-10-13; 13 at the initial analysis)
The PostToolUse typecheck hook only reports errors in files you edit, so these won't block unrelated work — but fix them when you touch the file.
- ~~`src/components/HrUnifiedRequests.tsx:478`~~ — fixed 2026-10-09 (requirement 5): the bulk modal's placeholder compared `"return"` with `"verify"` inside a branch where it could never be `"verify"`.
- `src/components/AssetsView.tsx:415` — `title` prop on a lucide icon (wrap in a `<span title>` instead).
