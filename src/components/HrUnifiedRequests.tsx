import React, { useState, useEffect } from "react";
import { User, RequestStatus } from "../types";
import { apiCall } from "../utils";
import { Check, Undo2, RefreshCcw, X, Info } from "lucide-react";

interface HrUnifiedRequestsProps {
  user: User;
  onRefresh: () => void;
}

export default function HrUnifiedRequests({ user, onRefresh }: HrUnifiedRequestsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");

  const [remarks, setRemarks] = useState("");
  const [bulkActionType, setBulkActionType] = useState<"verify" | "return" | null>(null);
  const [viewItem, setViewItem] = useState<any | null>(null);
  const [modalActionType, setModalActionType] = useState<"verify" | "return" | null>(null);
  const [modalRemarks, setModalRemarks] = useState("");

  useEffect(() => {
    fetchData();
  }, [onRefresh]);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const [reqRes, subRes] = await Promise.all([
        apiCall("/api/requests"),
        apiCall("/api/liquidation-submissions")
      ]);

      const combined: any[] = [];

      let seq = 0;

      if (reqRes.status === "success") {
        reqRes.data
          .forEach((r: any) => {
            combined.push({
              ...r,
              _unifiedId: `req-${r.id}`,
              _category: "Personnel Request",
              _date: new Date(r.dateRequested || r.createdAt).getTime(),
              _displayDate: r.dateRequested || r.createdAt,
              _title: r.leaveType ? `${r.requestType} (${r.leaveType})` : r.requestType,
              _requester: r.employeeName,
              _amount: null,
              _sequence: seq++
            });
          });
      }

      if (subRes.status === "success") {
        subRes.data
          .forEach((s: any) => {
            combined.push({
              ...s,
              _unifiedId: `liq-${s.id}`,
              _category: "Liquidation",
              _date: new Date(s.createdAt).getTime(),
              _displayDate: s.createdAt,
              _title: `Liquidation ${s.submissionNo}`,
              _requester: s.employeeName,
              _amount: s.totalReleased, // totalReleased or totalSpent depending on HR view
              _sequence: seq++
            });
          });
      }

      // Sort LIFO (Newest First)
      combined.sort((a, b) => {
        if (b._date !== a._date) return b._date - a._date;
        return b._sequence - a._sequence;
      });
      setAllItems(combined);
      setSelectedIds([]);
    } catch (err: any) {
      setError("Failed to retrieve pending HR verifications payload.");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = allItems.filter(item => {
    let catMatch = true;
    if (filterCategory !== "All") {
      if (["Personnel Request", "Liquidation"].includes(filterCategory)) {
        catMatch = item._category === filterCategory;
      } else {
        catMatch = item.requestType === filterCategory || item.leaveType === filterCategory;
      }
    }
    
    let statMatch = true;
    if (filterStatus !== "All") {
      statMatch = item.status && item.status.includes(filterStatus);
    }
    
    return catMatch && statMatch;
  });

  const isActionable = (status: string) => {
    if (!status) return false;
    return status === "Pending" || status === "Pending HR Review";
  };

  const actionableItems = filteredItems.filter(item => isActionable(item.status));

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === actionableItems.length && actionableItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(actionableItems.map(item => item._unifiedId));
    }
  };

  async function handleBulkAction(action: "verify" | "return") {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setError("");
    setSuccess("");

    let successCount = 0;
    let failCount = 0;

    for (const uid of selectedIds) {
      const item = allItems.find(i => i._unifiedId === uid);
      if (!item) continue;

      try {
        if (item._category === "Personnel Request") {
          const endorse = action === "verify"; // verify means Endorse for Personnel Request
          await apiCall(`/api/requests/${item.id}/hr-endorse`, {
            method: "PUT",
            body: JSON.stringify({ endorse, remarks: remarks || `Bulk HR ${endorse ? 'Endorsement' : 'Return'}` })
          });
        } else if (item._category === "Liquidation") {
          const decision = action === "verify" ? "Verify" : "Return";
          await apiCall(`/api/liquidation-submissions/${item.id}/hr-action`, {
            method: "PUT",
            body: JSON.stringify({ action: decision, remarks: remarks || `Bulk HR ${decision}` })
          });
        }
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    setSuccess(`Processed successfully: ${successCount}. Failed: ${failCount}.`);
    setBulkActionType(null);
    setRemarks("");
    fetchData();
    onRefresh();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50 gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">HR Unified Verification & Approvals</h2>
          <p className="text-[10px] text-slate-500">Manage all pending personnel requests and liquidations for HR Verification.</p>
        </div>
        <div className="flex items-center space-x-3">
          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Categories</option>
            <option value="Personnel Request">All Personnel Requests</option>
            <option value="Sick Leave">-- Sick Leave</option>
            <option value="Vacation Leave">-- Vacation Leave</option>
            <option value="Special Privilege">-- Special Privilege</option>
            <option value="Vehicle Request">-- Vehicle Requests</option>
            <option value="Zoom Access Request">-- Zoom Access</option>
            <option value="Supply Request">-- Supply Requests</option>
            <option value="Liquidation">Liquidations</option>
          </select>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Endorsed">Endorsed</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button onClick={fetchData} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-600 transition-colors cursor-pointer" title="Refresh">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 text-rose-700 text-xs border-b border-rose-100">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 text-emerald-700 text-xs border-b border-emerald-100">{success}</div>}

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-800">{selectedIds.length} items selected</span>
          <div className="flex items-center space-x-2">
            <button onClick={() => setBulkActionType("return")} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold flex items-center cursor-pointer shadow-sm">
              <Undo2 size={12} className="mr-1" /> Reject
            </button>
            <button onClick={() => setBulkActionType("verify")} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center cursor-pointer shadow-sm">
              <Check size={12} className="mr-1" /> {viewItem?._category === "Liquidation" ? "Endorse to Finance" : "Endorse to Chief"}
            </button>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Request Details</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{viewItem._category} &bull; {viewItem._displayDate}</p>
              </div>
              <button onClick={() => setViewItem(null)} className="text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded p-1">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Requester</p>
                  <p className="font-medium text-slate-700">{viewItem._requester}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Status</p>
                  <p className="font-medium text-slate-700">{viewItem.status}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Title / Type</p>
                <p className="text-slate-700">{viewItem._title}</p>
              </div>
              
              {viewItem.purpose && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Purpose</p>
                  <p className="text-slate-600 bg-slate-50 p-2 border border-slate-100 rounded text-xs">{viewItem.purpose}</p>
                </div>
              )}
              {viewItem.reason && !viewItem.purpose && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Reason</p>
                  <p className="text-slate-600 bg-slate-50 p-2 border border-slate-100 rounded text-xs">{viewItem.reason}</p>
                </div>
              )}
              
              {viewItem.destination && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Destination</p>
                  <p className="text-slate-700">{viewItem.destination}</p>
                </div>
              )}
              {viewItem.passengers && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Passengers</p>
                  <p className="text-slate-700">{viewItem.passengers}</p>
                </div>
              )}
              {viewItem.dateNeeded && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Date Needed</p>
                  <p className="text-slate-700">{viewItem.dateNeeded}</p>
                </div>
              )}
              {viewItem.meetingDate && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Meeting Date</p>
                  <p className="text-slate-700">{viewItem.meetingDate}</p>
                </div>
              )}
              {viewItem.meetingTitle && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Meeting Title</p>
                  <p className="text-slate-700">{viewItem.meetingTitle}</p>
                </div>
              )}
              {viewItem.quantity && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Quantity</p>
                  <p className="text-slate-700">{viewItem.quantity}</p>
                </div>
              )}

              {isActionable(viewItem.status) && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setModalActionType("return")} 
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${modalActionType === "return" ? "bg-amber-600 text-white border-amber-700 ring-2 ring-amber-600/20 shadow-inner" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"}`}
                    >
                      Reject / Return
                    </button>
                    <button 
                      onClick={() => setModalActionType("verify")} 
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${modalActionType === "verify" ? "bg-blue-600 text-white border-blue-700 ring-2 ring-blue-600/20 shadow-inner" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"}`}
                    >
                      Endorse (Chief/Finance)
                    </button>
                  </div>
                  {modalActionType && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Remarks</label>
                      <input 
                        type="text" 
                        value={modalRemarks}
                        onChange={e => setModalRemarks(e.target.value)}
                        placeholder="Optional remarks..."
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            if (viewItem._category === "Personnel Request") {
                              const endorse = modalActionType === "verify";
                              await apiCall(`/api/requests/${viewItem.id}/hr-endorse`, {
                                method: "PUT",
                                body: JSON.stringify({ endorse, remarks: modalRemarks || `HR ${endorse ? 'Endorsement' : 'Return'}` })
                              });
                            } else if (viewItem._category === "Liquidation") {
                              const decision = modalActionType === "verify" ? "Verify" : "Return";
                              await apiCall(`/api/liquidation-submissions/${viewItem.id}/hr-action`, {
                                method: "PUT",
                                body: JSON.stringify({ action: decision, remarks: modalRemarks || `HR ${decision}` })
                              });
                            }
                            setSuccess("Action applied successfully.");
                            setViewItem(null);
                            setModalActionType(null);
                            setModalRemarks("");
                            fetchData();
                            onRefresh();
                          } catch (err) {
                            setError("Action failed.");
                            setLoading(false);
                          }
                        }}
                        className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm hover:bg-slate-800"
                      >
                        Confirm {modalActionType === "verify" ? "Endorsement" : "Return"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/50 border-b border-slate-200">
              <th className="p-3 w-10 text-center">
                <input 
                  type="checkbox" 
                  checked={selectedIds.length === actionableItems.length && actionableItems.length > 0} 
                  onChange={toggleSelectAll}
                  disabled={actionableItems.length === 0}
                  className="cursor-pointer"
                />
              </th>
              <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date (LIFO)</th>
              <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
              <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Title / Details</th>
              <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requester</th>
              <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-xs text-slate-400">Loading records...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-xs text-slate-400">No records found matching criteria.</td></tr>
            ) : (
              filteredItems.map(item => (
                <tr key={item._unifiedId} onClick={() => { setViewItem(item); setModalActionType(null); setModalRemarks(""); }} className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.includes(item._unifiedId) ? "bg-blue-50/30" : ""}`}>
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                    {isActionable(item.status) && (
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item._unifiedId)} 
                        onChange={() => toggleSelect(item._unifiedId)}
                        className="cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap">{item._displayDate ? item._displayDate.split("T")[0] : "-"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      item._category === "Personnel Request" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      item._category === "Liquidation" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>
                      {item._category}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-slate-800 font-medium">
                    {item._title}
                    {(item.purpose || item.reason || item.meetingTitle) && <p className="text-[9px] font-normal text-slate-500 mt-0.5 truncate max-w-[200px]">{item.purpose || item.reason || item.meetingTitle}</p>}
                  </td>
                  <td className="p-3 text-xs text-slate-600">{item._requester}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      item.status?.includes("Approved") || item.status?.includes("Cleared") || item.status?.includes("Endorsed") ? "bg-green-100 text-green-800" :
                      item.status?.includes("Returned") || item.status?.includes("Rejected") ? "bg-red-100 text-red-800" :
                      item.status?.includes("Pending") || item.status?.includes("Endorsed to Division Chief") ? "bg-amber-100 text-amber-800" :
                      "bg-slate-100 text-slate-800"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-right font-mono text-slate-700">
                    {item._amount != null ? `₱${item._amount.toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Action Modal */}
      {bulkActionType && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <h2 className="text-xs font-bold text-slate-800 capitalize">Bulk {bulkActionType === 'verify' ? 'Endorse (Chief/Finance)' : 'Reject'} ({selectedIds.length} items)</h2>
            </div>
            <div className="p-5 space-y-4">
              {bulkActionType !== 'verify' && (
                <textarea
                  placeholder={`Optional remarks for bulk ${bulkActionType === 'verify' ? 'endorsement/verification' : 'rejection'}...`}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 font-sans"
                />
              )}
              <div className="flex justify-end space-x-2">
                <button onClick={() => setBulkActionType(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
                <button onClick={() => handleBulkAction(bulkActionType)} className={`px-4 py-1.5 text-xs font-bold text-white rounded cursor-pointer ${
                  bulkActionType === "verify" ? "bg-blue-600 hover:bg-blue-700" : 
                  "bg-amber-600 hover:bg-amber-700"
                }`}>
                  Confirm {bulkActionType === 'verify' ? 'Endorse (Chief/Finance)' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
