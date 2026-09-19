import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data_store.json', 'utf8'));

// Offices from schema
const office_id = "f47ac10b-58cc-4372-a567-0e02b2c3d479"; // Just a dummy UUID, or keep it empty for now

const employees = [
  {
    "id": "1",
    "plantillaNumber": "HSAC-RAB1-DIR-01",
    "employeeId": "HSAC-RAB1-DIR-01", // for compatibility
    "employeeType": "Executive",
    "fullName": "Atty. Ligaya G. Liclican - Haban",
    "position": "Director III",
    "division": "Executive Division",
    "officeId": office_id,
    "employmentStatus": "Attached",
    "salaryGrade": 28,
    "step": 1,
    "officialEmail": "ligaya.haban@hsac.gov.ph",
    "email": "ligaya.haban@hsac.gov.ph", // for compatibility
    "dateHired": "2010-01-01",
    "isActive": true
  },
  {
    "id": "2",
    "plantillaNumber": null,
    "employeeId": "COS-001",
    "employeeType": "Contract of Service",
    "fullName": "Terrence Hector Q. Casuga",
    "position": "Administrative Assistant",
    "division": "Administrative and Finance Division",
    "officeId": office_id,
    "employmentStatus": "COS",
    "salaryGrade": null,
    "step": null,
    "officialEmail": "terrence.casuga@hsac.gov.ph",
    "email": "terrence.casuga@hsac.gov.ph",
    "dateHired": "2022-05-01",
    "isActive": true
  }
];

// Generate the other 13 plantilla employees
for (let i = 1; i <= 15; i++) {
  employees.push({
    "id": (i + 2).toString(),
    "plantillaNumber": `HSAC-RAB1-PL-${i.toString().padStart(3, '0')}`,
    "employeeId": `HSAC-RAB1-PL-${i.toString().padStart(3, '0')}`,
    "employeeType": "Plantilla",
    "fullName": `Employee ${i} (Plantilla)`,
    "position": `Position ${i}`,
    "division": "Adjudication Division",
    "officeId": office_id,
    "employmentStatus": "Permanent",
    "salaryGrade": 15,
    "step": 1,
    "officialEmail": `employee${i}@hsac.gov.ph`,
    "email": `employee${i}@hsac.gov.ph`,
    "dateHired": "2020-01-01",
    "isActive": true
  });
}

data.employees = employees;

// We also need to fix Users if any user is linked to old EMP001
data.users.forEach(u => {
  if (u.employeeId === 'EMP001') u.employeeId = 'HSAC-RAB1-DIR-01';
  if (u.employeeId === 'EMP006') u.employeeId = 'HSAC-RAB1-PL-001';
});

fs.writeFileSync('./data_store.json', JSON.stringify(data, null, 2));
console.log("data_store.json updated with 17 employees.");
