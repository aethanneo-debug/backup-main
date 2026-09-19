import fs from 'fs';
import crypto from 'crypto';

const data = JSON.parse(fs.readFileSync('./data_store.json', 'utf8'));

// First, generate UUIDs for all employees
const empIdMap = {}; // Maps old employeeId (or new ones) to UUIDs

data.employees.forEach(emp => {
  emp.id = crypto.randomUUID();
  empIdMap[emp.employeeId] = emp.id;
  if (emp.plantillaNumber) empIdMap[emp.plantillaNumber] = emp.id;
});

// For any old legacy EMP00X, map them if possible
empIdMap["EMP001"] = empIdMap["HSAC-RAB1-DIR-01"] || data.employees[0].id;
empIdMap["EMP006"] = empIdMap["HSAC-RAB1-PL-001"] || data.employees[2].id;

function updateRefs(array, field) {
  if (!array) return;
  array.forEach(item => {
    if (item[field] && empIdMap[item[field]]) {
      item[field] = empIdMap[item[field]];
    } else {
      // Just map to first employee as fallback for orphaned records
      item[field] = data.employees[0].id;
    }
  });
}

updateRefs(data.users, 'employeeId');
updateRefs(data.employmentHistory, 'employeeId');
updateRefs(data.trainings, 'employeeId');
updateRefs(data.seminars, 'employeeId');
updateRefs(data.requests, 'employeeId');
updateRefs(data.pds, 'employeeId');

// Some uses employee property
if (data.liquidations) {
  data.liquidations.forEach(item => {
    if (item.employee && empIdMap[item.employee]) {
       item.employee = empIdMap[item.employee];
    } else if (item.employeeId && empIdMap[item.employeeId]) {
       item.employeeId = empIdMap[item.employeeId];
    }
  });
}

fs.writeFileSync('./data_store.json', JSON.stringify(data, null, 2));
console.log("relationships updated to use UUIDs.");
