import os
import uuid
from datetime import date
from sqlalchemy import text
from database import engine

def run_seed():
    with engine.connect() as conn:
        print("Starting seeding process...")

        # Clear existing employees
        conn.execute(text("DELETE FROM employment_history;"))
        conn.execute(text("DELETE FROM trainings;"))
        conn.execute(text("DELETE FROM employee_pds;"))
        conn.execute(text("DELETE FROM seminars;"))
        conn.execute(text("DELETE FROM requests;"))
        conn.execute(text("DELETE FROM asset_issuances;"))
        conn.execute(text("DELETE FROM users WHERE role_id != 1;")) # keep admin user?
        conn.execute(text("DELETE FROM employees;"))
        
        # Get offices
        offices = conn.execute(text("SELECT id, office_name FROM offices;")).fetchall()
        office_map = {o[1]: o[0] for o in offices}
        default_office_id = list(office_map.values())[0] if office_map else None

        employees = [
            # The two specific employees mentioned
            {
                "plantilla_number": "HSAC-RAB1-DIR-01",
                "employee_type": "Executive",
                "full_name": "Atty. Ligaya G. Liclican - Haban",
                "position": "Director III",
                "division": "Executive Division",
                "office_id": default_office_id,
                "employment_status": "Attached",
                "salary_grade": 28,
                "step": 1,
                "date_hired": date(2010, 1, 1),
                "is_active": True
            },
            {
                "plantilla_number": None,
                "employee_type": "Contract of Service",
                "full_name": "Terrence Hector Q. Casuga",
                "position": "Administrative Assistant",
                "division": "Administrative and Finance Division",
                "office_id": default_office_id,
                "employment_status": "COS",
                "salary_grade": None,
                "step": None,
                "date_hired": date(2022, 5, 1),
                "is_active": True
            },
        ]
        
        # Generate 13 more plantilla employees to make a total of 15 "active" plantilla employees?
        # "15 active employees. Do not count Atty. Ligaya ... Terrence Hector ... does not increment the 15-person plantilla count"
        # Wait, if there are exactly 15 active employees (plantilla) AND those 2 are excluded from the 15 count?
        # Yes, 15 + 2 = 17 total. Let's create 15 dummy plantilla.
        for i in range(1, 16):
            employees.append({
                "plantilla_number": f"HSAC-RAB1-PL-{i:03d}",
                "employee_type": "Plantilla",
                "full_name": f"Employee {i} (Plantilla)",
                "position": f"Position {i}",
                "division": "Adjudication Division",
                "office_id": default_office_id,
                "employment_status": "Permanent",
                "salary_grade": 15,
                "step": 1,
                "date_hired": date(2020, 1, 1),
                "is_active": True
            })

        for emp in employees:
            conn.execute(text("""
                INSERT INTO employees (
                    id, plantilla_number, employee_type, full_name, position, 
                    division, office_id, employment_status, salary_grade, step,
                    date_hired, is_active
                ) VALUES (
                    :id, :plantilla_number, :employee_type, :full_name, :position,
                    :division, :office_id, :employment_status, :salary_grade, :step,
                    :date_hired, :is_active
                )
            """), {
                "id": str(uuid.uuid4()),
                "plantilla_number": emp["plantilla_number"],
                "employee_type": emp["employee_type"],
                "full_name": emp["full_name"],
                "position": emp["position"],
                "division": emp["division"],
                "office_id": emp["office_id"],
                "employment_status": emp["employment_status"],
                "salary_grade": emp["salary_grade"],
                "step": emp["step"],
                "date_hired": emp["date_hired"],
                "is_active": emp["is_active"]
            })
        
        conn.commit()
        print(f"Successfully seeded {len(employees)} employees.")

if __name__ == '__main__':
    run_seed()
