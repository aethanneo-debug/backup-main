const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/}\n        }\n      }\n    }\);\n    const textResponse/, '}\n      }\n    });\n    const textResponse');
fs.writeFileSync('server.ts', code);
