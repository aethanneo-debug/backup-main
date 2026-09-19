import React, { useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { 
  Database, 
  Download, 
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X
} from "lucide-react";
import { apiCall, formatDate } from "../utils";

interface Backup {
  id: string;
  filename: string;
  date: string;
  size: string;
  status: string;
}

interface BackupRestoreViewProps {
  user: User;
}

export default function BackupRestoreView({ user }: BackupRestoreViewProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  async function loadBackups() {
    setLoading(true);
    setError("");
    try {
      const res = await apiCall("/api/backups");
      if (res.status === "success") {
        setBackups(res.data || []);
      } else {
        setError(res.message || "Failed to load backups");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBackup() {
    setIsCreating(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiCall("/api/backups", { method: "POST" });
      if (res.status === "success") {
        setSuccess("System database backup successfully created.");
        loadBackups();
      } else {
        setError(res.message || "Failed to create backup.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create backup.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRestoreBackup(id: string) {
    setIsRestoring(id);
    setError("");
    setSuccess("");
    setConfirmRestore(null);
    try {
      const res = await apiCall(`/api/backups/${id}/restore`, { method: "POST" });
      if (res.status === "success") {
        setSuccess("Database successfully restored from backup.");
      } else {
        setError(res.message || "Failed to restore backup.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to restore backup.");
    } finally {
      setIsRestoring(null);
    }
  }


  async function handleDownloadBackup(id: string, filename: string) {
    try {
      const token = localStorage.getItem("ipfms_token");
      const res = await fetch(`/api/backups/${id}/download`, {
        headers: {
          "Authorization": token || ""
        }
      });
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess("Backup archive downloaded successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to download backup file.");
    }
  }

  async function handleDeleteBackup(id: string) {
    setError("");
    setSuccess("");
    setConfirmDelete(null);
    try {
      const res = await apiCall(`/api/backups/${id}`, { method: "DELETE" });
      if (res.status === "success") {
        setSuccess("Backup archive successfully deleted.");
        loadBackups();
      } else {
        setError(res.message || "Failed to delete backup.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete backup.");
    }
  }

  if (user.role !== UserRole.SUPER_ADMIN) {
    return <div id="access-denied" className="p-6 text-xs text-rose-500 font-mono font-bold">Unauthenticated credentials path error [RA 10173 Security Block].</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 w-full">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold font-sans text-slate-800 tracking-tight flex items-center gap-2">
            <Database className="text-blue-600" size={24} />
            Backup & Restore
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">Manage system database snapshots, create archives, and restore historical states.</p>
        </div>
        
        <button
          onClick={handleCreateBackup}
          disabled={isCreating}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-70"
        >
          {isCreating ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
          <span>{isCreating ? "Generating Archive..." : "Create Backup"}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs font-sans rounded-r-lg shadow-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-700"><X size={14}/></button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-sans rounded-r-lg shadow-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-emerald-500 hover:text-emerald-700"><X size={14}/></button>
        </div>
      )}

      {/* BACKUP LIST */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 font-sans">Available Backup Archives</h3>
          <button onClick={loadBackups} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100">
                <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">Filename</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">Date Created</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">File Size</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono">Status</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-xs text-slate-400 font-sans">
                    <RefreshCw className="animate-spin mx-auto mb-2 text-slate-300" size={24} />
                    <p>Retrieving backup archives...</p>
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-xs text-slate-400 font-sans">
                    <Database size={32} className="text-slate-300 mx-auto mb-3" />
                    <p>No backup archives available.</p>
                  </td>
                </tr>
              ) : (
                backups.map(backup => (
                  <tr key={backup.id} className="hover:bg-slate-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Database size={14} className="text-slate-400" />
                        <span className="text-xs font-mono font-medium text-slate-700">{backup.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-slate-500">
                        <Clock size={12} />
                        <span className="text-xs">{formatDate(backup.date)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                      {backup.size}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                        <CheckCircle2 size={10} />
                        <span>{backup.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleDownloadBackup(backup.id, backup.filename)}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </button>
                        <button
                          onClick={() => setConfirmRestore(backup.id)}
                          disabled={isRestoring === backup.id}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {isRestoring === backup.id ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(backup.id)}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRM DELETE MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-2">
                <AlertTriangle size={24} className="text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Delete Backup Archive</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to permanently delete this backup archive? This action cannot be undone.
              </p>
              <div className="pt-4 flex items-center space-x-3 w-full">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteBackup(confirmDelete)}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  Delete Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* CONFIRM RESTORE MODAL */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <RefreshCw size={24} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Restore System Database</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to restore the system from this backup? Current data since the backup date will be overwritten.
              </p>
              <div className="pt-4 flex items-center space-x-3 w-full">
                <button
                  onClick={() => setConfirmRestore(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRestoreBackup(confirmRestore)}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  Proceed with Restore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
