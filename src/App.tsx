import React, { useState, useEffect } from "react";
import { User, UserRole, Employee, FinancialTransaction, Asset, SupplyItem, AnyRequest } from "./types";
import { apiCall } from "./utils";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import DashboardView from "./components/DashboardView";
import ActivitiesView from "./components/ActivitiesView";
import FinanceView from "./components/FinanceView";
import AssetsView from "./components/AssetsView";
import RequestsView from "./components/RequestsView";
import AuditView from "./components/AuditView";
import BackupRestoreView from "./components/BackupRestoreView";
import ReportsView from "./components/ReportsView";
import HsacLogo from "./components/HsacLogo";
import UserAccountsView from "./components/UserAccountsView";
import EmployeePortalView from "./components/EmployeePortalView";
import TrainingsSeminarsView from "./components/TrainingsSeminarsView";
import TrainingDevelopmentView from "./components/TrainingDevelopmentView";
import { PersonalDataSheetForm } from "./components/PersonalDataSheetForm";
import { 
  Building, 
  Lock, 
  ShieldCheck, 
  UserCheck, 
  Settings, 
  FolderLock, 
  Sparkles,
  Fingerprint,
  BookOpen,
  X,
  FileText
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [activeFinanceSubTab, setActiveFinanceSubTab] = useState<string>("dashboard");
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Core Global States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [requests, setRequests] = useState<AnyRequest[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Authentication Fields
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // First-time Password Change States
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");

  // Retrieve current session on mount
  useEffect(() => {
    checkSession();
  }, []);

  // Sync data whenever user logged state or manual trigger changes
  useEffect(() => {
    if (user) {
      syncDatabase();
    }
  }, [user, refreshTrigger]);

  function triggerRefresh() {
    setRefreshTrigger(prev => prev + 1);
  }

  function getDefaultTabForRole(role: UserRole): string {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return "dashboard";
      case UserRole.HR_OFFICER:
        return "pds";
      case UserRole.FINANCE_OFFICER:
        return "finance";
      case UserRole.BUDGET_OFFICER:
        return "budget";
      case UserRole.EMPLOYEE:
        return "employee_portal";
      default:
        return "dashboard";
    }
  }

  async function checkSession() {
    try {
      const res = await apiCall("/api/sessions/current");
      if (res.status === "success" && res.data) {
        const loggedUser = res.data;
        setUser(loggedUser);
        setActiveTab(getDefaultTabForRole(loggedUser.role));
        if (loggedUser.requirePasswordChange) {
          setShowPasswordChangeModal(true);
        }
      }
    } catch {
      // Normal: Not logged in
    }
  }

  async function syncDatabase() {
    try {
      const isEmployee = user?.role === UserRole.EMPLOYEE;
      
      const fetchOrNull = async (url: string) => {
        try {
          return await apiCall(url);
        } catch (e) {
          console.warn(`Silently bypassed background fetch for ${url}:`, e);
          return { status: "error", message: "bypass" };
        }
      };

      const [empRes, finRes, astRes, supRes, reqRes] = await Promise.all([
        isEmployee ? fetchOrNull("/api/employees/me") : fetchOrNull("/api/employees"),
        isEmployee ? { status: "success", data: [] } : fetchOrNull("/api/financial-transactions"),
        isEmployee ? { status: "success", data: [] } : fetchOrNull("/api/assets"),
        fetchOrNull("/api/supplies"),
        fetchOrNull("/api/requests")
      ]);

      if (empRes.status === "success" && empRes.data) {
        if (isEmployee) {
          setEmployees([empRes.data]);
        } else {
          setEmployees(empRes.data);
        }
      }
      if (finRes.status === "success") setTransactions(finRes.data || []);
      if (astRes.status === "success") setAssets(astRes.data || []);
      if (supRes.status === "success") setSupplies(supRes.data || []);
      if (reqRes.status === "success") setRequests(reqRes.data || []);

      await fetchSummary();
    } catch (err: any) {
      if (err?.message === "Failed to fetch" || err?.message?.includes("fetch") || err?.toString()?.includes("Failed to fetch")) {
        console.warn("Server sync interrupted momentarily:", err?.message || err);
      } else {
        console.error("Grave: Server sync interrupted. Retrying connection...", err);
      }
    }
  }

  async function fetchSummary() {
    try {
      const res = await apiCall("/api/dashboard/summary");
      if (res.status === "success") {
        setSummary(res.data || []);
      }
    } catch (err: any) {
      if (err?.message === "Failed to fetch" || err?.message?.includes("fetch") || err?.toString()?.includes("Failed to fetch")) {
        console.warn("Central stats momentarily unreachable:", err?.message || err);
      } else {
        console.error("Failed to compile central stats", err);
      }
    }
  }

  // Handle formal credentials authentication
  async function handleFormLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });

      const text = await response.text();
      let res;
      try {
        if (text.trim().toLowerCase().startsWith("<!doctype")) {
           throw new Error("Server returned HTML format (Possible 404 or Server Error)");
        }
        res = text ? JSON.parse(text) : {};
      } catch (parseError) {
        throw new Error("Invalid response from server. Please try again.");
      }

      if (!response.ok) {
        throw new Error(res.message || `API error occurred (Status: ${response.status})`);
      }

      if (res.status === "success" || response.ok) {
        const token = res.token || (res.data && res.data.token);
        if (token) {
          localStorage.setItem("ipfms_token", token);
        }
        const loggedUser = res.data?.user || res.user;
        if (loggedUser) {
          setUser(loggedUser);
          setActiveTab(getDefaultTabForRole(loggedUser.role));
          if (loggedUser.requirePasswordChange) {
            setShowPasswordChangeModal(true);
          }
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Invalid credentials. Please attempt again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await apiCall("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error(err);
    } finally {
      localStorage.removeItem("ipfms_token");
      setUser(null);
      setActiveTab("dashboard");
    }
  }

  // Gated Page views dispatcher
  function renderActiveView() {
    if (!user) return null;

    switch (activeTab) {
      case "dashboard":
        if (user.role !== UserRole.SUPER_ADMIN) {
          return (
            <div className="p-12 text-center space-y-4">
              <p className="text-slate-500 font-medium">Redirecting you to your authorized desk view...</p>
            </div>
          );
        }
        return (
          <DashboardView 
            user={user} 
            summaryData={summary} 
            loading={false}
            setActiveTab={setActiveTab}
          />
        );
      
      case "user-accounts":
        if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.HR_OFFICER) {
          return <div className="p-6 text-slate-500">Unauthenticated credentials path error [RA 10173 Security Block].</div>;
        }
        return <UserAccountsView currentUser={user} />;
      case "finance":
        return <FinanceView 
          user={user}
          transactions={transactions}
          fetchSummary={fetchSummary}
          onRefresh={triggerRefresh}
          activeSubTab={activeFinanceSubTab}
          setActiveSubTab={setActiveFinanceSubTab}
        />;
      case "budget":
        return <FinanceView 
          user={user}
          transactions={transactions}
          fetchSummary={fetchSummary}
          onRefresh={triggerRefresh}
          activeSubTab="budgets"
          setActiveSubTab={setActiveFinanceSubTab}
        />;
      case "trainings_seminars":
        return <TrainingsSeminarsView user={user} employees={employees} />;
      case "training_development":
        return <TrainingDevelopmentView user={user} triggerRefresh={triggerRefresh} />;
      case "assets":
        return <AssetsView 
          user={user}
          assets={assets}
          supplies={supplies}
          employees={employees}
          fetchSummary={fetchSummary}
          onRefresh={triggerRefresh}
        />;
      case "requests":
        return <RequestsView 
          user={user}
          requests={requests}
          fetchSummary={fetchSummary}
          supplies={supplies}
          onRefresh={triggerRefresh}
        />;
      case "activities":
        return <ActivitiesView user={user} onRefresh={triggerRefresh} />;
      case "pds":
        return <PersonalDataSheetForm employees={employees} user={user} />;
      case "employee_portal":
        if (user.role !== UserRole.EMPLOYEE) {
          return <div id="access-denied" className="p-6 text-xs text-rose-500 font-mono font-bold">Unauthenticated credentials path error [RA 10173 Security Block].</div>;
        }
        return (
          <EmployeePortalView fetchSummary={fetchSummary} 
            user={user} 
            onRefresh={triggerRefresh}
          />
        );
      case "backup-restore":
        if (user.role !== UserRole.SUPER_ADMIN) {
          return <div id="access-denied" className="p-6 text-xs text-rose-500 font-mono font-bold">Unauthenticated credentials path error [RA 10173 Security Block].</div>;
        }
        return <BackupRestoreView user={user} />;
      case "audit":
        if (user.role !== UserRole.SUPER_ADMIN) {
          return <div id="access-denied" className="p-6 text-xs text-rose-500 font-mono font-bold">Unauthenticated credentials path error [RA 10173 Security Block].</div>;
        }
        return <AuditView user={user} onRefresh={triggerRefresh} />;
      case "reports":
        return (
          <ReportsView 
            user={user} 
            employees={employees} 
            transactions={transactions} 
            assets={assets} 
            supplies={supplies} 
            requests={requests} 
          />
        );
      default:
        return <div className="p-6 text-slate-500">View formulation index not configured.</div>;
    }
  }

  // Gated Gateway frame
  if (!user) {
    return (
      <div id="login-gateway-container" className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        
        {/* LOGO TITLE SECTION */}
        <div className="text-center mb-6 max-w-lg select-none px-4">
          <div className="mb-4 flex justify-center">
            <HsacLogo size={96} className="bg-white rounded-full p-1.5 border-4 border-blue-600/30 shadow-2xl" />
          </div>
          <h1 className="text-base font-extrabold uppercase tracking-[0.2em] text-blue-400 font-mono">
            IntegraSync
          </h1>
          <p className="text-xl font-extrabold font-sans text-white tracking-tight mt-1.5">
            Integrated Personnel & Financial Management System
          </p>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-mono mt-2 flex items-center justify-center gap-2">
            <span>Regional Adjudication Branch I</span>
            <span className="text-slate-600">•</span>
            <span>San Fernando, La Union</span>
          </p>
        </div>

        {/* SECURE LOGIN CARD */}
        <div className="w-full max-w-md bg-slate-950 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-8 flex flex-col justify-center space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono">
              Sign in
            </h2>

            {authError && (
              <div className="p-3 bg-rose-950/60 border border-rose-900 rounded-xl text-[11px] text-rose-300 leading-relaxed font-semibold font-sans">
                {authError}
              </div>
            )}

            <form onSubmit={handleFormLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Email</label>
                <input
                  required
                  type="email"
                  placeholder="name@hsac.gov.ph"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white p-3 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Password</label>
                <input
                  required
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white p-3 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-xs font-bold uppercase shadow-lg transition-all tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Sign In</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Gated System Workspace layout frame
  return (
    <div id="applet-viewport-frame" className="h-screen w-screen flex overflow-hidden bg-slate-50 text-slate-800 font-sans font-sans">
      
      {!user.requirePasswordChange && !user.requirePdsUpload ? (
        <>
          {/* SIDEBAR NAVIGATION */}
          <Sidebar 
            user={user} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onLogout={handleSignOut}
            onChangePassword={() => setShowPasswordChangeModal(true)}
            activeFinanceSubTab={activeFinanceSubTab}
            setActiveFinanceSubTab={setActiveFinanceSubTab}
          />

          {/* CORE WORKSPACE FRAME */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* HEADER BRAND AND CLOCK */}
            <Header 
              user={user} 
              onOpenHelp={() => setHelpOpen(true)}
            />

            {/* ACTIVE MODULE CONTAINER SCREEN */}
            <main className="flex-1 flex overflow-y-auto">
              {renderActiveView()}
            </main>
          </div>
        </>
      ) : user.requirePasswordChange ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900 text-slate-400">
          <ShieldCheck size={48} className="text-slate-700 mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2 tracking-wide">ACCOUNT SECURITY LOCK</h2>
          <p className="max-w-md text-sm leading-relaxed">
            Administrative protocol requires you to update your temporary credential password before proceeding to the centralized workspace.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
          <Header user={user} onOpenHelp={() => setHelpOpen(true)} />
          <main className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
            <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden p-6 border border-rose-200">
              <div className="bg-rose-50 border-l-4 border-rose-500 p-4 mb-6 rounded-r-lg">
                <div className="flex items-center space-x-3 text-rose-800">
                  <ShieldCheck size={24} />
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wide">PDS Upload Required</h3>
                    <p className="text-xs">Your employment record is incomplete. You must upload your Personal Data Sheet (PDS) to unlock your digital workspace and dashboard access.</p>
                  </div>
                </div>
              </div>
              <PersonalDataSheetForm user={user} employees={[]} onSuccess={checkSession} />
            </div>
          </main>
        </div>
      )}

      {/* SYSTEM DOCUMENTATION MODAL OVERLAY */}
      {helpOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800">
                <BookOpen size={18} className="text-blue-600" />
                <h3 className="font-semibold text-sm tracking-tight">HSAC RAB 1 IPFMS Guide</h3>
              </div>
              <button 
                onClick={() => setHelpOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 font-sans text-xs text-slate-600 leading-relaxed max-h-[70vh] overflow-y-auto">
              <p className="text-slate-500">
                Welcome to the <strong>Integrated Personnel & Financial Management Portal (IntegraSync)</strong> of the Human Settlements Adjudication Commission (HSAC) Regional Adjudication Branch No. 1.
              </p>

              <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 space-y-2">
                <p className="font-semibold text-blue-800 text-[11px] uppercase tracking-wider font-mono">System Guideline Checklist:</p>
                <ul className="space-y-2 list-none pl-0">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✦</span>
                    <span><strong>Employee Personal Data Sheets (PDS):</strong> Manage full personnel rosters, upload authorized documents, and track compliance certifications (Civil Service and TAM compliant).</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✦</span>
                    <span><strong>Financial Tracking & Vouchers:</strong> Log expenditure receipts, submit and audit digital liquidation scopes, and reconcile programs or financial transactions.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✦</span>
                    <span><strong>Treasury Budgets & FAR Compliance:</strong> Monitor budget allotments, track obligational liabilities, and export audit-ready SAAODB / FAR 1, FAR 1A and FAR 3 spreadsheet books.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✦</span>
                    <span><strong>Property & Supply Custody:</strong> Monitor accountability indexes, issue signature receipts (PAR), and track active inventories.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✦</span>
                    <span><strong>Adjudication & Services Desk:</strong> File leaves, request Zoom rooms, dispatch official vehicles, and receive equipment.</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100">
                <span className="flex items-center text-emerald-600 font-semibold uppercase tracking-wider">
                  <ShieldCheck size={12} className="mr-1" />
                  RA 10173 Crypt-Secure
                </span>
                <span>Branch: San Fernando City, La Union</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setHelpOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all"
              >
                Dismiss Guideline
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordChangeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col">
                        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Lock className="text-yellow-400 shrink-0" size={20} />
                <div>
                  <h3 className="font-bold text-sm tracking-wide">{user?.requirePasswordChange ? "FIRST-TIME PASSWORD CHANGE" : "CHANGE PASSWORD"}</h3>
                  <p className="text-[10px] text-slate-300">{user?.requirePasswordChange ? "Administrative security protocol requires a new credential password." : "Update your credential password."}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  if (user?.requirePasswordChange) {
                    handleSignOut();
                  } else {
                    setShowPasswordChangeModal(false);
                    setCurrentPasswordInput("");
                    setNewPasswordInput("");
                    setConfirmPasswordInput("");
                    setPasswordChangeError("");
                  }
                }} 
                className="text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
                title={user?.requirePasswordChange ? "Sign Out" : "Close"}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {passwordChangeError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg font-medium">
                  {passwordChangeError}
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Current Temporary Password</label>
                <input 
                  type="password" 
                  placeholder="Enter the temp password you logged in with" 
                  className="w-full border border-slate-200 p-2 text-xs rounded-lg focus:border-slate-800 outline-none font-mono" 
                  value={currentPasswordInput} 
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                />
              </div>

                            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">New Password</label>
                <input 
                  type="password" 
                  placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char" 
                  className="w-full border border-slate-200 p-2 text-xs rounded-lg focus:border-slate-800 outline-none font-mono" 
                  value={newPasswordInput} 
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Confirm New Password</label>
                <input 
                  type="password" 
                  placeholder="Confirm your new password" 
                  className="w-full border border-slate-200 p-2 text-xs rounded-lg focus:border-slate-800 outline-none font-mono" 
                  value={confirmPasswordInput} 
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                />
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                By updating your password, your digital workspace profile will be synchronized securely under standard encrypt directives.
              </p>
            </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
              {!user?.requirePasswordChange && (
                <button 
                  type="button"
                  onClick={() => {
                    setShowPasswordChangeModal(false);
                    setCurrentPasswordInput("");
                    setNewPasswordInput("");
                    setConfirmPasswordInput("");
                    setPasswordChangeError("");
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all"
                >
                  Cancel
                </button>
              )}
              <button 
                type="button"
                onClick={async () => {
                  setPasswordChangeError("");
                                    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
                    setPasswordChangeError("All password fields are required.");
                    return;
                  }
                  if (newPasswordInput !== confirmPasswordInput) {
                    setPasswordChangeError("New passwords do not match.");
                    return;
                  }
                  const hasUpperCase = /[A-Z]/.test(newPasswordInput);
                  const hasLowerCase = /[a-z]/.test(newPasswordInput);
                  const hasNumbers = /\d/.test(newPasswordInput);
                  const hasSpecial = /[^A-Za-z0-9]/.test(newPasswordInput);
                  if (newPasswordInput.length < 8 || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecial) {
                    setPasswordChangeError("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
                    return;
                  }
                  if (newPasswordInput.length < 6) {
                    setPasswordChangeError("New password must be at least 6 characters.");
                    return;
                  }
                  try {
                    const res = await apiCall("/api/auth/change-password", {
                      method: "POST",
                      body: JSON.stringify({
                        currentPassword: currentPasswordInput,
                        newPassword: newPasswordInput
                      })
                    });
                                        if (res.status === "success") {
                      if (user?.requirePasswordChange) {
                        alert("Password updated successfully! For security purposes, you will now be logged out. Please log in again using your new credentials.");
                      } else {
                        alert("Password updated successfully! You will now be logged out to verify your new credentials.");
                      }
                      setShowPasswordChangeModal(false);
                      setCurrentPasswordInput("");
                      setNewPasswordInput("");
                      setConfirmPasswordInput("");
                      handleSignOut();
                    } else {
                      setPasswordChangeError(res.message || "Failed to update password.");
                    }
                  } catch (err: any) {
                    setPasswordChangeError(err.message || "An unexpected error occurred.");
                  }
                }}
                className="flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all text-center"
              >
                Save and Synchronize
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
