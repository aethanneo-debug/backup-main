-- ====================================================================
-- CODESET: Human Settlements Adjudication Commission Regional Adjudication Branch No. 1 (HSAC RAB 1)
-- PROJECT: Integrated Personnel and Financial Management System (IPFMS)
-- TARGET: PostgreSQL v14+ Database Schema Definition
-- ====================================================================

-- Enable UUID extension for robust distributed keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- SECTION 1: USER ACCOUNT SECURITY & ROLE DEFINITIONS
-- ====================================================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE offices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_code VARCHAR(50) UNIQUE NOT NULL,
    office_name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    employee_record_id UUID UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
    office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SECTION 2: WORKFORCE & PERSONNEL INFORMATION (HR MODULE)
-- ====================================================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plantilla_number VARCHAR(50),
    employee_type VARCHAR(50) NOT NULL DEFAULT 'Plantilla',
    full_name VARCHAR(150) NOT NULL,
    position VARCHAR(100) NOT NULL,
    division VARCHAR(100) NOT NULL,
    office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
    employment_status VARCHAR(50) NOT NULL,
    salary_grade INTEGER,
    step INTEGER,
    position_effective_date DATE,
    appointment_date DATE,
    csc_approval_date DATE,
    entry_to_government DATE,
    entry_to_hsac DATE,
    official_email VARCHAR(255),
    address TEXT,
    date_hired DATE NOT NULL,
    contact_number VARCHAR(20),
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(20),
    pds_file_name VARCHAR(255),
    pds_uploaded_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_employees_plantilla_number 
ON employees (plantilla_number) 
WHERE plantilla_number IS NOT NULL;

-- ALTER TABLE users ADD CONSTRAINT fk_user_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL;

CREATE TABLE employment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_record_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    previous_details TEXT,
    new_details TEXT,
    effective_date DATE NOT NULL,
    updated_by VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trainings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_record_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    organizer VARCHAR(255) NOT NULL,
    date_conducted DATE NOT NULL,
    certificate_file_name VARCHAR(255),
    training_hours INTEGER NOT NULL CHECK (training_hours > 0),
    status VARCHAR(50) DEFAULT 'Pending Verification',
    remarks TEXT,
    verified_by VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_pds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_record_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
    data TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seminars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_record_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    organizer VARCHAR(255) NOT NULL,
    date_conducted DATE NOT NULL,
    certificate_file_name VARCHAR(255),
    hours INTEGER NOT NULL CHECK (hours > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SECTION 3: FISCAL & BUDGET MANAGEMENT
-- ====================================================================

CREATE TABLE fiscal_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label VARCHAR(50) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Draft', 'Active', 'Closed', 'Archived')),
    rollover_policy VARCHAR(50) NOT NULL CHECK (rollover_policy IN ('Carry Forward', 'Reset to Zero')),
    created_by VARCHAR(150),
    activated_by VARCHAR(150),
    closed_by VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE office_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE RESTRICT,
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE RESTRICT,
    base_annual_allocation DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    rollover_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_annual_allocation DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    encumbered_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    utilized_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    available_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (fiscal_year_id, office_id)
);

CREATE TABLE quarterly_budget_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_budget_id UUID NOT NULL REFERENCES office_budgets(id) ON DELETE CASCADE,
    quarter_number INTEGER NOT NULL CHECK (quarter_number IN (1, 2, 3, 4)),
    allocated_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    encumbered_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    utilized_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    available_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (office_budget_id, quarter_number)
);

CREATE TABLE monthly_budget_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quarterly_budget_id UUID NOT NULL REFERENCES quarterly_budget_allocations(id) ON DELETE CASCADE,
    month_number INTEGER NOT NULL CHECK (month_number BETWEEN 1 AND 12),
    allocated_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    encumbered_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    utilized_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    available_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (quarterly_budget_id, month_number)
);

CREATE TABLE budget_ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_budget_id UUID NOT NULL REFERENCES office_budgets(id) ON DELETE CASCADE,
    quarterly_budget_id UUID REFERENCES quarterly_budget_allocations(id) ON DELETE SET NULL,
    monthly_budget_id UUID REFERENCES monthly_budget_allocations(id) ON DELETE SET NULL,
    employee_record_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    activity_id UUID, -- For future extension
    request_id UUID,
    liquidation_id UUID, -- If separate from financial_transaction_id
    financial_transaction_id UUID,
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('Allocation', 'Encumbrance', 'Expense', 'Adjustment', 'Reversal', 'Rollover')),
    reference_number VARCHAR(100),
    description TEXT,
    debit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    credit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    posting_status VARCHAR(50) DEFAULT 'Posted',
    posted_by VARCHAR(150),
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fiscal_year_rollovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE RESTRICT,
    target_fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE RESTRICT,
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE RESTRICT,
    rollover_policy VARCHAR(50) NOT NULL,
    source_remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    carried_forward_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    reset_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    executed_by VARCHAR(150) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Completed'
);


-- ====================================================================
-- SECTION 4: EXPENSE JOURNALING & RECEIPT LIQUIDATION SYSTEM (FINANCE MODULE)
-- ====================================================================

CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    transaction_date DATE NOT NULL,
    supplier VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0.00),
    description TEXT NOT NULL,
    office_id UUID REFERENCES offices(id) ON DELETE RESTRICT,
    receipt_file_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Endorsed', 'Approved', 'Posted', 'Returned', 'Rejected', 'Archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supporting_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) NOT NULL REFERENCES financial_transactions(transaction_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transaction_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) NOT NULL REFERENCES financial_transactions(transaction_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(150) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
);

-- ====================================================================
-- SECTION 5: OFFICE INVENTORY & PROPERTY ACCOUNTABILITY (ASSETS MODULE)
-- ====================================================================

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_number VARCHAR(100) UNIQUE NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    date_acquired DATE NOT NULL,
    cost DECIMAL(15,2) NOT NULL CHECK (cost >= 0.00),
    status VARCHAR(50) NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE asset_issuances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    asset_number VARCHAR(100) NOT NULL,
    assigned_to_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    assigned_to_name VARCHAR(150) NOT NULL,
    date_issued DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    condition_on_issue TEXT NOT NULL,
    return_date DATE,
    condition_on_return TEXT,
    clearance_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supply_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
    available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
    unit VARCHAR(50) DEFAULT 'pieces',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SECTION 6: DIGITAL REQUEST & APPROVAL WORKFLOW
-- ====================================================================

CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_type VARCHAR(50) NOT NULL,
    employee_record_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(150) NOT NULL,
    office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
    date_requested DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    approved_by VARCHAR(150),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workflow_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- 'Request', 'FinancialTransaction'
    entity_id UUID NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    remarks TEXT,
    acted_by VARCHAR(150) NOT NULL,
    acted_as_role VARCHAR(100) NOT NULL,
    acted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SECTION 7: SYSTEM AUDIT TRAILING & EVENT LOGGING
-- ====================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    action TEXT NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    previous_value TEXT,
    new_value TEXT,
    details TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SECTION 8: PRIMARY SECURITY SEEDING
-- ====================================================================

INSERT INTO roles (id, name, description) VALUES
(1, 'SUPER_ADMIN', 'Super Administrator'),
(2, 'DIVISION_CHIEF', 'Division Chief'),
(3, 'HR_OFFICER', 'HR Officer'),
(4, 'FINANCE_OFFICER', 'Finance Officer'),
(5, 'BUDGET_OFFICER', 'Budget Officer'),
(6, 'EMPLOYEE', 'Employee');

INSERT INTO offices (id, office_code, office_name, description) VALUES
('dd000000-0000-0000-0000-000000000001', 'ODC', 'Office of the Division Chief', 'Division Chief Office'),
('dd000000-0000-0000-0000-000000000002', 'AFD', 'Administrative and Finance Division', 'Admin and Finance'),
('dd000000-0000-0000-0000-000000000003', 'ADJ', 'Adjudication Division', 'Adjudication'),
('dd000000-0000-0000-0000-000000000004', 'LEG', 'Legal Unit', 'Legal'),
('dd000000-0000-0000-0000-000000000005', 'ITU', 'Information Technology Unit', 'IT Support');

INSERT INTO employees (id, employee_id, full_name, position, division, office_id, employment_status, email, address, date_hired, contact_number) VALUES
('aa000000-0000-0000-0000-000000000001', 'EMP001', 'Super Admin User', 'Systems Administrator', 'Admin', 'dd000000-0000-0000-0000-000000000002', 'Permanent', 'superadmin@example.com', 'HQ', '2020-03-01', '09000000001'),
('aa000000-0000-0000-0000-000000000002', 'EMP002', 'Division Chief User', 'Division Chief', 'Executive', 'dd000000-0000-0000-0000-000000000001', 'Permanent', 'chief@example.com', 'HQ', '2020-03-01', '09000000002'),
('aa000000-0000-0000-0000-000000000003', 'EMP003', 'HR Officer User', 'HR Manager', 'HR', 'dd000000-0000-0000-0000-000000000002', 'Permanent', 'hr@example.com', 'HQ', '2020-03-01', '09000000003'),
('aa000000-0000-0000-0000-000000000004', 'EMP004', 'Finance Officer User', 'Finance Manager', 'Finance', 'dd000000-0000-0000-0000-000000000002', 'Permanent', 'finance@example.com', 'HQ', '2020-03-01', '09000000004'),
('aa000000-0000-0000-0000-000000000005', 'EMP005', 'Budget Officer User', 'Budget Manager', 'Budget', 'dd000000-0000-0000-0000-000000000002', 'Permanent', 'budget@example.com', 'HQ', '2020-03-01', '09000000005'),
('aa000000-0000-0000-0000-000000000006', 'EMP006', 'Employee User', 'IT Specialist', 'IT', 'dd000000-0000-0000-0000-000000000005', 'Permanent', 'employee@example.com', 'HQ', '2020-03-01', '09000000006');

-- Password is 'password123'
INSERT INTO users (id, username, email, password_hash, full_name, role_id, employee_id, office_id) VALUES
('bb000000-0000-0000-0000-000000000001', 'superadmin', 'superadmin@example.com', '$2b$12$e0MdxpG4f6L/M8fbyb71IuxE00NlF3D8Uf2S.z3YfXz7gM14v9GWe', 'Super Admin User', 1, 'EMP001', 'dd000000-0000-0000-0000-000000000002'),
('bb000000-0000-0000-0000-000000000002', 'chief', 'chief@example.com', '$2b$12$e0MdxpG4f6L/M8fbyb71IuxE00NlF3D8Uf2S.z3YfXz7gM14v9GWe', 'Division Chief User', 2, 'EMP002', 'dd000000-0000-0000-0000-000000000001'),
('bb000000-0000-0000-0000-000000000003', 'hrofficer', 'hr@example.com', '$2b$12$e0MdxpG4f6L/M8fbyb71IuxE00NlF3D8Uf2S.z3YfXz7gM14v9GWe', 'HR Officer User', 3, 'EMP003', 'dd000000-0000-0000-0000-000000000002'),
('bb000000-0000-0000-0000-000000000004', 'financeofficer', 'finance@example.com', '$2b$12$e0MdxpG4f6L/M8fbyb71IuxE00NlF3D8Uf2S.z3YfXz7gM14v9GWe', 'Finance Officer User', 4, 'EMP004', 'dd000000-0000-0000-0000-000000000002'),
('bb000000-0000-0000-0000-000000000005', 'budgetofficer', 'budget@example.com', '$2b$12$e0MdxpG4f6L/M8fbyb71IuxE00NlF3D8Uf2S.z3YfXz7gM14v9GWe', 'Budget Officer User', 5, 'EMP005', 'dd000000-0000-0000-0000-000000000002'),
('bb000000-0000-0000-0000-000000000006', 'employee', 'employee@example.com', '$2b$12$e0MdxpG4f6L/M8fbyb71IuxE00NlF3D8Uf2S.z3YfXz7gM14v9GWe', 'Employee User', 6, 'EMP006', 'dd000000-0000-0000-0000-000000000005');

INSERT INTO fiscal_years (id, label, start_date, end_date, status, rollover_policy, created_by, activated_by, created_at, updated_at) VALUES
('ee000000-0000-0000-0000-000000000001', 'FY-2025-2026', '2025-07-01', '2026-06-30', 'Active', 'Carry Forward', 'Super Admin User', 'Super Admin User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO office_budgets (id, fiscal_year_id, office_id, base_annual_allocation, rollover_amount, adjustment_amount, total_annual_allocation, encumbered_amount, utilized_amount, available_amount) VALUES
('ff000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000005', 120000.00, 0.00, 0.00, 120000.00, 0.00, 0.00, 120000.00);

-- Quarterly Allocations for IT Unit
INSERT INTO quarterly_budget_allocations (id, office_budget_id, quarter_number, allocated_amount, encumbered_amount, utilized_amount, available_amount) VALUES
('11000000-0000-0000-0000-000000000001', 'ff000000-0000-0000-0000-000000000001', 1, 30000.00, 0.00, 0.00, 30000.00),
('11000000-0000-0000-0000-000000000002', 'ff000000-0000-0000-0000-000000000001', 2, 30000.00, 0.00, 0.00, 30000.00),
('11000000-0000-0000-0000-000000000003', 'ff000000-0000-0000-0000-000000000001', 3, 30000.00, 0.00, 0.00, 30000.00),
('11000000-0000-0000-0000-000000000004', 'ff000000-0000-0000-0000-000000000001', 4, 30000.00, 0.00, 0.00, 30000.00);

-- Monthly Allocations for Quarter 1
INSERT INTO monthly_budget_allocations (id, quarterly_budget_id, month_number, allocated_amount, encumbered_amount, utilized_amount, available_amount) VALUES
('22000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 1, 10000.00, 0.00, 0.00, 10000.00),
('22000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 2, 10000.00, 0.00, 0.00, 10000.00),
('22000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 3, 10000.00, 0.00, 0.00, 10000.00);
