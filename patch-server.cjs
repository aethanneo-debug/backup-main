const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. In authenticateToken, check for db.users and enforce password change
const oldAuthToken = `function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "Authorization credential header required" });
  }

  try {
    const rawPayload = authHeader.split(" ")[1];
    const userJson = JSON.parse(Buffer.from(rawPayload, "base64").toString("utf8"));
    req.user = userJson;
    next();
  } catch (err) {
    return res.status(403).json({ status: "error", message: "Malformed session verification token" });
  }
}`;

const newAuthToken = `function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "Authorization credential header required" });
  }

  try {
    const rawPayload = authHeader.split(" ")[1];
    const userJson = JSON.parse(Buffer.from(rawPayload, "base64").toString("utf8"));
    
    // Check against DB for latest status
    const dbUser = db.users.find(u => u.id === userJson.id);
    if (!dbUser) {
      return res.status(401).json({ status: "error", message: "User account no longer exists." });
    }
    
    // Check pending password change
    if (dbUser.status === "Pending Password Change") {
      const allowedPaths = ["/api/auth/change-password", "/api/auth/logout", "/api/sessions/current"];
      // If path is not allowed, reject
      if (!allowedPaths.includes(req.path)) {
        return res.status(403).json({ 
          status: "error", 
          message: "Temporary password active. You must change your password to continue.",
          requirePasswordChange: true
        });
      }
    }
    
    req.user = dbUser;
    next();
  } catch (err) {
    return res.status(403).json({ status: "error", message: "Malformed session verification token" });
  }
}`;
code = code.replace(oldAuthToken, newAuthToken);


// 2. In POST /api/admin/users, generate temporary password and set status to "Pending Password Change"
code = code.replace(
  '    status: status || "Active",',
  '    status: "Pending Password Change",'
);
code = code.replace(
  '  const newUser = {',
  `  const crypto = require('crypto');
  const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 char temp password
  const salt = crypto.randomBytes(16).toString('hex');
  const tempPasswordHash = crypto.pbkdf2Sync(tempPassword, salt, 1000, 64, 'sha512').toString('hex');

  const newUser = {`
);
code = code.replace(
  '    createdAt: new Date().toISOString()\n  };',
  '    createdAt: new Date().toISOString(),\n    passwordHash: `${salt}:${tempPasswordHash}`\n  };'
);
code = code.replace(
  'res.json({ status: "success", data: newUser });',
  'res.json({ status: "success", data: newUser, tempPassword });'
);


// 3. In POST /api/auth/login, include requirePasswordChange in payload
code = code.replace(
  '      employeeId: user.employeeId,\n      status: user.status\n    })).toString("base64");',
  '      employeeId: user.employeeId,\n      status: user.status,\n      requirePasswordChange: user.status === "Pending Password Change"\n    })).toString("base64");'
);

// 4. In POST /api/auth/change-password, update status if successful
code = code.replace(
  '  // Process DB sync\n  saveDB();',
  '  // Update status if pending\n  if (user.status === "Pending Password Change") {\n    user.status = "Active";\n  }\n\n  // Process DB sync\n  saveDB();'
);

// 5. In GET /api/sessions/current, include requirePasswordChange
code = code.replace(
  'app.get("/api/sessions/current", authenticateToken, (req: any, res) => {\n  res.json({ status: "success", data: req.user });\n});',
  'app.get("/api/sessions/current", authenticateToken, (req: any, res) => {\n  const user = req.user;\n  const responseUser = { ...user, requirePasswordChange: user.status === "Pending Password Change" };\n  res.json({ status: "success", data: responseUser });\n});'
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts successfully");
