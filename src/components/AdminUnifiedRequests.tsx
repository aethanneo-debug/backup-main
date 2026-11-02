import React, { useState, useEffect, useRef } from "react";
import { User, AnyRequest, RequestStatus, ScreenFocus, LiquidationSubmission } from "../types";
import { apiCall, formatDate, firstTimestamp, firstDateString } from "../utils";
import VehicleTripDetails from "./requests/VehicleTripDetails";
import ReportContents from "./liquidation/ReportContents";
import LiquidationReportModal from "./liquidation/LiquidationReportModal";
import { TablePager, TableSearch, ViewButton } from "./ui/DataTable";
import { useDetailsWindow } from "./ui/useDetailsWindow";
import { useTableView } from "./ui/useTableView";
import { searchField } from "../tableView";
import { Check, X, Undo2, Filter, RefreshCcw, Info, PieChart as PieChartIcon, BarChart3, Printer } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface AdminUnifiedRequestsProps {
  user: User;
  onRefresh: () => void;
  /** From a notification: a request or liquidation report to open. */
  focus?: ScreenFocus | null;
  onFocusHandled?: () => void;
}

export default function AdminUnifiedRequests({ user, onRefresh, focus, onFocusHandled }: AdminUnifiedRequestsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterDivision, setFilterDivision] = useState<string>("All");

  const [remarks, setRemarks] = useState("");
  const [bulkActionType, setBulkActionType] = useState<"approve" | "reject" | null>(null);
  const [viewItem, setViewItem] = useState<any | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  // A decision sent from the details window: the window stays until the answer comes, and Confirm can't be sent twice.
  const [acting, setActing] = useState(false);
  const actingRef = useRef(false);
  useDetailsWindow(detailsRef, viewItem?._unifiedId, () => setViewItem(null), acting);
  // The official form of the report being read, in print preview (the instructor's review, R6).
  const [printing, setPrinting] = useState<LiquidationSubmission | null>(null);
  const [modalActionType, setModalActionType] = useState<"approve" | "reject" | null>(null);
  const [modalRemarks, setModalRemarks] = useState("");

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
      const [reqRes, subRes, empRes] = await Promise.all([
        apiCall("/api/requests"),
        apiCall("/api/liquidation-submissions"),
        apiCall("/api/employees")
      ]);
      
      const employees = empRes.status === "success" ? empRes.data : [];
      const getDivision = (empId, dept) => {
        if (dept) return dept;
        const emp = employees.find(e => e.employeeId === empId || e.id === empId);
        return emp ? emp.division : "Unknown Division";
      };

      const combined: any[] = [];

      let seq = 0;
      
      if (reqRes.status === "success") {
        reqRes.data.forEach((r: any) => {
          // Admin can see everything or just endorsed ones? The instruction says "combine the Request Management and Approval Office Cockpit"
          // In original Request Management, admin sees ALL. Let's show all pending/endorsed for actions.
          // We will show all but actions can only be applied to pending/endorsed.
          combined.push({
            ...r,
            _unifiedId: `req-${r.id}`,
            _category: "Personnel Request",
            _date: firstTimestamp(r.dateRequested, r.createdAt),
            _displayDate: firstDateString(r.dateRequested, r.createdAt),
            _title: r.leaveType ? `${r.requestType} (${r.leaveType})` : r.requestType,
            _requester: r.employeeName,
            _division: getDivision(r.employeeId, null),
            _amount: null,
            _sequence: seq++
          });
        });
      }

      if (subRes.status === "success") {
        subRes.data.forEach((s: any) => {
          combined.push({
            ...s,
            _unifiedId: `liq-${s.id}`,
            _category: "Liquidation",
            _date: firstTimestamp(s.createdAt, s.dateSubmitted),
            _displayDate: firstDateString(s.createdAt, s.dateSubmitted),
            _title: `Liquidation ${s.submissionNo}`,
            _requester: s.employeeName,
            _division: getDivision(s.employeeId, null),
            _amount: s.totalSpent,
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
      setError("Failed to retrieve pending approvals payload.");
    } finally {
      setLoading(false);
      setLoads(n => n + 1);
    }
  }

  // Calculate Summary & Analytics

  const matchesFilters = (item: any) => {
    let catMatch = true;
    if (filterCategory !== "All") {
      if (["Personnel Request", "Liquidation"].includes(filterCategory)) {
        catMatch = item._category === filterCategory;
      } else {
        catMatch = item.requestType === filterCategory || item.leaveType === filterCategory;
      }
    }
    if (filterDivision !== "All" && item._division !== filterDivision) return false;

    // Map status for unified filtering
    let stat = item.status;
    if (stat === "Endorsed to Chief") stat = "Pending";
    if (stat === "Under Review") stat = "Pending";
    if (stat === "Pending Submission") stat = "Pending";
    if (stat === "Submitted") stat = "Pending";
    if (stat === "Completed") stat = "Approved";
    if (stat === "Returned") stat = "Rejected";

    let statMatch = filterStatus === "All" || stat === filterStatus;

    return catMatch && statMatch;
  };

  // The summary cards and the chart count what the filters leave, whatever the search or the page shows.
  const filteredItems = allItems.filter(matchesFilters);

  // 25 a page, still newest first (fetchData sorts them). A long list is reached by the search or the pages.
  const table = useTableView<any>({
    rows: allItems,
    rowId: item => item._unifiedId,
    // Only text, and only its start: a reason or purpose has no limit on the server (12w).
    searchText: item => [item._title, item._requester, item._category, item.status, item.purpose, item.reason, item.submissionNo, item.activityTitle, item._division].map(searchField).join(" "),
    filter: matchesFilters,
    filterKey: `${filterCategory}\u0000${filterStatus}\u0000${filterDivision}`,
    clearFilter: () => {
      setFilterCategory("All");
      setFilterStatus("All");
      setFilterDivision("All");
    }
  });
  const pageItems = table.page.rows;

  const totalRequests = filteredItems.length;
  
  const getUnifiedStatus = (item) => {
    let stat = item.status;
    if (stat === "Endorsed to Chief") stat = "Pending";
    if (stat === "Under Review") stat = "Pending";
    if (stat === "Pending Submission") stat = "Pending";
    if (stat === "Submitted") stat = "Pending";
    if (stat === "Completed") stat = "Approved";
    if (stat === "Returned") stat = "Rejected";
    return stat;
  };
  
  const pendingRequests = filteredItems.filter(i => getUnifiedStatus(i) === "Pending").length;
  const approvedRequests = filteredItems.filter(i => getUnifiedStatus(i) === "Approved").length;
  const rejectedRequests = filteredItems.filter(i => getUnifiedStatus(i) === "Rejected").length;

  const divisionCounts = filteredItems.reduce((acc, item) => {
    const div = item._division || "Unknown Division";
    acc[div] = (acc[div] || 0) + 1;
    return acc;
  }, {});
  
  const allDivisions = Array.from(new Set(allItems.map(i => i._division || "Unknown Division"))).sort();
  const chartData = Object.keys(divisionCounts).map((key, i) => ({
    name: key,
    value: divisionCounts[key],
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'][i % 7]
  }));
  
  

  const isActionable = (status: string) => {
    if (!status) return false;
    return status.includes("Pending") || status.includes("Endorsed to Division Chief") || status === "Endorsed";
  };

  // Liquidation reports are verified by HR and validated by Finance, which certifies them
  // for the Division Chief; here they are only followed (the server refuses chief-action).
  const canActOn = (item: any) => item._category !== "Liquidation" && isActionable(item.status);
  // The tick in the header takes the page on screen, nothing unseen.
  const actionableItems = pageItems.filter(canActOn);

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

  async function handleBulkAction(action: "approve" | "reject") {
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
          const decision = action === "approve" ? "Approved" : "Rejected";
          await apiCall(`/api/requests/${item.id}/chief-decide`, {
            method: "PUT",
            body: JSON.stringify({ decision, remarks: remarks || `Bulk ${decision}` })
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

    <div className="space-y-6">
      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Cards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Total Requests</p>
              <p className="text-2xl font-black text-slate-800">{totalRequests}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Pending</p>
              <p className="text-2xl font-black text-amber-500">{pendingRequests}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Approved</p>
              <p className="text-2xl font-black text-emerald-500">{approvedRequests}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Rejected</p>
              <p className="text-2xl font-black text-rose-500">{rejectedRequests}</p>
            </div>
          </div>
          
          {/* Division List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Requests per Division</h3>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {chartData.map(d => (
                <div key={d.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                    <span className="text-slate-600 truncate max-w-[120px]">{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Division Distribution Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
          <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2">
            <PieChartIcon size={14} className="text-blue-500" />
            Division-Based Request Analytics
          </h3>
          <div className="flex-1 min-h-[250px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [`${value} Requests`, name]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No request data available
              </div>
            )}
          </div>
        </div>
      </div>

    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50 gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Unified Request Management & Approvals</h2>
          <p className="text-[10px] text-slate-500">Manage all requests and follow liquidations in one place.</p>
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
            value={filterDivision} 
            onChange={e => setFilterDivision(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Divisions</option>
            {allDivisions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
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
        <TableSearch table={table} id="admin-request-search" label="Search the requests" placeholder="Title, requester, division, status, report or seminar" />
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-800">{selectedIds.length} items selected</span>
          <div className="flex items-center space-x-2">
            <button onClick={() => setBulkActionType("reject")} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[11px] font-bold flex items-center cursor-pointer shadow-sm">
              <X size={12} className="mr-1" /> Reject
            </button>
            <button onClick={() => setBulkActionType("approve")} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[11px] font-bold flex items-center cursor-pointer shadow-sm">
              <Check size={12} className="mr-1" /> Approve
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
              
              {viewItem._amount != null && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Amount</p>
                  <p className="text-slate-700 font-mono font-medium">₱{viewItem._amount.toLocaleString()}</p>
                </div>
              )}
              
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

              {viewItem._category === "Liquidation" && <ReportContents report={viewItem} />}
              {viewItem._category === "Liquidation" && (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  Liquidation reports are verified by HR and validated by Finance, which certifies them for the
                  Division Chief under delegated authority. They are listed here to follow, not to approve.
                </p>
              )}
              {canActOn(viewItem) && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setModalActionType("reject")} 
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${modalActionType === "reject" ? "bg-rose-600 text-white border-rose-700 ring-2 ring-rose-600/20 shadow-inner" : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"}`}
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => setModalActionType("approve")} 
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${modalActionType === "approve" ? "bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-600/20 shadow-inner" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                    >
                      Approve
                    </button>
                  </div>
                  {modalActionType && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <label htmlFor="admin-decision-remarks" className="text-[10px] font-bold text-slate-500 uppercase font-mono">Remarks (the employee sees these)</label>
                      <input
                        id="admin-decision-remarks"
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
                          actingRef.current = true;
                          setActing(true);
                          setLoading(true);
                          try {
                            if (viewItem._category === "Personnel Request") {
                              const decision = modalActionType === "approve" ? "Approved" : "Rejected";
                              await apiCall(`/api/requests/${viewItem.id}/chief-decide`, {
                                method: "PUT",
                                body: JSON.stringify({ decision, remarks: modalRemarks || `${decision}` })
                              });
                            }
                            setSuccess("Action applied successfully.");
                            setViewItem(null);
                            setModalActionType(null);
                            setModalRemarks("");
                            fetchData();
                            onRefresh();
                          } catch (err: any) {
                            // The server's reason (e.g. the request was already decided), not a bare failure.
                            setError(err?.message || "Action failed.");
                            setLoading(false);
                          } finally {
                            actingRef.current = false;
                            setActing(false);
                          }
                        }}
                        className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Confirm {modalActionType === "approve" ? "Approval" : "Rejection"}
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
                  aria-label="Select every request waiting for a decision on this page"
                  checked={selectedIds.length === actionableItems.length && actionableItems.length > 0}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                  disabled={actionableItems.length === 0}
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
                    onClick={() => { table.setQuery(""); document.getElementById("admin-request-search")?.focus(); }}
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
                    {canActOn(item) && (
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
                    {item._title}
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
              <h2 className="text-xs font-bold text-slate-800 capitalize">Bulk {bulkActionType} ({selectedIds.length} items)</h2>
            </div>
            <div className="p-5 space-y-4">
              {bulkActionType !== "approve" && (
                <textarea
                  placeholder={`Optional remarks for bulk ${bulkActionType}...`}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 font-sans"
                />
              )}
              <div className="flex justify-end space-x-2">
                <button onClick={() => setBulkActionType(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
                <button onClick={() => handleBulkAction(bulkActionType)} className={`px-4 py-1.5 text-xs font-bold text-white rounded cursor-pointer ${
                  bulkActionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}>
                  Confirm {bulkActionType}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}