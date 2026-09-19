from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import date, datetime
from decimal import Decimal

# Roles
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class RoleOut(RoleBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

# Offices
class OfficeBase(BaseModel):
    office_code: str
    office_name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

class OfficeCreate(OfficeBase):
    pass

class OfficeOut(OfficeBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role_id: int
    employee_id: Optional[str] = None
    office_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    full_name: str
    role_id: int
    employee_id: Optional[str] = None
    office_id: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

# Fiscal Year Schemas
class FiscalYearBase(BaseModel):
    label: str
    start_date: date
    end_date: date
    status: str
    rollover_policy: str

class FiscalYearCreate(FiscalYearBase):
    pass

class FiscalYearOut(FiscalYearBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True

class FiscalYearRolloverRequest(BaseModel):
    source_fiscal_year_id: str
    target_fiscal_year_id: str
    rollover_policy: str

# Office Budgets
class OfficeBudgetBase(BaseModel):
    fiscal_year_id: str
    office_id: str
    base_annual_allocation: Decimal

class OfficeBudgetCreate(OfficeBudgetBase):
    pass

class OfficeBudgetOut(OfficeBudgetBase):
    id: str
    rollover_amount: Decimal
    adjustment_amount: Decimal
    total_annual_allocation: Decimal
    encumbered_amount: Decimal
    utilized_amount: Decimal
    available_amount: Decimal
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

# Allocations
class QuarterlyBudgetAllocationOut(BaseModel):
    id: str
    office_budget_id: str
    quarter_number: int
    allocated_amount: Decimal
    encumbered_amount: Decimal
    utilized_amount: Decimal
    available_amount: Decimal
    class Config:
        from_attributes = True

class MonthlyBudgetAllocationOut(BaseModel):
    id: str
    quarterly_budget_id: str
    month_number: int
    allocated_amount: Decimal
    encumbered_amount: Decimal
    utilized_amount: Decimal
    available_amount: Decimal
    class Config:
        from_attributes = True

# Ledger Entries
class BudgetLedgerEntryOut(BaseModel):
    id: str
    office_budget_id: str
    entry_type: str
    reference_number: Optional[str]
    description: Optional[str]
    debit_amount: Decimal
    credit_amount: Decimal
    posting_status: str
    posted_at: datetime
    class Config:
        from_attributes = True

# Employee Schemas
class EmployeeBase(BaseModel):
    employee_id: str
    full_name: str
    position: str
    division: str
    office_id: Optional[str] = None
    employment_status: str
    email: EmailStr
    address: Optional[str] = None
    date_hired: date
    contact_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeOut(EmployeeBase):
    id: str
    pds_file_name: Optional[str] = None
    pds_uploaded_at: Optional[datetime] = None
    created_at: datetime
    class Config:
        from_attributes = True

# Financial Transaction Schemas
class TransactionBase(BaseModel):
    transaction_id: str
    transaction_date: date
    supplier: str
    amount: Decimal
    description: str
    office_id: Optional[str] = None

class TransactionCreate(TransactionBase):
    receipt_file_name: Optional[str] = None

class TransactionOut(TransactionBase):
    id: str
    status: str
    receipt_file_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# Approvals & Postings
class WorkflowAction(BaseModel):
    action: str # Endorse, Approve, Return, Reject
    remarks: Optional[str] = None

class BudgetPostingRequest(BaseModel):
    financial_transaction_id: str
    quarter_number: int
    month_number: int

# Audit Log Schema
class AuditLogOut(BaseModel):
    id: str
    timestamp: datetime
    user_id: str
    username: str
    role: str
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    class Config:
        from_attributes = True

class ReportSummary(BaseModel):
    label: str
    total_allocation: Decimal
    total_utilized: Decimal
    total_encumbered: Decimal
    total_available: Decimal
    utilization_percentage: float
