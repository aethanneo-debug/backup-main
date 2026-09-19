const fs = require('fs');
let code = fs.readFileSync('src/components/UserAccountsView.tsx', 'utf8');

// Add state for temp password modal
code = code.replace(
  'const [modalOpen, setModalOpen] = useState(false);',
  'const [modalOpen, setModalOpen] = useState(false);\n  const [tempPasswordModal, setTempPasswordModal] = useState<{username: string, email: string, tempPassword: string} | null>(null);'
);

// Update success handler to set tempPasswordModal
code = code.replace(
  '          setSuccess("Brand new user account successfully registered and activated.");\n          fetchUsers();\n          setTimeout(() => setModalOpen(false), 800);',
  '          setSuccess("Brand new user account successfully registered. Email dispatched.");\n          fetchUsers();\n          setTempPasswordModal({ username: res.data?.username || username, email: res.data?.email || email, tempPassword: res.tempPassword });\n          setTimeout(() => setModalOpen(false), 800);'
);

// Add Temp Password Modal HTML before the main return closes
const tempModalHTML = `
      {tempPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="text-emerald-400 shrink-0" size={20} />
                <div>
                  <h3 className="font-bold text-sm tracking-wide">TEMPORARY PASSWORD DISPATCHED</h3>
                  <p className="text-[10px] text-slate-300">Account status set to Pending Password Change.</p>
                </div>
              </div>
              <button 
                onClick={() => setTempPasswordModal(null)} 
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                <p>The system attempted to email the following temporary credentials to the user's registered inbox. Please provide these credentials to the user if the simulated email network fails.</p>
              </div>
              <div className="space-y-2 text-sm text-slate-700 bg-slate-50 p-4 border border-slate-200 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-semibold">Email / Username:</span>
                  <span>{tempPasswordModal.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Temporary Password:</span>
                  <span className="font-mono bg-white px-2 py-0.5 border border-slate-200 rounded text-rose-600 font-bold">{tempPasswordModal.tempPassword}</span>
                </div>
              </div>
              <button
                onClick={() => setTempPasswordModal(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs py-2 mt-4"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

code = code.replace(/    <\/div>\n  \);\n}\s*$/, tempModalHTML);

fs.writeFileSync('src/components/UserAccountsView.tsx', code);
console.log("Patched UserAccountsView.tsx successfully");
