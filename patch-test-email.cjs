const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const testRoute = `
// Test Email Route
app.post("/api/admin/test-email", authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief privileges" });
  }
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(400).json({ status: "error", message: "SMTP credentials are not configured in the environment secrets." });
  }

  const { targetEmail } = req.body;
  if (!targetEmail) {
    return res.status(400).json({ status: "error", message: "Target email is required." });
  }

  try {
    const info = await transporter.sendMail({
      from: '"IntegraSync Test" <' + process.env.SMTP_USER + '>',
      to: targetEmail,
      subject: 'IntegraSync - Email System Test',
      text: 'If you are reading this, the IntegraSync email system is working correctly!'
    });
    console.log("Test email sent successfully:", info.response);
    res.json({ status: "success", message: "Test email sent successfully. Check your inbox!" });
  } catch (error: any) {
    console.error("Test email failed:", error);
    res.status(500).json({ status: "error", message: "Failed to send email: " + error.message });
  }
});
`;

code = code.replace(`app.post("/api/admin/users"`, testRoute + `\napp.post("/api/admin/users"`);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with test email route");
