const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldUserEndpoint = `app.post("/api/admin/users", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief privileges" });
  }
  const { username, email, fullName, role, status, employeeId } = req.body;
  if (!username || !email || !fullName || !role || !employeeId) {
    return res.status(400).json({ status: "error", message: "Please supply all required properties including employeeId" });
  }
  
  const existing = db.users.find(u => u.username === username || u.email === email);
  if (existing) {
    return res.status(400).json({ status: "error", message: "Username or Email already registered" });
  }

  const newUser = {
    id: \`u-\${Date.now()}\`,
    username,
    email,
    fullName,
    role,
    status: status || "Active",
    employeeId,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create User Account", \`Created digital user: \${username} with role \${role}\`);
  saveDB();
  res.json({ status: "success", data: newUser });
});`;

const newUserEndpoint = `app.post("/api/admin/users", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief privileges" });
  }
  const { username, email, fullName, role, status, employeeId, position, division, employmentStatus } = req.body;
  if (!username || !email || !fullName || !role || !employeeId || !position || !division) {
    return res.status(400).json({ status: "error", message: "Please supply all required properties including Employee ID, Position, and Division" });
  }
  
  const existingUser = db.users.find(u => u.username === username || u.email === email);
  if (existingUser) {
    return res.status(400).json({ status: "error", message: "Username or Email already registered" });
  }

  const existingEmp = db.employees.find((e: any) => e.employeeId === employeeId);
  if (existingEmp) {
    return res.status(400).json({ status: "error", message: "An employee with this Employee ID already exists." });
  }

  // Create Employee
  const newEmployee = {
    id: \`emp-\${Date.now()}\`,
    employeeId,
    fullName,
    position,
    division,
    employmentStatus: employmentStatus || "Regular",
    email,
    dateHired: new Date().toISOString().split('T')[0],
    isActive: true
  };
  
  db.employees.push(newEmployee);

  // Create User
  const newUser = {
    id: \`u-\${Date.now()}\`,
    username,
    email,
    fullName,
    role,
    status: status || "Active",
    employeeId,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create User Account", \`Created digital user: \${username} and employee \${employeeId}\`);
  saveDB();
  res.json({ status: "success", data: newUser });
});`;

if (code.includes(oldUserEndpoint)) {
  code = code.replace(oldUserEndpoint, newUserEndpoint);
  fs.writeFileSync('server.ts', code);
  console.log('Successfully patched server.ts user endpoint');
} else {
  console.log('Failed to find old user endpoint in server.ts');
}
