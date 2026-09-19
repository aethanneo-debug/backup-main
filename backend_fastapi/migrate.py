import os
from sqlalchemy import text
from backend_fastapi.database import engine

def run_migration():
    with engine.connect() as conn:
        print("Starting migration...")
        
        # 1. Add employee_record_id to all related tables
        tables = [
            "users", "employment_history", "trainings", "employee_pds", 
            "seminars", "budget_ledger_entries", "requests"
        ]
        
        for table in tables:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS employee_record_id UUID REFERENCES employees(id) ON DELETE SET NULL;"))
                print(f"Added employee_record_id to {table}")
            except Exception as e:
                print(f"Error adding to {table}: {e}")

        # 2. Add new columns to employees table
        try:
            conn.execute(text("""
                ALTER TABLE employees 
                ADD COLUMN IF NOT EXISTS plantilla_number VARCHAR(50),
                ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50) DEFAULT 'Plantilla',
                ADD COLUMN IF NOT EXISTS salary_grade INTEGER,
                ADD COLUMN IF NOT EXISTS step INTEGER,
                ADD COLUMN IF NOT EXISTS position_effective_date DATE,
                ADD COLUMN IF NOT EXISTS appointment_date DATE,
                ADD COLUMN IF NOT EXISTS csc_approval_date DATE,
                ADD COLUMN IF NOT EXISTS entry_to_government DATE,
                ADD COLUMN IF NOT EXISTS entry_to_hsac DATE,
                ADD COLUMN IF NOT EXISTS official_email VARCHAR(255),
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
            """))
            print("Added new columns to employees.")
        except Exception as e:
            print(f"Error altering employees: {e}")

        # 3. Create partial unique index
        try:
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_plantilla_number 
                ON employees (plantilla_number) 
                WHERE plantilla_number IS NOT NULL;
            """))
            print("Created partial index.")
        except Exception as e:
            print(f"Error creating partial index: {e}")

        # 4. Backfill relationships
        for table in tables:
            try:
                conn.execute(text(f"""
                    UPDATE {table} t
                    SET employee_record_id = e.id
                    FROM employees e
                    WHERE t.employee_id = e.employee_id AND t.employee_record_id IS NULL;
                """))
                print(f"Backfilled {table}")
            except Exception as e:
                print(f"Error backfilling {table}: {e}")
                
        conn.commit()
        print("Migration completed.")

if __name__ == '__main__':
    run_migration()
