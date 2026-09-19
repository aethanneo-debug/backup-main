const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

const actRegex = /app\.get\("\/api\/activities", authenticateToken, \(req: any, res\) => {([\s\S]*?)res\.json\({ status: "success", data: db\.activities }\);\n}\);/g;

server = server.replace(actRegex, `app.get("/api/activities", authenticateToken, (req: any, res) => {
  const { role, employeeId } = req.user;
  
  if (role === UserRole.EMPLOYEE) {
    const empRecord = db.employees.find((e: any) => e.employeeId === employeeId);
    const altId = empRecord ? empRecord.id : null;
    const list = db.activities.filter((a: any) => a.assignedEmployeeId === employeeId || a.assignedEmployeeId === altId);
    
    // Inject assigned training programs
    const trainings = db.trainingParticipants.filter((p: any) => p.employeeId === altId || p.employeeId === employeeId);
    for (const t of trainings) {
      const prog = db.trainingPrograms.find((p: any) => p.id === t.trainingProgramId);
      if (prog) {
        list.push({
          id: t.id,
          activityNo: \`TRN-2026-\${prog.id.replace('tp-','')}\`,
          title: \`Seminar/Training: \${prog.title}\`,
          description: prog.description || "Assigned training program",
          dateScheduled: prog.startDate,
          allottedBudget: t.allowanceAllocated || 0,
          budgetId: "training-budget",
          assignedEmployeeId: employeeId,
          type: "training"
        });
      }
    }
    
    return res.json({ status: "success", data: list });
  }
  
  res.json({ status: "success", data: db.activities });
});`);

fs.writeFileSync('server.ts', server);
console.log("Patched activities");
