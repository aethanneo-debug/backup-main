import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const DATA_FILE_PATH = './data_store.json';
const CREDENTIALS_FILE_PATH = './backend_fastapi/generated_employee_credentials.csv';

// Load existing data
let db = {
  users: [],
  employees: [],
  employmentHistory: [],
  trainings: [],
  financialTransactions: [],
  assets: [],
  assetIssuances: [],
  supplyItems: [],
  supplyIssuances: [],
  requests: [],
  auditLogs: [],
  liquidations: [],
  budgetAllocations: [],
  financeAuditLogs: [],
  budgetRequests: [],
  notifications: [],
  activities: [],
  liquidationSubmissions: [],
  activityBudgetLinks: [],
  pds: []
};

if (fs.existsSync(DATA_FILE_PATH)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf8'));
  } catch (e) {
    console.log("Could not parse data_store.json, resetting.");
  }
}

// 1. Exact 15 active employees details
const officialRoster = [
  {
    "fullName": "Eulogio IV Esturas",
    "plantillaNumber": "HSACB-LEA2-12-2019",
    "employeeType": "Plantilla",
    "position": "Legal Assistant II",
    "officeCode": "OCRA",
    "employmentStatus": "Permanent",
    "salaryGrade": 12,
    "step": 2,
    "dateHired": "2022-09-01",
    "isActive": true
  },
  {
    "fullName": "Jolly Joy A. Almoite",
    "plantillaNumber": "HSACB-LEA2-10-2019",
    "employeeType": "Plantilla",
    "position": "Legal Assistant II",
    "officeCode": "OCRA",
    "employmentStatus": "Permanent",
    "salaryGrade": 12,
    "step": 1,
    "dateHired": "2022-10-03",
    "isActive": true
  },
  {
    "fullName": "Froilan J. Estepa",
    "plantillaNumber": null,
    "employeeType": "Non-Plantilla",
    "position": "Administrative Aide IV",
    "officeCode": "OCRA",
    "employmentStatus": "Contractual",
    "salaryGrade": 4,
    "step": 1,
    "dateHired": "2025-06-26",
    "isActive": true
  },
  {
    "fullName": "Atty. Korrine Madeleine Flores - Fontanilla",
    "plantillaNumber": "HSACB-ATY5-8-2019",
    "employeeType": "Plantilla",
    "position": "Attorney V",
    "officeCode": "LEG",
    "employmentStatus": "Permanent",
    "salaryGrade": 25,
    "step": 1,
    "dateHired": "2026-02-24",
    "isActive": true
  },
  {
    "fullName": "Atty. Alyssa Ronalyn C. Dumlao",
    "plantillaNumber": "HSACB-ATY4-7-2019",
    "employeeType": "Plantilla",
    "position": "Attorney IV",
    "officeCode": "LEG",
    "employmentStatus": "Permanent",
    "salaryGrade": 23,
    "step": 1,
    "dateHired": "2022-01-03",
    "isActive": true
  },
  {
    "fullName": "Paolo Antonio M. Macalino",
    "plantillaNumber": "HSACB-HHRO3-6-2019",
    "employeeType": "Plantilla",
    "position": "Housing and Homesite Regulation Officer III",
    "officeCode": "LEG",
    "employmentStatus": "Permanent",
    "salaryGrade": 16,
    "step": 2,
    "dateHired": "2021-05-17",
    "isActive": true
  },
  {
    "fullName": "Christine Reyes - Juan",
    "plantillaNumber": "HSACB-HHRO1-4-2019",
    "employeeType": "Plantilla",
    "position": "Housing and Homesite Regulation Officer I",
    "officeCode": "LEG",
    "employmentStatus": "Permanent",
    "salaryGrade": 11,
    "step": 2,
    "dateHired": "2022-10-03",
    "isActive": true
  },
  {
    "fullName": "Samantha C. Bernardo",
    "plantillaNumber": "HSACB-SHE2-3-2019",
    "employeeType": "Plantilla",
    "position": "Sheriff II",
    "officeCode": "LEG",
    "employmentStatus": "Permanent",
    "salaryGrade": 7,
    "step": 1,
    "dateHired": "2024-05-02",
    "isActive": true
  },
  {
    "fullName": "Niño Romyr H. Saavedra",
    "plantillaNumber": "HSACB-CADOF-9-2019",
    "employeeType": "Plantilla",
    "position": "Chief Administrative Officer",
    "officeCode": "AFD",
    "employmentStatus": "Permanent",
    "salaryGrade": 24,
    "step": 2,
    "dateHired": "2021-07-16",
    "isActive": true
  },
  {
    "fullName": "Lalaine S. Lucido",
    "plantillaNumber": "HSACB-SADOF-8-2019",
    "employeeType": "Plantilla",
    "position": "Supervising Administrative Officer",
    "officeCode": "AFD",
    "employmentStatus": "Permanent",
    "salaryGrade": 22,
    "step": 2,
    "dateHired": "2021-04-05",
    "isActive": true
  },
  {
    "fullName": "Vanessa Joy P. Ginez",
    "plantillaNumber": "HSACB-A3-7-2019",
    "employeeType": "Plantilla",
    "position": "Accountant III",
    "officeCode": "AFD",
    "employmentStatus": "Permanent",
    "salaryGrade": 19,
    "step": 2,
    "dateHired": "2021-07-01",
    "isActive": true
  },
  {
    "fullName": "Terelyn F. Corpuz",
    "plantillaNumber": "HSACB-ADOF5-6-2019",
    "employeeType": "Plantilla",
    "position": "Administrative Officer V",
    "officeCode": "AFD",
    "employmentStatus": "Permanent",
    "salaryGrade": 18,
    "step": 2,
    "dateHired": "2021-06-01",
    "isActive": true
  },
  {
    "fullName": "Ronald G. Liclican",
    "plantillaNumber": "HSACB-ADOF4-5-2019",
    "employeeType": "Plantilla",
    "position": "Administrative Officer IV",
    "officeCode": "AFD",
    "employmentStatus": "Permanent",
    "salaryGrade": 15,
    "step": 2,
    "dateHired": "2021-04-27",
    "isActive": true
  },
  {
    "fullName": "Jody Anne A. Asuncion",
    "plantillaNumber": "HSACB-ADOF3-4-2019",
    "employeeType": "Plantilla",
    "position": "Administrative Officer III",
    "officeCode": "AFD",
    "employmentStatus": "Permanent",
    "salaryGrade": 14,
    "step": 2,
    "dateHired": "2021-07-16",
    "isActive": true
  },
  {
    "fullName": "Krisiha Mae P. Ancheta",
    "plantillaNumber": "HSACB-ADOF1-3-2019",
    "employeeType": "Plantilla",
    "position": "Administrative Officer I",
    "officeCode": "AFD",
    "employmentStatus": "Permanent",
    "salaryGrade": 10,
    "step": 1,
    "dateHired": "2023-07-03",
    "isActive": true
  }
];

const usernameMap = {
  "Eulogio IV Esturas": "eulogio.esturas",
  "Jolly Joy A. Almoite": "jolly.almoite",
  "Froilan J. Estepa": "froilan.estepa",
  "Atty. Korrine Madeleine Flores - Fontanilla": "korrine.fontanilla",
  "Atty. Alyssa Ronalyn C. Dumlao": "alyssa.dumlao",
  "Paolo Antonio M. Macalino": "paolo.macalino",
  "Christine Reyes - Juan": "christine.juan",
  "Samantha C. Bernardo": "samantha.bernardo",
  "Niño Romyr H. Saavedra": "nino.saavedra",
  "Lalaine S. Lucido": "lalaine.lucido",
  "Vanessa Joy P. Ginez": "vanessa.ginez",
  "Terelyn F. Corpuz": "terelyn.corpuz",
  "Ronald G. Liclican": "ronald.liclican",
  "Jody Anne A. Asuncion": "jody.asuncion",
  "Krisiha Mae P. Ancheta": "krisiha.ancheta"
};

// Map office codes to full divisions
const divisionMap = {
  "OCRA": "Adjudication Division",
  "LEG": "Legal Division",
  "AFD": "Administrative and Finance Division"
};

// Parse names helper
function parseName(fullName) {
  const parts = fullName.replace(/Atty\.\s+/g, '').trim().split(' ');
  const surname = parts[parts.length - 1];
  const firstName = parts.slice(0, parts.length - 1).join(' ');
  const middleName = firstName.endsWith('A.') || firstName.endsWith('C.') || firstName.endsWith('H.') || firstName.endsWith('S.') || firstName.endsWith('P.') || firstName.endsWith('F.') || firstName.endsWith('G.') ? firstName.split(' ').pop() : '';
  const realFirstName = middleName ? firstName.replace(new RegExp('\\s*' + middleName + '$'), '') : firstName;
  return {
    surname,
    firstName: realFirstName,
    middleName: middleName || undefined,
    nameExtension: fullName.includes('IV') ? 'IV' : undefined,
    honorific: fullName.startsWith('Atty.') ? 'Atty.' : undefined
  };
}

// 2. Hash helper using standard crypto
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const seedEmployees = [];
const seedUsers = [];
const csvRows = ["Full Name,Username,Temporary Password,Employee UUID,Plantilla Number,Account Status"];

const activeIdMap = {};

// Create 15 active employees and their active accounts
officialRoster.forEach(emp => {
  const empId = crypto.randomUUID();
  const username = usernameMap[emp.fullName];
  const parsed = parseName(emp.fullName);

  const empRecord = {
    id: empId,
    employeeId: empId, // compatibility fallback
    plantillaNumber: emp.plantillaNumber,
    employeeType: emp.employeeType,
    fullName: emp.fullName,
    surname: parsed.surname,
    firstName: parsed.firstName,
    middleName: parsed.middleName,
    nameExtension: parsed.nameExtension,
    position: emp.position,
    division: divisionMap[emp.officeCode],
    employmentStatus: emp.employmentStatus,
    salaryGrade: emp.salaryGrade,
    step: emp.step,
    email: `${username}@hsac.gov.ph`,
    officialEmail: `${username}@hsac.gov.ph`,
    dateHired: emp.dateHired,
    isActive: true,
    contactNumber: "0917-555-" + Math.floor(1000 + Math.random() * 9000),
    address: "Baguio City, Benguet, Region 1",
    emergencyContactName: "Emergency Contact",
    emergencyContactPhone: "0917-888-0000"
  };

  seedEmployees.push(empRecord);
  activeIdMap[emp.fullName] = empId;

  // Generate unique secure temporary password
  const tempPass = "TempPass@" + username.substring(0, 4) + "!" + Math.floor(100 + Math.random() * 900);
  const passHash = hashPassword(tempPass);

  const userRecord = {
    id: `u-${crypto.randomUUID()}`,
    username: username,
    email: empRecord.email,
    fullName: emp.fullName,
    role: "Personnel",
    employeeId: empId,
    status: "Active",
    passwordHash: passHash,
    requirePasswordChange: true,
    createdAt: new Date().toISOString()
  };

  seedUsers.push(userRecord);

  // CSV documentation
  csvRows.push(`"${emp.fullName}",${username},${tempPass},${empId},${emp.plantillaNumber || "N/A – Non-Plantilla"},Active`);
});

// Add Terrence Hector Q. Casuga as separated, is_active=false
const terrenceId = crypto.randomUUID();
const terrenceRecord = {
  id: terrenceId,
  employeeId: terrenceId,
  plantillaNumber: null,
  employeeType: "Non-Plantilla",
  fullName: "Terrence Hector Q. Casuga",
  surname: "Casuga",
  firstName: "Terrence Hector",
  middleName: "Q.",
  position: "Administrative Assistant",
  division: "Administrative and Finance Division",
  employmentStatus: "Separated",
  isActive: false,
  archivedAt: new Date().toISOString(),
  email: "terrence.casuga@hsac.gov.ph",
  officialEmail: "terrence.casuga@hsac.gov.ph",
  dateHired: "2022-05-01"
};
seedEmployees.push(terrenceRecord);

// Add Atty. Ligaya G. Liclican - Haban as inactive (not counted under normal roster)
const ligayaId = crypto.randomUUID();
const ligayaRecord = {
  id: ligayaId,
  employeeId: ligayaId,
  plantillaNumber: "HSAC-RAB1-DIR-01",
  employeeType: "Executive",
  fullName: "Atty. Ligaya G. Liclican - Haban",
  surname: "Liclican - Haban",
  firstName: "Ligaya",
  middleName: "G.",
  position: "Director III",
  division: "Executive Division",
  employmentStatus: "Attached",
  isActive: false,
  email: "ligaya.haban@hsac.gov.ph",
  officialEmail: "ligaya.haban@hsac.gov.ph",
  dateHired: "2010-01-01"
};
seedEmployees.push(ligayaRecord);

// Retain development users but make sure they are not counted as active employees
// Set their employeeId to a separate dev identifier
const devUsers = [
  {
    id: "u-admin",
    username: "admin",
    email: "admin@hsac.gov.ph",
    fullName: "Hon. Romeo M. Alcantara (Dev Admin)",
    role: "Administrator / Division Chief",
    employeeId: "DEV-ADMIN-MOCK",
    status: "Active",
    createdAt: "2026-01-15T08:00:00Z"
  },
  {
    id: "u-hr",
    username: "hr",
    email: "clara.santos@hsac.gov.ph",
    fullName: "Maria Clara V. Santos (Dev HR)",
    role: "HR Officer",
    employeeId: "DEV-HR-MOCK",
    status: "Active",
    createdAt: "2026-01-15T08:30:00Z"
  },
  {
    id: "u-finance",
    username: "finance",
    email: "juan.delacruz@hsac.gov.ph",
    fullName: "Juan dela Cruz (Dev Finance)",
    role: "Financial Officer",
    employeeId: "DEV-FINANCE-MOCK",
    status: "Active",
    createdAt: "2026-01-15T09:00:00Z"
  },
  {
    id: "u-budget",
    username: "budget",
    email: "budget@hsac.gov.ph",
    fullName: "Francisco Balagtas (Dev Budget)",
    role: "Budget Officer",
    employeeId: "DEV-BUDGET-MOCK",
    status: "Active",
    createdAt: "2026-01-15T10:00:00Z"
  }
];

// Combine users
db.users = [...devUsers, ...seedUsers];
db.employees = seedEmployees;

// Clean up or re-map other fields if they point to old mock IDs, to point to new active employees
const randomActiveEmpId = () => {
  const idx = Math.floor(Math.random() * seedEmployees.filter(e => e.isActive).length);
  return seedEmployees.filter(e => e.isActive)[idx].id;
};

// Re-map financial transactions employeeIds
if (db.financialTransactions) {
  db.financialTransactions.forEach((tx, idx) => {
    tx.employeeId = randomActiveEmpId();
    tx.createdBy = db.users.find(u => u.employeeId === tx.employeeId)?.fullName || "System Admin";
    if (tx.history && Array.isArray(tx.history)) {
      tx.history.forEach(h => {
        const randomUser = db.users[Math.floor(Math.random() * db.users.length)];
        h.changedBy = randomUser.fullName;
      });
    }
  });
}

// Re-map assets assignedToId
if (db.assets) {
  db.assets.forEach(ast => {
    if (ast.status === "Assigned") {
      const activeE = seedEmployees.filter(e => e.isActive);
      const randomE = activeE[Math.floor(Math.random() * activeE.length)];
      ast.assignedToId = randomE.id;
      ast.assignedToName = randomE.fullName;
    }
  });
}

// Re-map asset issuances
if (db.assetIssuances) {
  db.assetIssuances.forEach(iss => {
    const activeE = seedEmployees.filter(e => e.isActive);
    const randomE = activeE[Math.floor(Math.random() * activeE.length)];
    iss.assignedToId = randomE.id;
    iss.assignedToName = randomE.fullName;
  });
}

// Re-map supply issuances
if (db.supplyIssuances) {
  db.supplyIssuances.forEach(iss => {
    const activeE = seedEmployees.filter(e => e.isActive);
    const randomE = activeE[Math.floor(Math.random() * activeE.length)];
    iss.issuedToId = randomE.id;
    iss.issuedToName = randomE.fullName;
  });
}

// Re-map requests
if (db.requests) {
  db.requests.forEach(req => {
    const activeE = seedEmployees.filter(e => e.isActive);
    const randomE = activeE[Math.floor(Math.random() * activeE.length)];
    req.employeeId = randomE.id;
    req.employeeName = randomE.fullName;
    if (req.passengers) {
      req.passengers = "Eulogio IV Esturas, Jolly Joy A. Almoite, Froilan J. Estepa";
    }
  });
}

// Re-map notifications
if (db.notifications) {
  db.notifications.forEach(notif => {
    if (notif.message && notif.message.includes("Andres Bonifacio")) {
      notif.message = notif.message.replace(/Andres Bonifacio/g, "Atty. Korrine Madeleine Flores - Fontanilla");
    }
  });
}

// Re-map liquidations
if (db.liquidations) {
  db.liquidations.forEach(liq => {
    const activeE = seedEmployees.filter(e => e.isActive);
    const randomE = activeE[Math.floor(Math.random() * activeE.length)];
    liq.employee = randomE.fullName;
    liq.employeeId = randomE.id;
  });
}

// Re-map liquidation submissions
if (db.liquidationSubmissions) {
  db.liquidationSubmissions.forEach(sub => {
    const activeE = seedEmployees.filter(e => e.isActive);
    const randomE = activeE[Math.floor(Math.random() * activeE.length)];
    sub.employeeId = randomE.id;
    sub.fullName = randomE.fullName;
  });
}

// Re-map trainings
if (db.trainings) {
  db.trainings.forEach(tr => {
    tr.employeeId = randomActiveEmpId();
  });
}

// Save the database
fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(db, null, 2));
console.log(`Successfully seeded ${seedEmployees.filter(e => e.isActive).length} active employees.`);

// Save credentials file
fs.writeFileSync(CREDENTIALS_FILE_PATH, csvRows.join('\n'));
console.log(`Successfully generated credentials CSV file.`);
