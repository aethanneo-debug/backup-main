const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'if (finRes.status === "success") setTransactions(finRes.data);',
  'if (finRes.status === "success") setTransactions(finRes.data || []);'
);
code = code.replace(
  'if (astRes.status === "success") setAssets(astRes.data);',
  'if (astRes.status === "success") setAssets(astRes.data || []);'
);
code = code.replace(
  'if (supRes.status === "success") setSupplies(supRes.data);',
  'if (supRes.status === "success") setSupplies(supRes.data || []);'
);
code = code.replace(
  'if (reqRes.status === "success") setRequests(reqRes.data);',
  'if (reqRes.status === "success") setRequests(reqRes.data || []);'
);

fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx arrays');
