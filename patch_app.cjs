const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Find render function
const oldRender = `  function renderContent() {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView`;

const newRender = `  function renderContent() {
    const myEmployeeRecord = employees.find(e => e.employeeId === user?.employeeId);
    const requiresPds = myEmployeeRecord && !myEmployeeRecord.pdsUploadedAt && user?.username !== 'admin';

    if (requiresPds && activeTab !== "pds") {
      return (
        <div className="p-8 w-full flex flex-col items-center justify-center h-full">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-amber-200 text-center max-w-md">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">PDS Required</h2>
            <p className="text-sm text-slate-600 mb-6">
              Welcome to the HSAC Integrated Personnel & Financial Management Portal. 
              Before accessing the system, you must complete and upload your Personal Data Sheet (PDS).
            </p>
            <button 
              onClick={() => setActiveTab("pds")}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
            >
              Complete PDS Now
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard":
        return <DashboardView`;

code = code.replace(oldRender, newRender);

// Also we need to make sure FileText is imported
if (!code.includes('FileText')) {
  code = code.replace('import { Fingerprint } from "lucide-react";', 'import { Fingerprint, FileText } from "lucide-react";');
}

fs.writeFileSync('src/App.tsx', code);
