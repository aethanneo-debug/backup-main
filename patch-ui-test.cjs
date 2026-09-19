const fs = require('fs');
let code = fs.readFileSync('src/components/UserAccountsView.tsx', 'utf8');

const testButton = `
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center"><Mail className="mr-2 text-indigo-500" size={18} /> Test Email Dispatch</h2>
            <p className="text-xs text-slate-500">Send a test email to verify SMTP credentials.</p>
          </div>
          <button 
            onClick={async () => {
              const testEmail = prompt("Enter email address to send test to:");
              if (!testEmail) return;
              try {
                const res = await apiCall('/api/admin/test-email', {
                  method: 'POST',
                  body: JSON.stringify({ targetEmail: testEmail })
                });
                if (res.status === 'success') {
                  alert("Test email sent successfully! Check your inbox.");
                } else {
                  alert("Failed to send test email: " + (res.message || "Unknown error"));
                }
              } catch (e) {
                alert("Exception: " + e.message);
              }
            }}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-sm transition-colors"
          >
            Send Test Email
          </button>
        </div>
`;

code = code.replace(
  '{/* Actions Bar */}',
  testButton + '\\n        {/* Actions Bar */}'
);

fs.writeFileSync('src/components/UserAccountsView.tsx', code);
