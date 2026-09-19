const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  'case UserRole.HR_OFFICER:\n        return "employees";', 
  'case UserRole.HR_OFFICER:\n        return "pds";' // Changed from employees to pds
);
fs.writeFileSync('src/App.tsx', code);
