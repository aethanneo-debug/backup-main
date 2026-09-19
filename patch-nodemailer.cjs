const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const importNodemailer = `import crypto from "crypto";\nimport nodemailer from "nodemailer";`;
code = code.replace(`import crypto from "crypto";`, importNodemailer);

const mailerSetup = `
const saveDB = () => {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

// Mailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
`;

code = code.replace(`
const saveDB = () => {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};`, mailerSetup);

const emailDispatchLogic = `
  saveDB();
  
  // Dispatch Temporary Password via Email
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      transporter.sendMail({
        from: '"IntegraSync Security" <' + process.env.SMTP_USER + '>',
        to: email,
        subject: 'IntegraSync - Your Temporary Password',
        text: \`Hello \${fullName},\\n\\nAn account has been created for you on the IntegraSync System.\\n\\nUsername/Email: \${email}\\nTemporary Password: \${tempPassword}\\n\\nFor security purposes, you will be required to change this password immediately upon your first login.\\n\\nThank you,\\nIntegraSync Administrator\`
      }).catch(err => console.error("SMTP async error:", err));
      console.log(\`[Email Dispatch] Sent temporary password to \${email}\`);
    } catch (error) {
      console.error(\`[Email Dispatch] Failed to send email to \${email}:\`, error);
    }
  } else {
    console.warn(\`[Email Dispatch] SMTP credentials not configured in environment. Skipped sending email to \${email}\`);
  }

  res.json({ status: "success", data: newUser, tempPassword });
`;

code = code.replace(`
  saveDB();
  res.json({ status: "success", data: newUser, tempPassword });`, emailDispatchLogic);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with nodemailer");
