import React, { useState, useEffect, useRef } from "react";
import { User, RequestStatus, ScreenFocus, LiquidationSubmission } from "../types";
import { apiCall, firstTimestamp, firstDateString } from "../utils";
import { overspendOf, OverspendBadge, OverspendNotice } from "./liquidation/overspend";
import ReturnForCorrectionDialog from "./liquidation/ReturnForCorrectionDialog";
import ReportContents from "./liquidation/ReportContents";
import LiquidationReportModal from "./liquidation/LiquidationReportModal";
import { ClaimTypeBadge } from "./liquidation/ClaimType";
import VehicleTripDetails from "./requests/VehicleTripDetails";
import { answeredCorrectionSummary } from "./liquidation/resubmit/correctionModel";
import { TablePager, TableSearch, ViewButton } from "./ui/DataTable";
import { useDetailsWindow } from "./ui/useDetailsWindow";
import { useTableView } from "./ui/useTableView";
import { searchField } from "../tableView";
import { Check, Undo2, RefreshCcw, X, Info, Printer } from "lucide-react";

interface HrUnifiedRequestsProps {
  user: User;
  onRefresh: () => void;
  /** From a notification: a request or liquidation report to open. */
  focus?: ScreenFocus | null;
  onFocusHandled?: () => void;
}

export default function HrUnifiedRequests({ user, onRefresh, focus, onFocusHandled }: HrUnifiedRequestsProps) {
  // The HR officer's own liquidation report (reports carry the claimant's staff code).
  // A group's report that covers the officer counts as their own too (HSAC RAB 1: one report for
  // everyone a group's cash advance covers): flagged when they endorse it, and left out of bulk Verify.
  const coversMe = (item: any) => item?._category === "Liquidation" && !!user.employeeId && item.employeeId !== user.employeeId
    && (Array.isArray(item.covers) ? item.covers : []).some((c: any) => c && c.employeeId === user.employeeId);
  const isOwnReport = (item: any) => item?._category === "Liquidation" && !!user.employeeId && (item.employeeId === user.employeeId || coversMe(item));
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
  const detailsRef = useRef<HTMLDivElement>(null);
  // An action sent from the details window: the window stays until the answer comes, and Confirm can't be sent twice.
  const [acting, setActing] = useState(false);
  const actingRef = useRef(false);
  useDetailsWindow(detailsRef, viewItem?._unifiedId, () => setViewItem(null), acting);
  // The official form of the report being read, in print preview (the instructor's review, R6).
  const [printing, setPrinting] = useState<LiquidationSubmission | null>(null);
  const [modalActionType, setModalActionType] = useState<"verify" | "return" | null>(null);
  const [modalRemarks, setModalRemarks] = useState("");
  // A liquidation report being returned for correction, with its checklist (requirement 5).
  const [returning, setReturning] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, [onRefresh]);

  // A notification opened this screen: its request or report opens once a fresh list is in
  // (counted by `loads`), or the screen says why it can't.
  const [loads, setLoads] = useState(0);
  const [wanted, setWanted] = useState<{ uid: string; afterLoad: number } | null>(null);
  useEffect(() => {
    const record = focus?.record;
    if (record?.kind === "request" || record?.kind === "liquidationReport") {
      setWanted({ uid: `${record.kind === "request" ? "req" : "liq"}-${record.id}`, afterLoad: loads });
      fetchData();
    }
    if (focus) onFocusHandled?.();
  }, [focus?.nonce]);
  useEffect(() => {
    if (!wanted || loads <= wanted.afterLoad) return;
    const item = allItems.find(i => i._unifiedId === wanted.uid);
    if (item) {
      setViewItem(item);
      table.reveal(item._unifiedId);
    } else {
      setError(prev => prev || "The item that notification is about is no longer in this list.");
    }
    setWanted(null);
  }, [wanted, loads]);

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
              _date: firstTimestamp(r.dateRequested, r.createdAt),
              _displayDate: firstDateString(r.dateRequested, r.createdAt),
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
              _date: firstTimestamp(s.createdAt, s.dateSubmitted),
              _displayDate: firstDateString(s.createdAt, s.dateSubmitted),
              _title: `Liquidation ${s.submissionNo}`,
              _requester: s.employeeName,
              // A Liquidation's cash advance; a Reimbursement has none, so what the employee is owed.
              _amount: s.claimType === "Reimbursement" ? s.totalSpent : s.totalReleased,
              _sequence: seq++
            });
          });
      }

      // Sort LIFO (Newest First)
      // LIFO: newest first, falling back to insertion order for identical dates.
      // Number(... ) || 0 keeps a malformed date from returning NaN here, which would
      // make the comparator inconsistent and scramble unrelated rows.
      combined.sort((a, b) => {
        const bd = Number(b._date) || 0;
        const ad = Number(a._date) || 0;
        if (bd !== ad) return bd - ad;
        return b._sequence - a._sequence;
      });
      setAllItems(combined);
      setSelectedIds([]);
    } catch (err: any) {
      setError("Failed to retrieve pending HR verifications payload.");
    } finally {
      setLoading(false);
      setLoads(n => n + 1);
    }
  }

  const matchesFilters = (item: any) => {
    let catMatch = true;
    if (filterCategory !== "All") {
      if (["Personnel Request", "Liquidation"].includes(filterCategory)) {
        catMatch = item._category === filterCategory;
      } else if (filterCategory.startsWith("Liquidation:")) {
        // A report's claim type: settling a cash advance, or paid by the employee (2026-10-30).
        catMatch = item._category === "Liquidation" && item.claimType === filterCategory.slice("Liquidation:".length);
      } else {
        catMatch = item.requestType === filterCategory || item.leaveType === filterCategory;
      }
    }

    let statMatch = true;
    if (filterStatus !== "All") {
      statMatch = item.status && item.status.includes(filterStatus);
    }

    return catMatch && statMatch;
  };

  // 25 a page, still newest first (fetchData sorts them). A long list is reached by the search or the pages.
  const table = useTableView<any>({
    rows: allItems,
    rowId: item => item._unifiedId,
    // Only text, and only its start: a reason or purpose has no limit on the server (12w).
    searchText: item => [item._title, item._requester, item._category, item.status, item.purpose, item.reason, item.submissionNo, item.activityTitle].map(searchField).join(" "),
    filter: matchesFilters,
    filterKey: `${filterCategory}\u0000${filterStatus}`,
    clearFilter: () => {
      setFilterCategory("All");
      setFilterStatus("All");
    }
  });
  const pageItems = table.page.rows;

  const isActionable = (status: string) => {
    if (!status) return false;
    return status === "Pending" || status === "Pending HR Review";
  };

  // The tick in the header takes the page on screen, nothing unseen.
  const actionableItems = pageItems.filter(item => isActionable(item.status));

  // A tick can't outlive its row on the screen: a new page, search or filter drops it, so a bulk action only
  // ever touches what the officer can see.
  useEffect(() => {
    const onPage = new Set(pageItems.map(item => item._unifiedId));
    setSelectedIds(ids => (ids.every(id => onPage.has(id)) ? ids : ids.filter(id => onPage.has(id))));
  }, [pageItems]);

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

  const openItem = (item: any) => {
    setViewItem(item);
    setModalActionType(null);
    setModalRemarks("");
  };

  async function handleBulkAction(action: "verify" | "return") {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setError("");
    setSuccess("");

    let successCount = 0;
    let failCount = 0;
    let skippedReports = 0;
    let skippedOwn = 0;

    for (const uid of selectedIds) {
      const item = allItems.find(i => i._unifiedId === uid);
      if (!item) continue;
      // A liquidation report is returned one at a time, with a checklist of what to
      // correct, so a bulk Return leaves it as it is (bulk Verify still applies).
      if (action === "return" && item._category === "Liquidation") {
        skippedReports++;
        continue;
      }
      // Your own report is endorsed on its own, where you're told it will be flagged.
      if (isOwnReport(item)) {
        skippedOwn++;
        continue;
      }

      try {
        if (item._category === "Personnel Request") {
          const endorse = action === "verify"; // verify means Endorse for Personnel Request
          await apiCall(`/api/requests/${item.id}/hr-endorse`, {
            method: "PUT",
            body: JSON.stringify({ endorse, remarks: remarks || `Bulk HR ${endorse ? 'Endorsement' : 'Return'}` })
          });
        } else if (item._category === "Liquidation") {
          // Only Verify reaches here: liquidation reports were skipped for a bulk Return.
          await apiCall(`/api/liquidation-submissions/${item.id}/hr-action`, {
            method: "PUT",
            body: JSON.stringify({ action: "Verify", remarks: remarks || "Bulk HR Verify" })
          });
        }
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    setSuccess(`Processed successfully: ${successCount}. Failed: ${failCount}.${skippedReports
      ? ` ${skippedReports} liquidation report${skippedReports === 1 ? " was" : "s were"} left as ${skippedReports === 1 ? "it was" : "they were"}: open each one to return it with a checklist.`
      : ""}${skippedOwn
      ? ` ${skippedOwn === 1 ? "Your own report was" : `${skippedOwn} of your own reports were`} left out: open ${skippedOwn === 1 ? "it" : "each one"} to endorse ${skippedOwn === 1 ? "it" : "them"}.`
      : ""}`);
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
            <option value="Liquidation:Liquidation">-- Liquidations of a cash advance</option>
            <option value="Liquidation:Reimbursement">-- Reimbursements (paid by the employee)</option>
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

      <div className="border-b border-slate-100 px-4 py-2">
        <TableSearch table={table} id="hr-request-search" label="Search the requests" placeholder="Title, requester, status, reason, report or seminar" />
      </div>

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

      <LiquidationReportModal submission={printing} activityLabel={printing?.activityTitle} onClose={() => setPrinting(null)} />

      {viewItem && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div ref={detailsRef} role="dialog" aria-modal="true" aria-label="Request details" tabIndex={-1} className="bg-white rounded-xl shadow-lg w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden focus:outline-none">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Request Details</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{viewItem._category} &bull; {viewItem._displayDate}</p>
              </div>
              <div className="flex items-center gap-2">
                {viewItem._category === "Liquidation" && (
                  <button type="button" onClick={() => setPrinting(viewItem)} className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Printer size={12} aria-hidden="true" /> Print
                  </button>
                )}
                <button onClick={() => setViewItem(null)} disabled={acting} aria-label="Close request details" className="text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded p-1 disabled:opacity-40">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
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
              
              {/* HR is one of the two approvers of an excess, so the variance belongs
                  here - on the screen where the endorsement is given. */}
              {viewItem._category === "Liquidation" && overspendOf(viewItem) && (
                <OverspendNotice over={overspendOf(viewItem)!} />
              )}
              {viewItem._category === "Liquidation" && answeredCorrectionSummary(viewItem) && (
                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
                  {answeredCorrectionSummary(viewItem)}
                </p>
              )}
              {/* What was filed: the claim, its line items and the attached files, which HR
                  checks before endorsing the report to Finance. */}
              {viewItem._category === "Liquidation" && <ReportContents report={viewItem} />}

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
              <VehicleTripDetails item={viewItem} />
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
                  {/* Officers may act on their own report, but it is flagged (the user's decision,
                      2026-10-20): they're told here, and asked again on Confirm. */}
                  {isOwnReport(viewItem) && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                      <strong>{coversMe(viewItem) ? "This group's report covers you." : "This is your own report."}</strong> You can endorse it, but it will be marked as
                      self-approved in the audit log.
                    </p>
                  )}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        // A liquidation report is returned with a checklist of what to correct.
                        if (viewItem._category === "Liquidation") {
                          setReturning(viewItem);
                          setViewItem(null);
                        } else {
                          setModalActionType("return");
                        }
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${modalActionType === "return" ? "bg-amber-600 text-white border-amber-700 ring-2 ring-amber-600/20 shadow-inner" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"}`}
                    >
                      {viewItem._category === "Liquidation" ? "Return for correction" : "Reject / Return"}
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
                      <label htmlFor="hr-action-remarks" className="text-[10px] font-bold text-slate-500 uppercase font-mono">Remarks (the employee sees these)</label>
                      <input
                        id="hr-action-remarks"
                        type="text"
                        value={modalRemarks}
                        onChange={e => setModalRemarks(e.target.value)}
                        placeholder="Optional remarks..."
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                      <button
                        disabled={acting}
                        onClick={async () => {
                          if (actingRef.current) return;
                          if (modalActionType === "verify" && isOwnReport(viewItem)
                            && !window.confirm(`${viewItem.submissionNo} ${coversMe(viewItem) ? "is a group's report that covers you" : "is your own report"}. Endorsing it will be marked as self-approved in the audit log. Endorse it anyway?`)) return;
                          actingRef.current = true;
                          setActing(true);
                          setLoading(true);
                          try {
                            if (viewItem._category === "Personnel Request") {
                              const endorse = modalActionType === "verify";
                              await apiCall(`/api/requests/${viewItem.id}/hr-endorse`, {
                                method: "PUT",
                                body: JSON.stringify({ endorse, remarks: modalRemarks || `HR ${endorse ? 'Endorsement' : 'Return'}` })
                              });
                            } else if (viewItem._category === "Liquidation") {
                              // Only Verify reaches here: a Return opens its checklist dialog.
                              await apiCall(`/api/liquidation-submissions/${viewItem.id}/hr-action`, {
                                method: "PUT",
                                body: JSON.stringify({ action: "Verify", remarks: modalRemarks || "HR Verify" })
                              });
                            }
                            setSuccess("Action applied successfully.");
                            setViewItem(null);
                            setModalActionType(null);
                            setModalRemarks("");
                            fetchData();
                            onRefresh();
                          } catch (err: any) {
                            // The server's reason (e.g. the request is no longer waiting for HR), not a bare failure.
                            setError(err?.message || "Action failed.");
                            setLoading(false);
                          } finally {
                            actingRef.current = false;
                            setActing(false);
                          }
                        }}
                        className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
      <div className="custom-scrollbar relative overflow-x-auto">
        <table className="w-full min-w-[860px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/50 border-b border-slate-200">
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  aria-label="Select every request waiting for HR on this page"
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
              <th className="sticky right-0 border-l border-slate-200 bg-slate-50 p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-xs text-slate-400">Loading records...</td></tr>
            ) : table.matching.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-xs text-slate-500">
                No records found matching criteria.
                {table.query.trim() && (
                  <button
                    type="button"
                    onClick={() => { table.setQuery(""); document.getElementById("hr-request-search")?.focus(); }}
                    className="ml-1.5 cursor-pointer rounded font-semibold text-blue-700 underline hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Clear the search
                  </button>
                )}
              </td></tr>
            ) : (
              pageItems.map(item => (
                <tr key={item._unifiedId} onClick={() => openItem(item)} className={`group hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.includes(item._unifiedId) ? "bg-blue-50/30" : ""}`}>
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                    {isActionable(item.status) && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${item._title}, ${item._requester}`}
                        checked={selectedIds.includes(item._unifiedId)}
                        onChange={() => toggleSelect(item._unifiedId)}
                        className="cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap">{item._displayDate ? item._displayDate.split("T")[0] : "-"}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${
                      item._category === "Personnel Request" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      item._category === "Liquidation" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>
                      {item._category}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-slate-800 font-medium">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {item._title}
                      {/* Settling a cash advance, or paid by the employee: seen before opening the row. */}
                      {item._category === "Liquidation" && <ClaimTypeBadge claimType={item.claimType} />}
                      {/* Visible before opening the row, so a queue of ten shows at a
                          glance which ones carry an excess. */}
                      {overspendOf(item) && <OverspendBadge over={overspendOf(item)!} />}
                    </span>
                    {(item.purpose || item.reason || item.meetingTitle) && <p className="text-[9px] font-normal text-slate-500 mt-0.5 truncate max-w-[200px]">{item.purpose || item.reason || item.meetingTitle}</p>}
                  </td>
                  <td className="p-3 text-xs text-slate-600">{item._requester}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
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
                  {/* The row's click stays; this is the way in by keyboard. The cell stops the click, or it would open twice. */}
                  <td className="sticky right-0 border-l border-slate-200 bg-white p-2 text-right group-hover:bg-slate-50" onClick={e => e.stopPropagation()}>
                    <ViewButton label={`${item._title}, ${item._requester}`} onClick={() => openItem(item)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && <TablePager table={table} label="Pages of the requests" />}

      {/* Bulk Action Modal */}
      {bulkActionType && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <h2 className="text-xs font-bold text-slate-800 capitalize">Bulk {bulkActionType === 'verify' ? 'Endorse (Chief/Finance)' : 'Reject'} ({selectedIds.length} items)</h2>
            </div>
            <div className="p-5 space-y-4">
              {bulkActionType !== 'verify' && (
                <>
                  <textarea
                    placeholder="Optional remarks for the bulk rejection..."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 font-sans"
                  />
                  {selectedIds.some(id => allItems.find(i => i._unifiedId === id)?._category === "Liquidation") && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Liquidation reports aren&rsquo;t returned in bulk: each needs its own checklist of what to correct.
                      They will be left as they are; open each one to return it.
                    </p>
                  )}
                </>
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

      {/* Returning a liquidation report: a checklist of what to correct; only those parts
          reopen on the employee's form, and the corrected report comes back to HR. */}
      {returning && (
        <ReturnForCorrectionDialog
          key={returning.id}
          report={returning}
          reviewer="HR"
          // Cancel goes back to the report's details, where the Return began.
          onCancel={() => { setViewItem(returning); setModalActionType(null); setReturning(null); }}
          onSubmit={async payload => {
            // apiCall throws with the server's reason; the dialog shows it and stays open. A
            // refusal also reloads the list, in case the report was acted on elsewhere.
            try {
              const res = await apiCall(`/api/liquidation-submissions/${encodeURIComponent(returning.id)}/hr-action`, {
                method: "PUT",
                body: JSON.stringify({ action: "Return", ...payload })
              });
              if (res?.status !== "success") throw new Error(res?.message || "The report could not be returned.");
            } catch (err) {
              fetchData();
              throw err;
            }
            setSuccess(`${returning.submissionNo} was returned for correction.`);
            setReturning(null);
            fetchData();
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
