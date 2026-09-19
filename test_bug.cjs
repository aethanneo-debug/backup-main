const fs = require('fs');
const dbStr = fs.readFileSync('server.ts', 'utf8');
const lines = dbStr.split('\n');
const startIdx = lines.findIndex(l => l.includes('app.post("/api/training/budgets"'));
console.log(lines.slice(startIdx, startIdx + 30).join('\n'));
