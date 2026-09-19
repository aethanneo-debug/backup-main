const fs = require('fs');
let code = fs.readFileSync('src/components/UserAccountsView.tsx', 'utf8');

// Replace the Employee Link section
const oldEmployeeSelect = `
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Employee Link</label>
                <select 
                  value={employeeId} 
                  onChange={e => setEmployeeId(e.target.value)} 
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  required
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.employeeId} value={emp.employeeId}>{emp.fullName} ({emp.employeeId})</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Required to link system accounts to their corresponding HR profiles.</p>
              </div>`;

const newEmployeeSection = `
              {!editingUser && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Employee ID</label>
                    <input type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" required placeholder="EMP-001" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Division / Department</label>
                    <select value={division} onChange={e => setDivision(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" required>
                      <option value="Adjudication Division">Adjudication Division</option>
                      <option value="Legal Division">Legal Division</option>
                      <option value="Administrative and Finance Division">Administrative and Finance Division</option>
                      <option value="Records Division">Records Division</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Position / Role</label>
                    <input type="text" value={position} onChange={e => setPosition(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" required placeholder="e.g. Attorney III" />
                  </div>
                </>
              )}
              {editingUser && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Employee ID (Locked)</label>
                  <input type="text" value={employeeId} disabled className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono" />
                </div>
              )}
`;

code = code.replace(oldEmployeeSelect, newEmployeeSection);

fs.writeFileSync('src/components/UserAccountsView.tsx', code);
