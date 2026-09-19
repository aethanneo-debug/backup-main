const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /responseSchema:\s*\{\s*type:\s*Type\.OBJECT,\s*properties:\s*\{[\s\S]*?\}\s*\}\s*\}\s*\}\s*\}\s*\n\s*\}\);\n\s*const textResponse/;

code = code.replace(regex, (match) => {
  // Let's just strip out extra closing braces
  return match.replace(/}\s*}\s*}\s*}\s*}\);\n\s*const textResponse/, '}\n      }\n    });\n    const textResponse');
});

fs.writeFileSync('server.ts', code);
