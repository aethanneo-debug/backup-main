import React, { useState, useEffect } from "react";
import { Asset, SupplyItem, AssetStatus, User, UserRole, Employee } from "../types";
import { 
  Search, 
  Plus, 
  Package, 
  UserCheck, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Sliders, 
  Activity, 
  Layers,
  Archive,
  QrCode,
  Tag,
  CircleAlert,
  ClipboardCopy,
  FolderDown,
  X,
  FileText
} from "lucide-react";
import { apiCall, formatCurrency, formatDate } from "../utils";

interface AssetsViewProps {
  user: User;
  assets: Asset[];
  supplies: SupplyItem[];
  employees: Employee[];
  fetchSummary: () => void;
  onRefresh: () => void;
}

export default function AssetsView({ user, assets, supplies, employees, fetchSummary, onRefresh }: AssetsViewProps) {
  const [activeTab, setActiveTab] = useState<"assets" | "supplies">("assets");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  
  // Selected detail drawers
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Modals status
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Form states
  const [assetFormData, setAssetFormData] = useState({
    assetNumber: "",
    serialNumber: "",
    category: "IT Equipment" as any,
    description: "",
    dateAcquired: "",
    cost: "",
  });

  const [supplyFormData, setSupplyFormData] = useState({
    name: "",
    totalQuantity: "",
    unit: "pieces"
  });

  const [issueFormData, setIssueFormData] = useState({
    employeeId: ""
  });

  const [returnFormData, setReturnFormData] = useState({
    conditionOnReturn: "Good working condition - normal wear and tear",
    clearanceStatus: "Cleared" as any
  });

  const isCustodianOrAdmin = [UserRole.SUPER_ADMIN].includes(user.role);

  useEffect(() => {
    if (selectedAsset) {
      const updated = assets.find(a => a.id === selectedAsset.id);
      if (updated) setSelectedAsset(updated);
    }
  }, [assets]);

  // Submit asset
  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiCall("/api/assets", {
        method: "POST",
        body: JSON.stringify(assetFormData)
      });
      if (res.status === "success") {
        alert("Physical property registered on inventory logs successfully!");
        setIsAssetModalOpen(false);
        onRefresh();
        fetchSummary();
        // Reset
        setAssetFormData({
          assetNumber: "",
          serialNumber: "",
          category: "IT Equipment",
          description: "",
          dateAcquired: "",
          cost: "",
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Register supply
  async function handleCreateSupply(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiCall("/api/supplies", {
        method: "POST",
        body: JSON.stringify(supplyFormData)
      });
      if (res.status === "success") {
        alert("Supply item configured on stock catalog successfully!");
        setIsSupplyModalOpen(false);
        onRefresh();
        // Reset
        setSupplyFormData({
          name: "",
          totalQuantity: "",
          unit: "pieces"
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Assign property PAR
  async function handleIssueAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      const res = await apiCall(`/api/assets/${selectedAsset.id}/issue`, {
        method: "POST",
        body: JSON.stringify(issueFormData)
      });
      if (res.status === "success") {
        alert("Asset assigned and accountability record registered!");
        setIsIssueModalOpen(false);
        onRefresh();
        fetchSummary();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Return physical property
  async function handleReturnAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      const res = await apiCall(`/api/assets/${selectedAsset.id}/return`, {
        method: "POST",
        body: JSON.stringify(returnFormData)
      });
      if (res.status === "success") {
        alert("Property return check achieved. Accountability closed!");
        setIsReturnModalOpen(false);
        onRefresh();
        fetchSummary();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Fast direct supply issuance from stockroom
  async function handleIssueSupplyQuick(supplyId: string, qtyNeeded: number, unit: string) {
    const input = prompt(`Specify Plantilla Number or Full Name of the employee to issue ${qtyNeeded} ${unit} to:`);
    if (!input) return;

    const cleanInput = input.trim().toLowerCase();
    const emp = employees.find(e => 
      e.id.toLowerCase() === cleanInput ||
      e.employeeId?.toLowerCase() === cleanInput ||
      (e.plantillaNumber && e.plantillaNumber.toLowerCase() === cleanInput) ||
      e.fullName.toLowerCase().includes(cleanInput)
    );

    if (!emp) {
      alert(`Could not find an active personnel matching "${input}". Please provide a valid Plantilla Number or Full Name.`);
      return;
    }

    const employeeId = emp.id;

    try {
      const res = await apiCall("/api/supplies/issue", {
        method: "POST",
        body: JSON.stringify({ supplyId, issuedToId: employeeId, quantity: qtyNeeded })
      });
      if (res.status === "success") {
        alert("Cabinet materials deducted and issued successfully!");
        onRefresh();
        fetchSummary();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Filter listings
  const filteredAssets = (assets || []).filter((ast) => {
    const matchesSearch = 
      ast.assetNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ast.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ast.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ast.assignedToName?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory ? ast.category === filterCategory : true;
    const matchesStatus = filterStatus ? ast.status === filterStatus : true;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredSupplies = (supplies || []).filter((sup) => 
    sup.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="assets-view-container" className="flex-1 flex overflow-hidden bg-slate-50">
      
      {/* LEFT SECTION: LISTS AND PANELS */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
        
        {/* HEADER BRAND */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-md font-bold text-slate-800">Property accountability & Supply Stockroom</h1>
            <p className="text-[11px] text-slate-500">Record equipment physical profiles, PAR designations, supply reserves, and returns.</p>
          </div>
          
          {/* REGISTER ACTION */}
          {isCustodianOrAdmin && (
            <div className="flex gap-2">
              {activeTab === "assets" ? (
                <button
                  id="btn-add-asset"
                  onClick={() => setIsAssetModalOpen(true)}
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center shadow"
                >
                  <Plus size={14} className="mr-1.5" />
                  <span>Register Equipment Asset</span>
                </button>
              ) : (
                <button
                  id="btn-add-supply"
                  onClick={() => setIsSupplyModalOpen(true)}
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center shadow"
                >
                  <Plus size={14} className="mr-1.5" />
                  <span>Add Stock Catalog</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* MODULAR CATEGORY PANEL TABS */}
        <div className="flex border-b border-slate-200 gap-4 shrink-0 font-medium text-xs bg-white px-4 py-2.5 rounded-xl border">
          <button
            onClick={() => { setActiveTab("assets"); setSearchTerm(""); }}
            className={`pb-1 px-1 font-semibold ${activeTab === "assets" ? "text-amber-600 border-b-2 border-amber-500" : "text-slate-500 hover:text-slate-800"}`}
          >
            Regional Assets Inventory ({assets.length})
          </button>
          <button
            onClick={() => { setActiveTab("supplies"); setSearchTerm(""); }}
            className={`pb-1 px-1 font-semibold ${activeTab === "supplies" ? "text-amber-600 border-b-2 border-amber-500" : "text-slate-500 hover:text-slate-800"}`}
          >
            Office Supply stockroom ({supplies.length})
          </button>
        </div>

        {/* SEARCH BAR & FILTERS (IF ASSETS PANEL ACTIVE) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "assets" ? "Search assets, serials, descriptions, assigned..." : "Search supply catalog name..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {activeTab === "assets" && (
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-3 text-xs focus:ring-1 text-slate-600 font-semibold"
              >
                <option value="">All Categories</option>
                <option value="IT Equipment">IT Equipment</option>
                <option value="Office Furniture">Office Furniture</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Other">Other</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-3 text-xs focus:ring-1 text-slate-600 font-semibold"
              >
                <option value="">All Status</option>
                <option value={AssetStatus.AVAILABLE}>Available</option>
                <option value={AssetStatus.ASSIGNED}>Assigned</option>
                <option value={AssetStatus.RETURNED}>Returned</option>
                <option value={AssetStatus.DAMAGED}>Damaged</option>
                <option value={AssetStatus.LOST}>Lost</option>
              </select>
            </div>
          )}
        </div>

        {/* MAIN DATA PANELS */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-y-auto flex-1">
            {activeTab === "assets" ? (
              // ASSETS DATAGRID
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] select-none">
                    <th className="p-4 w-44">Asset Number</th>
                    <th className="p-4">Description</th>
                    <th className="p-4 text-center">Category</th>
                    <th className="p-4 text-right">Value Cost</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.length > 0 ? (
                    filteredAssets.map((ast) => (
                      <tr
                        key={ast.id}
                        onClick={() => setSelectedAsset(ast)}
                        className={`cursor-pointer transition-colors ${
                          selectedAsset?.id === ast.id ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="p-4 font-mono font-bold text-slate-700 flex items-center gap-1.5">
                          <QrCode size={13} className="text-slate-400" />
                          <span>{ast.assetNumber}</span>
                        </td>
                        <td className="p-4 text-slate-800 font-medium">
                          <div className="font-semibold">{ast.description}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">SN: {ast.serialNumber}</div>
                        </td>
                        <td className="p-4 text-center text-slate-500">{ast.category}</td>
                        <td className="p-4 text-right font-mono font-semibold text-slate-700">{formatCurrency(ast.cost)}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${
                            ast.status === AssetStatus.AVAILABLE 
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                              : ast.status === AssetStatus.ASSIGNED
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : ast.status === AssetStatus.DAMAGED
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}>
                            {ast.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 font-medium">
                          {ast.assignedToName ? (
                            <span className="flex items-center gap-1">
                              <UserCheck size={11} className="text-blue-500" />
                              <span>{ast.assignedToName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-mono">No physical assets matching filter descriptors.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              // OFFICE SUPPLIES RENDER
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] select-none">
                    <th className="p-4">Material / Item description</th>
                    <th className="p-4 text-center">Base Stock</th>
                    <th className="p-4 text-center">Current Shelf Available</th>
                    <th className="p-4 text-center">Packaging Unit</th>
                    {isCustodianOrAdmin && <th className="p-4 text-center">Material Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSupplies.length > 0 ? (
                    filteredSupplies.map((sup) => {
                      const isLowStock = sup.availableQuantity < (sup.totalQuantity * 0.15);
                      return (
                        <tr key={sup.id} className="hover:bg-slate-50">
                          <td className="p-4 font-semibold text-slate-800">
                            <div className="flex items-center gap-2">
                              {isLowStock && <CircleAlert size={13} className="text-rose-500 animate-pulse" title="Low reserves!" />}
                              <span>{sup.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center text-slate-500 font-mono">{sup.totalQuantity}</td>
                          <td className="p-4 text-center font-mono">
                            <span className={`font-bold px-2 py-0.5 rounded ${isLowStock ? "bg-rose-50 text-rose-700 font-extrabold border border-rose-100" : "text-slate-800"}`}>
                              {sup.availableQuantity}
                            </span>
                          </td>
                          <td className="p-4 text-center text-slate-500 font-mono">{sup.unit}</td>
                          {isCustodianOrAdmin && (
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleIssueSupplyQuick(sup.id, 5, sup.unit)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded text-[10px] font-bold uppercase"
                              >
                                Issue 5 Quick
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 font-mono">No stockroom records matching searching name.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: EXHAUSTIVE PROPERTY CARD */}
      {selectedAsset && activeTab === "assets" && (
        <div className="w-96 bg-white border-l border-slate-200 overflow-y-auto flex flex-col shrink-0">
          
          {/* HEADER */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center space-x-2">
              <ClipboardCopy size={16} className="text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Property Card Inspection</h3>
            </div>
            <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-white p-1">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-6">
            
            {/* CORE CARD SPECIFICATION */}
            <div className="border-b border-slate-100 pb-5 text-center">
              <QrCode size={40} className="text-slate-700 mx-auto mb-2 bg-slate-50 p-2 rounded-xl border border-slate-100" />
              <h2 className="text-xs font-mono font-bold text-slate-400">Inventory Tag Code:</h2>
              <h3 className="text-sm font-extrabold font-mono text-slate-800">{selectedAsset.assetNumber}</h3>
              <p className="text-[11px] leading-relaxed text-slate-600 font-semibold mt-2 px-1">{selectedAsset.description}</p>
              
              <div className="mt-3 inline-block px-3 py-1 bg-slate-900 rounded-lg text-amber-400 text-xs font-bold font-mono">
                Asset Val: {formatCurrency(selectedAsset.cost)}
              </div>
            </div>

            {/* KEY PARAMS */}
            <div className="space-y-3.5 text-[11px]">
              <h4 className="text-[9px] uppercase font-mono font-bold text-slate-400 border-b pb-0.5">Specifications</h4>
              
              <div className="flex justify-between">
                <span className="text-slate-500">Hardware Serial:</span>
                <span className="font-mono font-semibold text-slate-800">{selectedAsset.serialNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Asset Category:</span>
                <span className="font-medium text-slate-800">{selectedAsset.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Acquisition Date:</span>
                <span className="font-medium text-slate-800">{formatDate(selectedAsset.dateAcquired)}</span>
              </div>
            </div>

            {/* STATUS & PAR DIRECT APPOINTMENT */}
            <div className="space-y-3">
              <h4 className="text-[9px] uppercase font-mono font-bold text-slate-400 border-b pb-0.5">PAR Accountability Holder</h4>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Ledger Status:</span>
                  <span className="font-bold text-slate-800">{selectedAsset.status}</span>
                </div>

                {selectedAsset.assignedToName ? (
                  <div className="text-[11px] border-t border-slate-200/60 pt-2.5 space-y-1">
                    <p className="text-slate-400">Designated Employee:</p>
                    <p className="font-bold text-slate-800">{selectedAsset.assignedToName}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-1">Code ID: {selectedAsset.assignedToId}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">No designated personnel holds signature receipt for this property.</p>
                )}
              </div>
            </div>

            {/* WORKFLOW OPERATIONS (CUSTODIANS ONLY) */}
            {isCustodianOrAdmin && (
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                {selectedAsset.status === AssetStatus.AVAILABLE ? (
                  <button
                    onClick={() => setIsIssueModalOpen(true)}
                    className="w-full bg-slate-900 border border-slate-850 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <UserCheck size={14} />
                    <span>Issue Property (PAR Designation)</span>
                  </button>
                ) : selectedAsset.status === AssetStatus.ASSIGNED ? (
                  <button
                    onClick={() => setIsReturnModalOpen(true)}
                    className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <RotateCcw size={14} />
                    <span>Receive Return & Clear Custody</span>
                  </button>
                ) : null}

                {/* Adjust basic hardware statuses manually */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      if (window.confirm("Tag property as Damaged / Suspended?")) {
                        apiCall(`/api/assets/${selectedAsset.id}/status`, {
                          method: "PUT",
                          body: JSON.stringify({ status: AssetStatus.DAMAGED })
                        }).then(() => { onRefresh(); fetchSummary(); }).catch(err => alert(err.message));
                      }
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 py-1.5 rounded text-[10px] font-semibold flex items-center justify-center gap-1"
                  >
                    <AlertTriangle size={11} />
                    <span>Tag Damaged</span>
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm("Tag property as Lost/Stolen?")) {
                        apiCall(`/api/assets/${selectedAsset.id}/status`, {
                          method: "PUT",
                          body: JSON.stringify({ status: AssetStatus.LOST })
                        }).then(() => { onRefresh(); fetchSummary(); }).catch(err => alert(err.message));
                      }
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 py-1.5 rounded text-[10px] font-semibold flex items-center justify-center gap-1"
                  >
                    <Archive size={11} />
                    <span>Tag Lost</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGISTER ASSET MODAL */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider">Acquire / Register Asset</h3>
              <button onClick={() => setIsAssetModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateAsset} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Asset Inventory Tag Number *</label>
                <input
                  required
                  type="text"
                  placeholder="HSAC-RAB1-AST-008"
                  value={assetFormData.assetNumber}
                  onChange={(e) => setAssetFormData({ ...assetFormData, assetNumber: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs font-mono font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Manufacturer Serial Tag *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. SN-5CD1923K9D"
                  value={assetFormData.serialNumber}
                  onChange={(e) => setAssetFormData({ ...assetFormData, serialNumber: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Asset Category Classification *</label>
                <select
                  value={assetFormData.category}
                  onChange={(e) => setAssetFormData({ ...assetFormData, category: e.target.value as any })}
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs"
                >
                  <option value="IT Equipment">IT Equipment (Laptops, Printers, Screens)</option>
                  <option value="Office Furniture">Office Furniture (Desks, Chairs, Credenzas)</option>
                  <option value="Vehicles">Vehicles</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Other">Other Category</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Acquisition Value (PHP) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="25000"
                    value={assetFormData.cost}
                    onChange={(e) => setAssetFormData({ ...assetFormData, cost: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Acquisition Date *</label>
                  <input
                    required
                    type="date"
                    value={assetFormData.dateAcquired}
                    onChange={(e) => setAssetFormData({ ...assetFormData, dateAcquired: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Description & Specs *</label>
                <textarea
                  required
                  placeholder="e.g. Huawei MateBook D15 Laptop, Core i5, Space Gray"
                  value={assetFormData.description}
                  onChange={(e) => setAssetFormData({ ...assetFormData, description: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs h-16"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-5 py-2 rounded-lg text-xs"
                >
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER SUPPLY CATALOG TYPE */}
      {isSupplyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider">Add Supply Catalog Registry</h3>
              <button onClick={() => setIsSupplyModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSupply} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Supply Item Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Permanent Marker Fine Point Black"
                  value={supplyFormData.name}
                  onChange={(e) => setSupplyFormData({ ...supplyFormData, name: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Opening Stock *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="100"
                    value={supplyFormData.totalQuantity}
                    onChange={(e) => setSupplyFormData({ ...supplyFormData, totalQuantity: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs font-mono font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Unit *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. boxes, reams, pieces"
                    value={supplyFormData.unit}
                    onChange={(e) => setSupplyFormData({ ...supplyFormData, unit: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsSupplyModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-5 py-2 rounded-lg text-xs"
                >
                  Save Supply Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ISSUE ASSET SELECTOR DRAWER */}
      {isIssueModalOpen && selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider">Issue Property Receipt Signature</h3>
              <button onClick={() => setIsIssueModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleIssueAsset} className="p-5 space-y-4">
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-150">
                Registering hand-off accountability for asset: <strong className="text-slate-800 font-mono">{selectedAsset.assetNumber}</strong>
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Select Hand-off Employee Recipient *</label>
                <select
                  required
                  value={issueFormData.employeeId}
                  onChange={(e) => setIssueFormData({ employeeId: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.employeeId}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-4 py-1.5 rounded-lg text-xs shadow-sm"
                >
                  Generate Signature Hand-off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN PROPERTY MODAL */}
      {isReturnModalOpen && selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider">Close accountability & receive property</h3>
              <button onClick={() => setIsReturnModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleReturnAsset} className="p-5 space-y-4">
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-150 leading-relaxed">
                Collecting returned asset <strong className="text-slate-800 font-mono">{selectedAsset.assetNumber}</strong> from <em className="text-slate-700">{selectedAsset.assignedToName}</em>
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Condition Upon Return *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Scratches on lid, screen in robust working order"
                  value={returnFormData.conditionOnReturn}
                  onChange={(e) => setReturnFormData({ ...returnFormData, conditionOnReturn: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">Clearance Status *</label>
                <select
                  value={returnFormData.clearanceStatus}
                  onChange={(e) => setReturnFormData({ ...returnFormData, clearanceStatus: e.target.value as any })}
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs"
                >
                  <option value="Cleared">Cleared (Returned successfully)</option>
                  <option value="Pending">Pending (Under evaluation)</option>
                  <option value="Disapproved">Disapproved (Damage requires fine or direct replacement)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-4 py-1.5 rounded-lg text-xs shadow-sm"
                >
                  Complete Return & Clear Custody
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
