const fs = require('fs');
let code = fs.readFileSync('src/components/FinanceView.tsx', 'utf8');

code = code.replace(
  'setTxnList(res.data);',
  'setTxnList(res.data || []);'
);
code = code.replace(
  'setSubmissions(resSub.data);',
  'setSubmissions(resSub.data || []);'
);
code = code.replace(
  'setBudgets(resBud.data);',
  'setBudgets(resBud.data || []);'
);
code = code.replace(
  'setHsacBudgets(resHsac.data);',
  'setHsacBudgets(resHsac.data || []);'
);
code = code.replace(
  'setTrainingBudgets(resTrain.data);',
  'setTrainingBudgets(resTrain.data || []);'
);
code = code.replace(
  'setBudgetRequests(reqBud.data);',
  'setBudgetRequests(reqBud.data || []);'
);
code = code.replace(
  'setFinanceAuditLogs(logsRes.data);',
  'setFinanceAuditLogs(logsRes.data || []);'
);
code = code.replace(
  'setLiquidationLinks(links.data);',
  'setLiquidationLinks(links.data || []);'
);

fs.writeFileSync('src/components/FinanceView.tsx', code);
console.log('Patched Finance arrays');
