const fs = require('fs');
const glob = require('glob');

function patchFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;
  const matchSetters = code.match(/set[A-Za-z0-9_]+\(res[A-Za-z0-9_]*\.data\)/g);
  if (matchSetters) {
    for (const match of matchSetters) {
      code = code.replace(match, match.replace(/\)$/, ' || [])'));
      changed = true;
    }
  }
  
  // also patch `transactions.filter` to `(transactions || []).filter`
  if (code.includes('transactions.filter')) {
     code = code.replace(/transactions\.filter/g, '(transactions || []).filter');
     changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, code);
    console.log('Patched', file);
  }
}

glob.sync('src/**/*.tsx').forEach(patchFile);
