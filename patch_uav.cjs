const fs = require('fs');
let code = fs.readFileSync('src/components/UserAccountsView.tsx', 'utf8');

// Add new state variables
code = code.replace(
  'const [employeeId, setEmployeeId] = useState("");',
  'const [employeeId, setEmployeeId] = useState("");\n  const [position, setPosition] = useState("");\n  const [division, setDivision] = useState("");\n  const [employmentStatus, setEmploymentStatus] = useState("Regular");'
);

// Clear new fields on modal open
code = code.replace(
  'setError("");\n    setSuccess("");\n    setModalOpen(true);\n  }',
  'setPosition("");\n    setDivision("Adjudication Division");\n    setEmploymentStatus("Regular");\n    setError("");\n    setSuccess("");\n    setModalOpen(true);\n  }'
);

// Clear fields on openEditModal
code = code.replace(
  'setEmployeeId(usr.employeeId || "");\n    setSelectedRole(usr.role);',
  'setEmployeeId(usr.employeeId || "");\n    setPosition("");\n    setDivision("");\n    setEmploymentStatus("");\n    setSelectedRole(usr.role);'
);

// Update handleSubmit validation
code = code.replace(
  'if (!username || !email || !fullName) {\n      setError("Please fill out all mandatory credentials fields.");\n      return;\n    }',
  'if (!username || !email || !fullName || (!editingUser && (!employeeId || !position || !division))) {\n      setError("Please fill out all mandatory credentials fields (including Employee ID, Position, and Division for new accounts).");\n      return;\n    }'
);

// Update handleSubmit API calls
code = code.replace(
  'body: JSON.stringify({ username, email, fullName, role: selectedRole, status: accountStatus, employeeId })\n        });',
  'body: JSON.stringify({ username, email, fullName, role: selectedRole, status: accountStatus, employeeId })\n        });'
);

code = code.replace(
  'if (!employeeId) {\n          setError("Please select an Employee to link to this account.");\n          return;\n        }\n        const res = await apiCall("/api/admin/users", {\n          method: "POST",\n          body: JSON.stringify({ username, email, fullName, role: selectedRole, status: accountStatus, employeeId })\n        });',
  'const res = await apiCall("/api/admin/users", {\n          method: "POST",\n          body: JSON.stringify({ username, email, fullName, role: selectedRole, status: accountStatus, employeeId, position, division, employmentStatus })\n        });'
);

fs.writeFileSync('src/components/UserAccountsView.tsx', code);
