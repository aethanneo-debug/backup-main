# Project Map — IntegraSync (IPFMS)

**What it is:** Integrated Personnel and Financial Management System for the Human Settlements Adjudication Commission, Regional Adjudication Branch No. 1 (HSAC RAB 1). Handles employee records & PDS (CSC Personal Data Sheet), trainings/seminars, activities & liquidations, finance (transactions, budgets, fiscal years, ledger), assets & supplies, multi-stage request approvals, reports, audit logs, backups, and user accounts. Originally scaffolded in Google AI Studio.

## Architecture (two backends — know which one you're touching)

```
Browser (React 19 SPA, Vite, Tailwind v4)
   │  apiCall()  → Authorization: Bearer <JWT from localStorage.ipfms_token>
   ▼
server.ts  (Express, port 3000, ~4.5k lines, ~100 routes)      ← ACTIVE dev/runtime backend
   │  in-memory `db` object ← getInitialData() ← data_store.json
   │  every mutation → saveDB() → fs.writeFileSync(data_store.json)
   │  also serves Vite middleware in dev, dist/ in prod
   └─ Gemini (@google/genai) for POST /api/pds/parse ; nodemailer (Gmail SMTP) for emails

backend_fastapi/ (FastAPI + SQLAlchemy + PostgreSQL)            ← PARTIAL "production" backend
   ~19 routes: auth, sessions, offices, fiscal-years, budgets (+quarters/months/ledger),
   employees, financial-transactions, budget-postings/post, dashboard/summary, health
database/schema.sql — PostgreSQL schema (roles, offices, users, employees, PDS, fiscal_years,
   office_budgets, quarterly/monthly allocations, budget_ledger_entries, rollovers,
   financial_transactions, supporting_documents, assets, supplies, requests, workflow_history, audit_logs)
```

The frontend currently talks **only** to Express. `IMPLEMENTATION_CHECKLIST.md` Phase 4 (point `apiCall` at `VITE_API_BASE_URL` → FastAPI) is not done.

## Key files

| Path | Role |
|---|---|
| `server.ts` | Entire Express API: seed data, auth + `authenticateToken` middleware, all routes, Vite/static serving |
| `src/types.ts` | Shared types & enums (`UserRole`, `RequestType`, `RequestStatus`, `TransactionStatus`, `AssetStatus`, `SPENDING_CATEGORIES`…) — imported by both frontend and `server.ts` |
| `src/utils.ts` | `apiCall`, `formatCurrency` (PHP), `formatDate`, `downloadCSV` |
| `src/App.tsx` | Login, session check, password-change & PDS-upload gates, tab routing via `activeTab` state (no router), global data fetching |
| `src/components/Sidebar.tsx` | Role-based navigation (visibility only — not security) |
| `src/components/FinanceView.tsx` | ~3.3k lines: finance dashboard, journal, documents vault, liquidation desk, revisions audit, budgets |
| `src/components/EmployeePortalView.tsx`, `PersonalDataSheetForm.tsx` | Employee self-service + PDS |
| `src/components/*Requests*.tsx`, `ApprovalManagementView.tsx` | Request workflow (Employee → HR endorse → Chief decide), liquidation workflow (HR → Finance → Chief) |
| `backend_fastapi/{main,models,schemas,database,migrate}.py` | FastAPI app |
| `data_store.json` | Live JSON "database" — committed to git (see known-issues) |
| `patch_*.cjs`, `fix*.cjs/py`, `rewrite_*.cjs`, `update_*.cjs`, `test_*.js`, `*.txt` at root | Historical one-off AI patch scripts & scratch files. Not part of the app. |

## Roles (`UserRole` in src/types.ts)

| Enum | Value | Default tab |
|---|---|---|
| `SUPER_ADMIN` | "Administrator / Division Chief" | dashboard |
| `HR_OFFICER` | "HR Officer" | pds |
| `FINANCE_OFFICER` | "Financial Officer" | finance |
| `BUDGET_OFFICER` | "Budget Officer" | budget |
| `EMPLOYEE` | "Personnel" | employee_portal |

Dev logins: `admin`, `hr`, `finance`, `budget`, `employee` (aliases like `admin@hsac.gov.ph` resolve in `/api/auth/login`).

## Auth flow

1. `POST /api/auth/login` → PBKDF2 check (or dev-password fallback, see known-issues) → JWT (8h) returned as `"Bearer <jwt>"`.
2. Frontend stores it in `localStorage.ipfms_token`; `apiCall` sends it as the `Authorization` header.
3. `authenticateToken` verifies the JWT, reloads the user from `db`, then enforces two gates:
   - status `Pending Password Change` → only change-password / logout / session routes allowed.
   - employee without `pdsFieldName` → only PDS-related routes allowed.
4. Role checks are done **inline per route** (`if (req.user.role !== UserRole.X) return 403`). There is no shared `requireRole` helper — coverage is inconsistent.

## Design system (current conventions — keep consistent)

- **Brand:** HSAC navy. `src/index.css` overrides Tailwind's blue scale via `@theme` — `blue-600 = #001d85` (official logo navy), `blue-700 #001563`, `blue-800 #000c3b`. So `bg-blue-600` is navy, not default Tailwind blue.
- **Neutrals:** slate (`bg-slate-50` surfaces, `bg-slate-900/800` dark sidebar & headers). A few stray `gray-*` usages — prefer slate.
- **Status colors:** emerald = approved/success, amber = pending/warning, rose = rejected/error, blue = info/in-progress. Badge pattern: `-50` bg + `-700` text + `-200` border.
- **Shape/density:** `rounded-lg` controls, `rounded-xl`/`rounded-2xl` cards & modals, `shadow-sm` cards, `shadow-xl/2xl` modals. Dense admin UI: `text-xs`/`text-sm` dominate.
- **Libraries:** `lucide-react` icons, `motion` for animation, `recharts` for charts. `.custom-scrollbar` utility for scroll areas. Logo: `HsacLogo.tsx`.
- **Audience:** Philippine government office staff — clarity over flash, formal labels, PHP currency, printable/exportable reports (CSV via `downloadCSV`).
