import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, Decimal, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class Office(Base):
    __tablename__ = "offices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    office_code = Column(String(50), unique=True, nullable=False)
    office_name = Column(String(150), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    employee_record_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"), unique=True)
    office_id = Column(String(36), ForeignKey("offices.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role_rel = relationship("Role")
    employee_rel = relationship("ModelEmployee", back_populates="user_rel", foreign_keys=[employee_id])
    office_rel = relationship("Office")

class ModelEmployee(Base):
    __tablename__ = "employees"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plantilla_number = Column(String(50), unique=True, index=True, nullable=True)
    employee_type = Column(String(50), nullable=False, default="Plantilla")
    full_name = Column(String(150), nullable=False)
    position = Column(String(100), nullable=False)
    division = Column(String(100), nullable=False)
    office_id = Column(String(36), ForeignKey("offices.id", ondelete="SET NULL"))
    employment_status = Column(String(50), nullable=False)
    salary_grade = Column(Integer)
    step = Column(Integer)
    position_effective_date = Column(Date)
    appointment_date = Column(Date)
    csc_approval_date = Column(Date)
    entry_to_government = Column(Date)
    entry_to_hsac = Column(Date)
    official_email = Column(String(255), nullable=True)
    address = Column(Text)
    date_hired = Column(Date, nullable=False)
    contact_number = Column(String(20))
    emergency_contact_name = Column(String(150))
    emergency_contact_phone = Column(String(20))
    pds_file_name = Column(String(255))
    pds_uploaded_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    archived_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user_rel = relationship("User", uselist=False, back_populates="employee_rel", foreign_keys="User.employee_record_id")
    office_rel = relationship("Office")
    history_rel = relationship("ModelEmploymentHistory", back_populates="employee")
    trainings_rel = relationship("ModelTraining", back_populates="employee")
    seminars_rel = relationship("ModelSeminar", back_populates="employee")

class ModelEmploymentHistory(Base):
    __tablename__ = "employment_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_record_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(100), nullable=False)
    previous_details = Column(Text)
    new_details = Column(Text)
    effective_date = Column(Date, nullable=False)
    updated_by = Column(String(150), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("ModelEmployee", back_populates="history_rel")

class ModelTraining(Base):
    __tablename__ = "trainings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_record_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    organizer = Column(String(255), nullable=False)
    date_conducted = Column(Date, nullable=False)
    certificate_file_name = Column(String(255))
    training_hours = Column(Integer, nullable=False)
    status = Column(String(50), default="Pending Verification", nullable=False)
    remarks = Column(Text)
    verified_by = Column(String(150))
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("ModelEmployee", back_populates="trainings_rel")

class ModelPDS(Base):
    __tablename__ = "employee_pds"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_record_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, unique=True)
    data = Column(Text, nullable=False) 
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ModelSeminar(Base):
    __tablename__ = "seminars"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_record_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    organizer = Column(String(255), nullable=False)
    date_conducted = Column(Date, nullable=False)
    certificate_file_name = Column(String(255))
    hours = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("ModelEmployee", back_populates="seminars_rel")

class FiscalYear(Base):
    __tablename__ = "fiscal_years"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    label = Column(String(50), unique=True, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(50), nullable=False)
    rollover_policy = Column(String(50), nullable=False)
    created_by = Column(String(150))
    activated_by = Column(String(150))
    closed_by = Column(String(150))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class OfficeBudget(Base):
    __tablename__ = "office_budgets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fiscal_year_id = Column(String(36), ForeignKey("fiscal_years.id", ondelete="RESTRICT"), nullable=False)
    office_id = Column(String(36), ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False)
    base_annual_allocation = Column(Decimal(15,2), default=0.00)
    rollover_amount = Column(Decimal(15,2), default=0.00)
    adjustment_amount = Column(Decimal(15,2), default=0.00)
    total_annual_allocation = Column(Decimal(15,2), default=0.00)
    encumbered_amount = Column(Decimal(15,2), default=0.00)
    utilized_amount = Column(Decimal(15,2), default=0.00)
    available_amount = Column(Decimal(15,2), default=0.00)
    status = Column(String(50), default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    office_rel = relationship("Office")
    fiscal_year_rel = relationship("FiscalYear")

class QuarterlyBudgetAllocation(Base):
    __tablename__ = "quarterly_budget_allocations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    office_budget_id = Column(String(36), ForeignKey("office_budgets.id", ondelete="CASCADE"), nullable=False)
    quarter_number = Column(Integer, nullable=False)
    allocated_amount = Column(Decimal(15,2), default=0.00)
    encumbered_amount = Column(Decimal(15,2), default=0.00)
    utilized_amount = Column(Decimal(15,2), default=0.00)
    available_amount = Column(Decimal(15,2), default=0.00)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    office_budget_rel = relationship("OfficeBudget")

class MonthlyBudgetAllocation(Base):
    __tablename__ = "monthly_budget_allocations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quarterly_budget_id = Column(String(36), ForeignKey("quarterly_budget_allocations.id", ondelete="CASCADE"), nullable=False)
    month_number = Column(Integer, nullable=False)
    allocated_amount = Column(Decimal(15,2), default=0.00)
    encumbered_amount = Column(Decimal(15,2), default=0.00)
    utilized_amount = Column(Decimal(15,2), default=0.00)
    available_amount = Column(Decimal(15,2), default=0.00)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    quarterly_budget_rel = relationship("QuarterlyBudgetAllocation")

class BudgetLedgerEntry(Base):
    __tablename__ = "budget_ledger_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    office_budget_id = Column(String(36), ForeignKey("office_budgets.id", ondelete="CASCADE"), nullable=False)
    quarterly_budget_id = Column(String(36), ForeignKey("quarterly_budget_allocations.id", ondelete="SET NULL"))
    monthly_budget_id = Column(String(36), ForeignKey("monthly_budget_allocations.id", ondelete="SET NULL"))
    employee_record_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    activity_id = Column(String(36))
    request_id = Column(String(36))
    liquidation_id = Column(String(36))
    financial_transaction_id = Column(String(36))
    entry_type = Column(String(50), nullable=False)
    reference_number = Column(String(100))
    description = Column(Text)
    debit_amount = Column(Decimal(15,2), default=0.00)
    credit_amount = Column(Decimal(15,2), default=0.00)
    posting_status = Column(String(50), default="Posted")
    posted_by = Column(String(150))
    posted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FiscalYearRollover(Base):
    __tablename__ = "fiscal_year_rollovers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_fiscal_year_id = Column(String(36), ForeignKey("fiscal_years.id", ondelete="RESTRICT"), nullable=False)
    target_fiscal_year_id = Column(String(36), ForeignKey("fiscal_years.id", ondelete="RESTRICT"), nullable=False)
    office_id = Column(String(36), ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False)
    rollover_policy = Column(String(50), nullable=False)
    source_remaining_amount = Column(Decimal(15,2), default=0.00)
    carried_forward_amount = Column(Decimal(15,2), default=0.00)
    reset_amount = Column(Decimal(15,2), default=0.00)
    executed_by = Column(String(150), nullable=False)
    executed_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="Completed")

class ModelFinancialTransaction(Base):
    __tablename__ = "financial_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(50), unique=True, index=True, nullable=False)
    transaction_date = Column(Date, nullable=False)
    supplier = Column(String(255), nullable=False)
    amount = Column(Decimal(15, 2), nullable=False)
    description = Column(Text, nullable=False)
    office_id = Column(String(36), ForeignKey("offices.id", ondelete="RESTRICT"))
    receipt_file_name = Column(String(255))
    status = Column(String(50), default="Draft", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents_rel = relationship("ModelSupportingDocument", back_populates="transaction")
    history_rel = relationship("ModelTransactionHistory", back_populates="transaction")

class ModelSupportingDocument(Base):
    __tablename__ = "supporting_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(50), ForeignKey("financial_transactions.transaction_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)
    file_name = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    transaction = relationship("ModelFinancialTransaction", back_populates="documents_rel")

class ModelTransactionHistory(Base):
    __tablename__ = "transaction_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(50), ForeignKey("financial_transactions.transaction_id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False)
    changed_by = Column(String(150), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)
    remarks = Column(Text)

    transaction = relationship("ModelFinancialTransaction", back_populates="history_rel")

class ModelAsset(Base):
    __tablename__ = "assets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_number = Column(String(100), unique=True, index=True, nullable=False)
    serial_number = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    date_acquired = Column(Date, nullable=False)
    cost = Column(Decimal(15, 2), nullable=False)
    status = Column(String(50), default="Available", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ModelAssetIssuance(Base):
    __tablename__ = "asset_issuances"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_id = Column(String(36), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    asset_number = Column(String(100), nullable=False)
    assigned_to_id = Column(String(36), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    assigned_to_name = Column(String(150), nullable=False)
    date_issued = Column(Date, nullable=False)
    quantity = Column(Integer, default=1)
    condition_on_issue = Column(Text, nullable=False)
    return_date = Column(Date)
    condition_on_return = Column(Text)
    clearance_status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

class ModelSupplyItem(Base):
    __tablename__ = "supply_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), unique=True, index=True, nullable=False)
    total_quantity = Column(Integer, default=0, nullable=False)
    available_quantity = Column(Integer, default=0, nullable=False)
    unit = Column(String(50), default="pieces")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ModelRequest(Base):
    __tablename__ = "requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_type = Column(String(50), nullable=False)
    employee_record_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name = Column(String(150), nullable=False)
    office_id = Column(String(36), ForeignKey("offices.id", ondelete="SET NULL"))
    date_requested = Column(Date, default=date.today)
    status = Column(String(50), default="Draft", nullable=False)
    approved_by = Column(String(150))
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class WorkflowHistory(Base):
    __tablename__ = "workflow_history"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=False)
    previous_status = Column(String(50))
    new_status = Column(String(50), nullable=False)
    remarks = Column(Text)
    acted_by = Column(String(150), nullable=False)
    acted_as_role = Column(String(100), nullable=False)
    acted_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String(100), nullable=False)
    username = Column(String(100), nullable=False)
    role = Column(String(100), nullable=False)
    action = Column(Text, nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(String(100))
    previous_value = Column(Text)
    new_value = Column(Text)
    details = Column(Text)
    ip_address = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

class ModelAnnualTrainingBudget(Base):
    __tablename__ = "annual_training_budgets"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fiscal_year_id = Column(String(36), ForeignKey("fiscal_years.id", ondelete="RESTRICT"), nullable=False)
    total_budget = Column(Decimal(15, 2), nullable=False, default=0.00)
    created_at = Column(DateTime, default=datetime.utcnow)
    
class ModelTrainingProgram(Base):
    __tablename__ = "training_programs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False)
    allocated_budget = Column(Decimal(15, 2), nullable=False, default=0.00)
    used_budget = Column(Decimal(15, 2), nullable=False, default=0.00)
    fiscal_year = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_days = Column(Integer, nullable=False)
    total_hours = Column(Integer, nullable=False)
    venue = Column(String(255), nullable=False)
    facilitator = Column(String(255))
    max_participants = Column(Integer, nullable=False)
    target_specialization = Column(String(255))
    target_division = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

class ModelTrainingParticipant(Base):
    __tablename__ = "training_participants"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    training_program_id = Column(String(36), ForeignKey("training_programs.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="Assigned", nullable=False)
    allowance_allocated = Column(Decimal(15, 2), nullable=False, default=0.00)
    created_at = Column(DateTime, default=datetime.utcnow)
    
class ModelTrainingLiquidationExpense(Base):
    __tablename__ = "training_liquidation_expenses"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    training_program_id = Column(String(36), ForeignKey("training_programs.id", ondelete="CASCADE"), nullable=False)
    expense_category = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Decimal(15, 2), nullable=False, default=0.00)
    receipt_file_name = Column(String(255))
    date_incurred = Column(Date, nullable=False)
    submitted_by = Column(String(150), nullable=False)
    status = Column(String(50), default="Pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

