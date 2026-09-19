import React, { useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { apiCall } from "../utils";
import { Plus, Edit2, Archive, Key, ShieldCheck, Mail, UserCheck, Search, X, CheckCircle } from "lucide-react";

interface UserAccountsViewProps {
  currentUser: User;
}

export default function UserAccountsView({ currentUser }: UserAccountsViewProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<{username: string, email: string, tempPassword: string} | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [accountStatus, setAccountStatus] = useState<"Active" | "Archived">("Active");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [position, setPosition] = useState("");
  const [division, setDivision] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("Regular");
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const res = await apiCall("/api/employees");
      if (res.status === "success") {
        setEmployees(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await apiCall("/api/admin/users");
      if (res.status === "success") {
        setUsers(res.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch user accounts directory.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingUser(null);
    setUsername("");
    setEmail("");
    setFullName("");
    setEmployeeId("");
    setSelectedRole(UserRole.EMPLOYEE);
    setAccountStatus("Active");
    setPosition("");
    setDivision("Adjudication Division");
    setEmploymentStatus("Regular");
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(usr: User) {
    setEditingUser(usr);
    setUsername(usr.username);
    setEmail(usr.email);
    setFullName(usr.fullName);
    setEmployeeId(usr.employeeId || "");
    setPosition("");
    setDivision("");
    setEmploymentStatus("");
    setSelectedRole(usr.role);
    setAccountStatus(usr.status || "Active");
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !email || !fullName || (!editingUser && (!employeeId || !position || !division))) {
      setError("Please fill out all mandatory credentials fields (including Plantilla ID, Position, and Division for new accounts).");
      return;
    }

    try {
      if (editingUser) {
        // Edit User
        const res = await apiCall(`/api/admin/users/${editingUser.id}`, {
          method: "PUT",
          body: JSON.stringify({ username, email, fullName, role: selectedRole, status: accountStatus, employeeId })
        });
        if (res.status === "success") {
          setSuccess("User account details calibrated successfully.");
          fetchUsers();
          setTimeout(() => setModalOpen(false), 800);
        }
      } else {
        // Create User
        const res = await apiCall("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ username, email, fullName, role: selectedRole, status: accountStatus, employeeId, position, division, employmentStatus })
        });
        if (res.status === "success") {
          setSuccess("Brand new user account successfully registered. Email dispatched.");
          fetchUsers();
          setTempPasswordModal({ username: res.data?.username || username, email: res.data?.email || email, tempPassword: res.tempPassword });
          setTimeout(() => setModalOpen(false), 800);
        }
      }
    } catch (err: any) {
      setError(err.message || "An exception occurred while persisting security settings.");
    }
  }

  async function handleResetPassword(id: string, username: string) {
    setError("");
    try {
      setLoading(true);
      const res = await apiCall(`/api/admin/users/${id}/reset-password`, { method: "POST" });
      if (res.status === "success") {
        setSuccess(`Password for ${username} successfully reset to temporary default.`);
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  
  async function handleRestoreUser(id: string) {
    setError("");
    try {
      const res = await apiCall(`/api/admin/users/${id}/restore`, { 
        method: "POST"
      });
      if (res.status === "success") {
        setSuccess("User account successfully restored.");
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message || "Could not restore user account.");
    }
  }

  
  const filteredUsers = users.filter(u => 
    (viewMode === "archived" ? u.status === "Archived" : (u.status || "Active") !== "Archived") &&
    (
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 w-full">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold font-sans text-slate-800 tracking-tight">User Account & Credentials Deck</h1>
          <p className="text-xs text-slate-500 font-sans mt-0.5">Define access categories, audit clearances, and provision active user logons.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={async () => {
              const testEmail = prompt("Enter an email address to send a test email to (e.g. your Gmail):");
              if (!testEmail) return;
              try {
                const res = await apiCall("/api/admin/test-email", {
                  method: "POST",
                  body: JSON.stringify({ targetEmail: testEmail })
                });
                if (res.status === "success") {
                  alert(res.message);
                } else {
                  alert("Error: " + res.message);
                }
              } catch (err: any) {
                alert("Failed to send test email: " + err.message);
              }
            }}
            className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer"
          >
            <Mail size={16} />
            <span>Test Email Dispatcher</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Create New User Account</span>
          </button>
        </div>
      </div>


      {/* TABS */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setViewMode("active")}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === "active" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Active Accounts
        </button>
        <button
          onClick={() => setViewMode("archived")}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === "archived" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Archived Accounts
        </button>
      </div>

      {/* SEARCH AND CONTENT */}
      {search || filteredUsers.length > 0 || viewMode === "archived" ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {/* SEARCH BAR */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center space-x-3">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search user profile credentials, roles, usernames..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-0 outline-none text-xs text-slate-700 placeholder-slate-400 w-full"
            />
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">Profile and Name</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">System Username</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">Email Address</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">Access Level Role</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">Plantilla ID</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">Status</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-xs text-slate-400 font-sans">
                      Loading local user credential ledger directories...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-xs text-slate-400 font-sans">
                      No matching registered accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(usr => (
                    <tr key={usr.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs text-uppercase border border-slate-200">
                            {usr.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{usr.fullName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {usr.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                          {usr.username}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-sans text-slate-600">
                        <div className="flex items-center space-x-1.5">
                          <Mail size={12} className="text-slate-400" />
                          <span>{usr.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold font-mono tracking-wider ${
                          usr.role === UserRole.SUPER_ADMIN 
                            ? "bg-purple-50 text-purple-600 border border-purple-100"
                            : usr.role === UserRole.HR_OFFICER
                            ? "bg-blue-50 text-blue-600 border border-blue-100"
                            : usr.role === UserRole.FINANCE_OFFICER
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : usr.role === UserRole.BUDGET_OFFICER
                            ? "bg-amber-50 text-amber-600 border border-amber-100"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {usr.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {usr.employeeId || usr.plantillaNumber || "None Assigned"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold font-mono tracking-wider border ${usr.status === "Archived" ? "bg-slate-100 text-slate-600 border-slate-300" : (usr.status || "Active") === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                          {usr.status || "Active"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                                                                        <div className="flex justify-end items-center space-x-2">
                          {usr.status === "Archived" ? (
                            <button
                              type="button"
                              onClick={() => handleRestoreUser(usr.id)}
                              className="p-1 px-2.5 py-1.5 hover:bg-emerald-50 rounded text-emerald-600 hover:text-emerald-700 text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                            >
                              <UserCheck size={12} />
                              <span>Restore</span>
                            </button>
                          ) : (
                            <>
                              {usr.username !== "admin" && usr.id !== currentUser.id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      setLoading(true);
                                      const res = await apiCall(`/api/admin/users/${usr.id}`, {
                                        method: "PUT",
                                        body: JSON.stringify({ status: "Archived" })
                                      });
                                      if (res.status === "success") {
                                        setSuccess("Account archived successfully.");
                                        fetchUsers();
                                      }
                                    } catch (err: any) {
                                      setError(err.message || "Failed to alter status.");
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  className="p-1 px-2.5 py-1.5 rounded text-xs flex items-center space-x-1 cursor-pointer transition-colors hover:bg-rose-50 text-rose-600 hover:text-rose-700"
                                >
                                  <Archive size={12} />
                                  <span>Archive</span>
                                </button>
                              )}
                              {usr.username !== "admin" && (
                                <button
                                  type="button"
                                  onClick={() => handleResetPassword(usr.id, usr.username)}
                                  className="p-1 px-2.5 py-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                                  title="Reset Password"
                                >
                                  <Key size={12} />
                                  <span>Reset Pass</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditModal(usr)}
                                className="p-1 px-2.5 py-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                              >
                                <Edit2 size={12} />
                                <span>Edit</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
          <Key size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Retrieving security parameters...</p>
        </div>
      )}

      {/* ACCOUNT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">
                {editingUser ? "Edit User Account" : "Create New User Account"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border-l-2 border-rose-500 text-rose-700 text-xs">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-50 border-l-2 border-emerald-500 text-emerald-700 text-xs">
                  {success}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Clara Santos"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. clara"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. clara@hsac.gov.ph"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {!editingUser && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Plantilla ID</label>
                    <input type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required placeholder="EMP-001" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Division / Department</label>
                    <select value={division} onChange={e => setDivision(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required>
                      <option value="Adjudication Division">Adjudication Division</option>
                      <option value="Legal Division">Legal Division</option>
                      <option value="Administrative and Finance Division">Administrative and Finance Division</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Position / Role</label>
                    <input type="text" value={position} onChange={e => setPosition(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required placeholder="e.g. Attorney III" />
                  </div>
                </>
              )}

              {editingUser && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Plantilla ID (Locked)</label>
                  <input type="text" value={employeeId} disabled className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed" />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">System Role</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value={UserRole.SUPER_ADMIN}>Administrator / Division Chief</option>
                  <option value={UserRole.HR_OFFICER}>HR Officer</option>
                  <option value={UserRole.FINANCE_OFFICER}>Financial Officer</option>
                  <option value={UserRole.BUDGET_OFFICER}>Budget Officer</option>
                  <option value={UserRole.EMPLOYEE}>Employee / Personnel</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Account Status</label>
                <select
                  value={accountStatus}
                  onChange={e => setAccountStatus(e.target.value as "Active" | "Archived")}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {editingUser ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-800">
                <p>The system successfully generated a secure temporary password and emailed it to the user's registered inbox. For strict security compliance, the password is not displayed here.</p>
              </div>
              <div className="space-y-2 text-sm text-slate-700 bg-slate-50 p-4 border border-slate-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Recipient Email:</span>
                  <span>{tempPasswordModal.email}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="font-semibold">Delivery Status:</span>
                  <span className="font-mono bg-emerald-100 px-2 py-0.5 border border-emerald-200 rounded text-emerald-700 font-bold">Sent via SMTP</span>
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
}