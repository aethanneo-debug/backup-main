import React, { useState, useEffect } from "react";
import { User, AnyRequest, RequestStatus } from "../types";
import { apiCall } from "../utils";
import { Check, X, Undo2, Award, Calendar, RefreshCcw, DollarSign, FileText, UserCheck, HelpCircle } from "lucide-react";

interface ApprovalManagementViewProps {
  user: User;
  onRefresh: () => void;
}

export default function ApprovalManagementView({ user, onRefresh }: ApprovalManagementViewProps) {
  const [activeTab, setActiveTab] = useState<"requests" | "liquidations" | "budgets">("requests");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Data arrays
  const [requests, setRequests] = useState<AnyRequest[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [budgetRequests, setBudgetRequests] = useState<any[]>([]);
  
  // Action details
  const [remarks, setRemarks] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "return" | null>(null);

  useEffect(() => {
    fetchApprovalPayload();
  }, [onRefresh]);

  async function fetchApprovalPayload() {
    setLoading(true);
    setError("");
    try {
      const [reqRes, subRes, budgetRes] = await Promise.all([
        apiCall("/api/requests"),
        apiCall("/api/liquidation-submissions"),
        apiCall("/api/budget-requests")
      ]);

      if (reqRes.status === "success") {
        // Only show requests that are endorsed by HR and need Division Chief's final action
        const endorsed = reqRes.data.filter((r: any) => r.status === "Endorsed to Division Chief" || r.status === RequestStatus.ENDORSED_TO_CHIEF);
        setRequests(endorsed);
      }
      if (subRes.status === "success") {
        // Only show submissions validated by finance and waiting for division chief approval
        const validated = subRes.data.filter((s: any) => s.status === "Validated & Endorsed");
        setSubmissions(validated);
      }
      if (budgetRes.status === "success") {
        // Show pending budget realignments/augmentations
        const pendingBudgets = budgetRes.data.filter((b: any) => b.status === "Pending");
        setBudgetRequests(pendingBudgets);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to retrieve pending approvals payload.");
    } finally {
      setLoading(false);
    }
  }

  async function processPersonnelRequest(requestId: string, decision: "Approved" | "Rejected" | "Returned") {
    setError("");
    setSuccess("");
    try {
      const res = await apiCall(`/api/requests/${requestId}/chief-decide`, {
        method: "PUT",
        body: JSON.stringify({ decision, remarks })
      });
      if (res.status === "success") {
        setSuccess(`Successfully resolved personnel request: ${decision}`);
        setRemarks("");
        setSelectedItem(null);
        setActionType(null);
        fetchApprovalPayload();
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit final decision.");
    }
  }

  async function processLiquidation(submissionId: string, action: "Approve" | "Reject" | "Return") {
    setError("");
    setSuccess("");
    try {
      const res = await apiCall(`/api/liquidation-submissions/${submissionId}/chief-action`, {
        method: "PUT",
        body: JSON.stringify({ action, remarks })
      });
      if (res.status === "success") {
        setSuccess(`Successfully completed final evaluation seal: ${action}`);
        setRemarks("");
        setSelectedItem(null);
        setActionType(null);
        fetchApprovalPayload();
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit final liquidation evaluation.");
    }
  }

  async function processBudgetRequest(brId: string, status: "Approved" | "Returned") {
    setError("");
    setSuccess("");
    try {
      // Approve budget adjustment
      const res = await apiCall(`/api/budget-requests/${brId}/approve`, {
        method: "PUT",
        body: JSON.stringify({ status, remarks })
      });
      if (res.status === "success") {
        setSuccess(`Budget adjustment resolved successfully.`);
        setRemarks("");
        setSelectedItem(null);
        setActionType(null);
        fetchApprovalPayload();
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to decide on budget request.");
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER COCKPIT BRIEF */}
      <div className="p-6 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Approval Management Office</h1>
          <p className="text-xs text-slate-500 mt-1">Central decision console for Human Resource requests, Financial transaction validation, and central Budget re-allocations.</p>
        </div>
        <button
          onClick={fetchApprovalPayload}
          className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-lg border border-slate-200 cursor-pointer transition-all"
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Cockpit</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-xs font-mono rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs font-sans rounded-lg">
          {success}
        </div>
      )}

      {/* CORE ACTION TABS */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-t-xl">
        <button
          id="tab-approvals-req"
          onClick={() => { setActiveTab("requests"); setSelectedItem(null); setActionType(null); }}
          className={`flex-1 py-3 text-xs font-semibold tracking-wide border-b-2 rounded-t-lg transition-all cursor-pointer ${
            activeTab === "requests"
              ? "border-blue-600 text-blue-600 font-bold bg-blue-50/20"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          HR-Endorsed Requests ({requests.length})
        </button>
        <button
          id="tab-approvals-liq"
          onClick={() => { setActiveTab("liquidations"); setSelectedItem(null); setActionType(null); }}
          className={`flex-1 py-3 text-xs font-semibold tracking-wide border-b-2 rounded-t-lg transition-all cursor-pointer ${
            activeTab === "liquidations"
              ? "border-blue-600 text-blue-600 font-bold bg-blue-50/20"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Finance-Validated Liquidations ({submissions.length})
        </button>
        <button
          id="tab-approvals-bud"
          onClick={() => { setActiveTab("budgets"); setSelectedItem(null); setActionType(null); }}
          className={`flex-1 py-3 text-xs font-semibold tracking-wide border-b-2 rounded-t-lg transition-all cursor-pointer ${
            activeTab === "budgets"
              ? "border-blue-600 text-blue-600 font-bold bg-blue-50/20"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Budget Requests / Realignments ({budgetRequests.length})
        </button>
      </div>

      <div className="bg-white rounded-b-xl border border-slate-100 shadow-sm p-6">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-sans">
            Retrieving files and verifying pending vouchers...
          </div>
        ) : (
          <div>
            {/* REQUESTS LIST PANELS */}
            {activeTab === "requests" && (
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    No HR-endorsed personnel requests currently awaiting Division Chief approval.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {requests.map((req: any) => (
                      <div key={req.id} className="p-5 border border-slate-200 rounded-xl hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 bg-slate-50/30">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono bg-blue-100 text-blue-700 font-bold px-2.5 py-0.5 rounded-full uppercase">
                              {req.requestType}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">{req.dateRequested}</span>
                          </div>
                          <h2 className="text-xs font-bold text-slate-800 mt-2.5">{req.employeeName}</h2>
                          
                          {/* DETAILS DEPENDING ON REQUEST TYPE */}
                          <div className="mt-3 text-slate-600 text-xs font-sans space-y-1 bg-white p-3 rounded-lg border border-slate-100">
                            {req.leaveType && <p><strong className="text-slate-500">Leave details:</strong> {req.leaveType}</p>}
                            {req.startDate && <p><strong className="text-slate-500">Period:</strong> {req.startDate} to {req.endDate}</p>}
                            {req.meetingTitle && <p><strong className="text-slate-500">Zoom Call:</strong> {req.meetingTitle}</p>}
                            {req.destination && <p><strong className="text-slate-500">Destination:</strong> {req.destination}</p>}
                            {req.supplyName && <p><strong className="text-slate-500">Supply Item:</strong> {req.supplyName} (Qty: {req.quantity})</p>}
                            <p className="italic text-slate-500 mt-2">"{req.reason || req.purpose || 'No description supplied'}"</p>
                          </div>

                          {/* HR REVISION METRICS EMBED */}
                          <div className="mt-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-[11px] text-slate-600">
                            <strong className="text-blue-700 font-mono">HR ENDORSEMENT REMARKS:</strong>
                            <p className="mt-0.5">"{req.remarks || 'Endorsed under general compliance'}"</p>
                          </div>
                        </div>

                        {/* DECISIONS ZONE */}
                        <div className="border-t border-slate-100 pt-3.5 flex items-center justify-end space-x-2">
                          <button
                            onClick={() => { setSelectedItem(req); setActionType("return"); }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 rounded text-amber-700 text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                          >
                            <Undo2 size={12} />
                            <span>Return to Employee</span>
                          </button>
                          <button
                            onClick={() => { setSelectedItem(req); setActionType("reject"); }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 rounded text-rose-700 text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                            <span>Reject</span>
                          </button>
                          <button
                            onClick={() => { setSelectedItem(req); setActionType("approve"); }}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer shadow-sm"
                          >
                            <Check size={12} />
                            <span>Approve Request</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LIQUIDATIONS VIEW */}
            {activeTab === "liquidations" && (
              <div className="space-y-4">
                {submissions.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    No Finance-validated liquidation reports waiting for final approval.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submissions.map((sub: any) => (
                      <div key={sub.id} className="p-5 border border-slate-200 rounded-xl hover:border-slate-300 transition-all bg-slate-50/30 flex flex-col md:flex-row justify-between gap-6">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center space-x-3">
                            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                              {sub.submissionNo}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{sub.createdAt.split("T")[0]}</span>
                          </div>
                          
                          <div>
                            <h2 className="text-xs font-bold text-slate-800">{sub.employeeName}</h2>
                            <p className="text-[11px] text-slate-500 mt-0.5 font-sans">Verification of employee-activity expenditures relationship complete.</p>
                          </div>

                          <div className="grid grid-cols-3 gap-4 max-w-lg">
                            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                              <p className="text-[9px] text-slate-400 font-bold uppercase font-mono">Released Advanced</p>
                              <p className="text-xs font-bold text-slate-800 mt-1">₱{sub.totalReleased.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                              <p className="text-[9px] text-slate-400 font-bold uppercase font-mono">Liquidated Spent</p>
                              <p className="text-xs font-bold text-blue-600 mt-1">₱{sub.totalSpent.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                              <p className="text-[9px] text-slate-400 font-bold uppercase font-mono">Closing Balance</p>
                              <p className="text-xs font-bold mt-1 text-slate-700">₱{sub.remainingBalance.toLocaleString()}</p>
                            </div>
                          </div>

                          {sub.remarks && (
                            <div className="bg-white p-3 rounded-lg border border-slate-100 text-xs text-slate-600 font-sans italic max-w-lg">
                              "{sub.remarks}"
                            </div>
                          )}

                          {/* HR & FINANCE REMARKS SUMMARY */}
                          <div className="grid grid-cols-2 gap-4 max-w-lg text-[10px]">
                            <div className="bg-blue-50/30 p-2.5 rounded border border-blue-105">
                              <strong className="text-blue-700">HR ENDORSEMENT:</strong>
                              <p className="text-slate-600 mt-1">"{sub.hrRemarks || 'Verified activity'}"</p>
                            </div>
                            <div className="bg-emerald-50/30 p-2.5 rounded border border-emerald-105">
                              <strong className="text-emerald-700">FINANCE VALIDATION:</strong>
                              <p className="text-slate-600 mt-1">"{sub.financeRemarks || 'Verified vouchers'}"</p>
                            </div>
                          </div>
                        </div>

                        {/* SUBMISSION ATTACHMENTS */}
                        <div className="w-full md:w-56 shrink-0 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                          <div>
                            <p className="text-[9px] font-bold uppercase text-slate-400 font-mono tracking-wider mb-2">Attached Vouchers</p>
                            {sub.supportingDocs && sub.supportingDocs.length > 0 ? (
                              <div className="space-y-1.5">
                                {sub.supportingDocs.map((doc: any, idx: number) => (
                                  <div key={idx} className="flex items-center space-x-1.5 p-1.5 bg-white border border-slate-100 rounded text-[10px] text-slate-600">
                                    <FileText size={11} className="text-slate-400 shrinkage-0" />
                                    <span className="truncate">{doc.name}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">No receipt folders attached.</p>
                            )}
                          </div>

                          <div className="mt-4 flex items-center gap-2">
                            <button
                              onClick={() => { setSelectedItem(sub); setActionType("return"); }}
                              className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-semibold text-center transition-colors cursor-pointer"
                            >
                              Return
                            </button>
                            <button
                              onClick={() => { setSelectedItem(sub); setActionType("approve"); }}
                              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold text-center transition-colors cursor-pointer shadow-sm"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* BUDGET REQUESTS VIEW */}
            {activeTab === "budgets" && (
              <div className="space-y-4">
                {budgetRequests.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    No budget augmentations/realignments waiting for Division Chief concurrence.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {budgetRequests.map((br: any) => (
                      <div key={br.id} className="p-5 border border-slate-200 rounded-xl hover:border-slate-300 transition-all bg-slate-50/30 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded">
                              {br.requestType} request
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">{br.createdAt?.split("T")[0]}</span>
                          </div>

                          <h2 className="text-xs font-bold text-slate-800 mt-2.5">Allotted: {br.department}</h2>
                          <div className="mt-2 text-xs font-sans space-y-2 bg-white p-3 rounded-lg border border-slate-150">
                            <div className="flex items-center justify-between text-slate-800">
                              <span>Amount requested:</span>
                              <strong className="text-blue-600">₱{br.amountRequested.toLocaleString()}</strong>
                            </div>
                            <p className="text-slate-500 italic mt-1 font-sans">"{br.purpose}"</p>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3 flex items-center justify-end space-x-2">
                          <button
                            onClick={() => { setSelectedItem(br); setActionType("return"); }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Return
                          </button>
                          <button
                            onClick={() => { setSelectedItem(br); setActionType("approve"); }}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-sm transition-all"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* VERIFICATION REMARKS ACTION POPUP DIALOG */}
      {selectedItem && actionType && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h2 className="text-xs font-bold text-slate-800 capitalize">
                Confirm: {actionType} approval item {selectedItem.submissionNo || selectedItem.requestType || selectedItem.id}
              </h2>
              <button onClick={() => { setSelectedItem(null); setActionType(null); }} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-4 font-sans">
              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p><strong>Applying action:</strong> <span className="capitalize text-blue-600 font-semibold">{actionType}</span></p>
                <p><strong>Recipient profile:</strong> {selectedItem.employeeName || selectedItem.department}</p>
                {selectedItem.totalSpent && <p><strong>Closing amount:</strong> ₱{selectedItem.totalSpent.toLocaleString()}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Remarks & Resolution Comments</label>
                <textarea
                  required={actionType === "return" || actionType === "reject"}
                  placeholder={
                    actionType === "return" 
                      ? "Describe requested document or detail corrections required..." 
                      : "Add final audit ledger notes regarding this approval decision..."
                  }
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 font-sans"
                />
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => { setSelectedItem(null); setActionType(null); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (activeTab === "requests") {
                      const dec = actionType === "approve" ? "Approved" : actionType === "return" ? "Returned" : "Rejected";
                      processPersonnelRequest(selectedItem.id, dec);
                    } else if (activeTab === "liquidations") {
                      const act = actionType === "approve" ? "Approve" : actionType === "return" ? "Return" : "Reject";
                      processLiquidation(selectedItem.id, act);
                    } else if (activeTab === "budgets") {
                      const status = actionType === "approve" ? "Approved" : "Returned";
                      processBudgetRequest(selectedItem.id, status);
                    }
                  }}
                  className={`px-4 py-2 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-sm ${
                    actionType === "approve" ? "bg-blue-600 hover:bg-blue-700" : actionType === "return" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  Execute final action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
