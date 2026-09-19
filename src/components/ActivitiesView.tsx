import React, { useState, useEffect } from "react";
import { User } from "../types";
import { apiCall, getLocalTodayString } from "../utils";
import { Plus, Search, Calendar, Briefcase, FileText, User as UserIcon, X, Check } from "lucide-react";

interface ActivitiesViewProps {
  user: User;
  onRefresh?: () => void;
}

export default function ActivitiesView({ user, onRefresh }: ActivitiesViewProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dateScheduled: "",
    allottedBudget: "",
    budgetId: "",
    assignedEmployeeId: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [actRes, empRes, budRes] = await Promise.all([
        apiCall("/api/activities"),
        apiCall("/api/employees"),
        apiCall("/api/finance/budgets")
      ]);
      if (actRes.status === "success") setActivities(actRes.data);
      if (empRes.status === "success") setEmployees(empRes.data);
      if (budRes.status === "success") setBudgets(budRes.data);
    } catch (err: any) {
      setError("Failed to fetch activities and employees data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title || !formData.allottedBudget || !formData.budgetId || !formData.assignedEmployeeId) {
      setError("Please fill in all required fields (Title, Budget, Division Budget, Assigned Employee).");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await apiCall("/api/activities", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      if (res.status === "success") {
        setSuccess("Activity successfully created and assigned!");
        setIsModalOpen(false);
        setFormData({
          title: "",
          description: "",
          dateScheduled: "",
          allottedBudget: "",
          budgetId: "",
          assignedEmployeeId: ""
        });
        fetchData();
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to create activity.");
    } finally {
      setLoading(false);
    }
  }

  const filteredActivities = activities.filter(a => 
    a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.activityNo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEmployeeName = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId || e.id === empId);
    return emp ? emp.fullName : empId;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Employee Activities & Assignments</h1>
          <p className="text-sm text-slate-500 mt-1">Assign official activities to employees for liquidation filing.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center shadow-sm transition-colors"
        >
          <Plus size={16} className="mr-2" />
          Assign New Activity
        </button>
      </div>

      {error && <div className="p-4 bg-rose-50 text-rose-700 text-sm border-l-4 border-rose-500 rounded-r">{error}</div>}
      {success && <div className="p-4 bg-emerald-50 text-emerald-700 text-sm border-l-4 border-emerald-500 rounded-r">{success}</div>}

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{filteredActivities.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Activity No.</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Title & Details</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Assigned Employee</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Date Scheduled</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Allotted Budget</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">Loading records...</td></tr>
              ) : filteredActivities.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">No activities found.</td></tr>
              ) : (
                filteredActivities.map(act => (
                  <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{act.activityNo}</span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-slate-800">{act.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{act.description}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center text-sm text-slate-600">
                        <UserIcon size={14} className="mr-1.5 text-slate-400" />
                        {getEmployeeName(act.assignedEmployeeId)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center text-sm text-slate-600">
                        <Calendar size={14} className="mr-1.5 text-slate-400" />
                        {act.dateScheduled}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-sm font-medium text-slate-700">
                        ₱{Number(act.allottedBudget).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {act.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">Assign New Activity</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded p-1">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Activity Title *</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g. Regional Inspection Travel"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                <textarea 
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  placeholder="Optional details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Scheduled</label>
                  <input 
                    type="date" 
                    min={getLocalTodayString()}
                    value={formData.dateScheduled}
                    onChange={e => setFormData({...formData, dateScheduled: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Allotted Budget (₱) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    value={formData.allottedBudget}
                    onChange={e => setFormData({...formData, allottedBudget: e.target.value})}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Division Budget Allocation *</label>
                <select
                  required
                  value={formData.budgetId}
                  onChange={e => setFormData({...formData, budgetId: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white mb-4"
                >
                  <option value="" disabled>-- Select Division Budget --</option>
                  {budgets.map(bud => (
                    <option key={bud.id} value={bud.id}>{bud.department} (Available: ₱{Number(bud.remainingBudget).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assign To Employee *</label>
                <select
                  required
                  value={formData.assignedEmployeeId}
                  onChange={e => setFormData({...formData, assignedEmployeeId: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="" disabled>-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.employeeId}>{emp.fullName} ({emp.plantillaNumber || emp.employeeId})</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center transition-colors disabled:opacity-70"
                >
                  {loading ? "Saving..." : <><Check size={16} className="mr-1.5" /> Save Assignment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
