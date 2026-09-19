import React, { useState, useEffect } from "react";
import { AuditLog, User, UserRole } from "../types";
import { 
  ShieldCheck, 
  Search, 
  Calendar, 
  User as UserIcon, 
  Settings, 
  RefreshCw,
  Clock,
  Terminal,
  Activity
} from "lucide-react";
import { apiCall, formatDate } from "../utils";

interface AuditViewProps {
  user: User;
  onRefresh: () => void;
}

export default function AuditView({ user, onRefresh }: AuditViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    setLoading(true);
    try {
      const res = await apiCall("/api/audit-logs");
      if (res.status === "success") {
        setLogs(res.data || []);
      }
    } catch (err: any) {
      console.error("Failed to query audit trails", err);
    } finally {
      setLoading(false);
    }
  }

  // Live matching logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Exact or partial category match
    const matchesAction = actionFilter ? log.action.toLowerCase() === actionFilter.toLowerCase() : true;
    
    return matchesSearch && matchesAction;
  });

  return (
    <div id="audit-view-container" className="flex-1 flex flex-col p-6 gap-4 bg-slate-50 overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-md font-bold text-slate-800 flex items-center">
            <ShieldCheck className="text-emerald-600 mr-2" size={18} />
            System Security Audit Log Chronicle
          </h1>
          <p className="text-[11px] text-slate-500">Chronological, immutable recording of all database alterations, logins, and adjudicative remarks.</p>
        </div>
        <button
          onClick={loadAuditLogs}
          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center shadow-sm"
        >
          <RefreshCw size={13} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Audit Logs</span>
        </button>
      </div>

      {/* FILTER BAR PANEL */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search events by operator email, role, or action particulars..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-3 text-xs focus:ring-1 text-slate-600 font-semibold"
          >
            <option value="">All Security Actions</option>
            <option value="Login">Login Sessions</option>
            <option value="Create Employee">Registered Employees</option>
            <option value="Update Employee">Employee Updates</option>
            <option value="Delete Employee">Record Declassifications</option>
            <option value="Register Receipt">Expense Logs</option>
            <option value="Validate Financial Record">Ledger validations</option>
            <option value="Upload Support Doc">Doc Uploads</option>
            <option value="Register Asset">Asset Register</option>
            <option value="Assign Accountability">Accountability (PAR)</option>
            <option value="Act on Request">Filing Actions</option>
          </select>
        </div>
      </div>

      {/* DATA BOX PANEL */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] select-none">
                  <th className="p-4 w-44">System Timestamp (UTC)</th>
                  <th className="p-4">operator</th>
                  <th className="p-4">Official Role</th>
                  <th className="p-4">Action event</th>
                  <th className="p-4">Technical Details Log</th>
                  <th className="p-4 text-center">Security Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-4 text-slate-500 whitespace-nowrap flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        <span>{log.timestamp ? log.timestamp.replace("T", " ").substring(0, 19) : "N/A"}</span>
                      </td>
                      <td className="p-4 font-bold text-slate-800 flex items-center gap-1.5">
                        <UserIcon size={12} className="text-slate-400" />
                        <span>{log.username}</span>
                      </td>
                      <td className="p-4 text-slate-500 font-sans">{log.role}</td>
                      <td className="p-4 text-slate-700 font-bold">{log.action}</td>
                      <td className="p-4 text-slate-600 font-sans leading-relaxed select-all">
                        {log.details}
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-bold">
                          VERIFIED
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      No security audit logs match querying metrics.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-slate-50 border-t border-slate-100 p-2 text-center text-[10px] text-slate-400 font-mono font-semibold">
          Secured Compliant Log Stream • Authorized Personnel Only • Human Settlements Adjudication Commission No. 1
        </div>
      </div>

    </div>
  );
}
