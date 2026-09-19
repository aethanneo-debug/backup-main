const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace('import EmployeesView from "./components/EmployeesView";\n', '');
code = code.replace(/case "employees":[\s\S]*?(?=case "pds":)/, '');

fs.writeFileSync('src/App.tsx', code);
