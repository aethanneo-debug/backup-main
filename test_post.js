fetch("http://localhost:3000/api/training/budgets", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // We need a valid token. Let's get one by logging in.
  },
  body: JSON.stringify({ fiscalYearId: "fy-1", newAnnualBudget: 100000 })
}).then(r => r.json()).then(console.log);
