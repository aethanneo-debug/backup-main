# IntegraSync 2.0 - Implementation Checklist

## Phase 1: Audit & Restructure
- [x] Initial repository and file structure inspection
- [x] Verify `backend_fastapi`, `database`, `src` directories
- [ ] Convert TypeScript frontend files to JavaScript (`.jsx` or `.js`) if strictly required (currently retaining `.tsx` for safety pending final confirmation).

## Phase 2: Database Schema (PostgreSQL)
- [x] Create `fiscal_years` table (id, label, start_date, end_date, status, rollover_policy)
- [x] Create `offices` table (id, office_code, office_name)
- [x] Create `office_budgets` table (base_annual_allocation, rollover, adjustment, total, encumbered, utilized, available)
- [x] Create `quarterly_budget_allocations` table
- [x] Create `monthly_budget_allocations` table
- [x] Create `budget_ledger_entries` table (debit, credit, posting_status)
- [x] Update `users` and `employees` to link to `offices`
- [x] Define relationships and constraints (ondelete CASCADE, RESTRICT)
- [x] Seed data for required Test Users (Super Admin, Division Chief, HR, Finance, Budget, Employee)

## Phase 3: FastAPI Backend
- [x] Implement database connection and session management
- [x] Create SQLAlchemy models for all schema tables
- [x] Create Pydantic schemas (Base, Create, Out, etc.)
- [x] Authentication & RBAC routes (`/api/auth/login`)
- [x] Office endpoints (`/api/offices`)
- [x] Fiscal Year endpoints (`/api/fiscal-years`)
- [x] Budget endpoints (`/api/budgets`)
- [x] Budget Ledger endpoints (`/api/budgets/{id}/ledger`)
- [x] Budget Posting logic (`/api/budget-postings/post`) with exact validation
- [x] Dashboard totals endpoint (`/api/dashboard/summary`)

## Phase 4: React Frontend Integration
- [ ] Connect `apiCall` to use `VITE_API_BASE_URL` pointing to FastAPI
- [ ] Build Budget Management UI (Fiscal Years, Budgets, Allocations)
- [ ] Integrate Office-based filtering
- [ ] Update Navigation and Sidebar for persistent layout
- [ ] Remove hardcoded data from frontend components

## Phase 5: Verification & Testing
- [ ] Test all test user accounts
- [ ] Verify rollover behavior
- [ ] Verify exact posting behavior limits (encumbered vs utilized)
- [ ] Verify dashboard persistence
