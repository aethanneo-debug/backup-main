import React, { useState, useEffect } from "react";
import { UserRole, TrainingProgram, TrainingParticipant, TrainingLiquidationExpense, Employee } from "../types";
import { apiCall } from "../utils";
import { BookOpen, Calendar, DollarSign, Users, Plus, Target, Building, FileText, CheckCircle2, ChevronRight, Edit2, Trash2, Save, X, AlertTriangle, PieChart, ClipboardCheck } from "lucide-react";
import ParticipantPickerModal, { PickerProgram } from "./training/ParticipantPickerModal";
import NeedCoverageModal from "./training/NeedCoverageModal";
import TrainingNeedsPlanA from "./training/TrainingNeedsPlanA";
import TrainingMonitoringPlanD from "./training/TrainingMonitoringPlanD";
import TrainingEvaluationsDesk from "./training/evaluation/TrainingEvaluationsDesk";

// The four steps of the cycle, in the order the office works through them.
const TAB_BLURB: Record<string, string> = {
  "plan-a": "Step 1 — list what each employee still needs.",
  "programs": "Step 2 — run the seminar: create it, link it to the plan, pick participants.",
  "plan-d": "Step 3 — see which needs have been accomplished.",
  "evaluations": "Step 4 — evaluate what each participant brought back from the seminar."
};

// Shared with the Plan A / Plan D sheets so all three tabs read as one document.
const CELL_INPUT = "w-full border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none";
const CHIP_BTN = "text-[10px] font-semibold bg-white border border-slate-300 text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 flex items-center gap-1.5";

export default function TrainingDevelopmentView({ user, triggerRefresh }: { user: any, triggerRefresh: () => void }) {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [activeFy, setActiveFy] = useState<any>(null);
  const [trainingBudgets, setTrainingBudgets] = useState<any[]>([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newAnnualBudget, setNewAnnualBudget] = useState("");
  const [participants, setParticipants] = useState<TrainingParticipant[]>([]);
  const [liquidations, setLiquidations] = useState<TrainingLiquidationExpense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Opens on Plan A: the plan is written before the seminars that answer it.
  const [activeTab, setActiveTab] = useState<"programs" | "plan-a" | "plan-d" | "evaluations">("plan-a");
  const [coverageModalData, setCoverageModalData] = useState<{ rowId: string; isNew: boolean; seminarTitle: string; fiscalYear?: string; selectedTitles: string[] } | null>(null);
  const [showLiqModal, setShowLiqModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  
  // Table editing state
  const [editingRows, setEditingRows] = useState<{ [key: string]: any }>({});
  const [newRows, setNewRows] = useState<any[]>([]);
  const [showParticipantModal, setShowParticipantModal] = useState<string | null>(null); // row id or "new-index"
  const [participantModalData, setParticipantModalData] = useState<{ program: PickerProgram; selectedIds: string[] } | null>(null);
  
  const [showBreakdownModal, setShowBreakdownModal] = useState<string | null>(null);
  const [breakdownData, setBreakdownData] = useState<{ category: string; total: number }[]>([]);
  const [breakdownProgram, setBreakdownProgram] = useState<any>(null);
  const [breakdownTotal, setBreakdownTotal] = useState<number>(0);
  const [perParticipant, setPerParticipant] = useState<number>(0);
  const [perParticipantSplit, setPerParticipantSplit] = useState<{ category: string; percentage: number; amount: number }[]>([]);
  const [personBreakdown, setPersonBreakdown] = useState<{ employeeId: string | null; name: string; total: number }[]>([]);
  
  // Liquidation form
  const [expenseCategory, setExpenseCategory] = useState("Meals");
  const [liqDesc, setLiqDesc] = useState("");
  const [liqAmount, setLiqAmount] = useState("");
  const [liqDate, setLiqDate] = useState("");
  const [liqParticipantId, setLiqParticipantId] = useState("");
  const [liqError, setLiqError] = useState("");
  const [liqSubmitting, setLiqSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const fyRes = await apiCall("/api/fiscal-years/active");
    if (fyRes && !fyRes.error) setActiveFy(fyRes);

    const bRes = await apiCall("/api/training/budgets");
    if (bRes.status === "success") setTrainingBudgets(bRes.data);

    const pRes = await apiCall("/api/training/programs");
    if (pRes.status === "success") setPrograms(pRes.data);
    
    const partRes = await apiCall("/api/training/participants");
    if (partRes.status === "success") setParticipants(partRes.data);
    
    const lRes = await apiCall("/api/training/liquidations");
    if (lRes.status === "success") setLiquidations(lRes.data);

    const empRes = await apiCall("/api/employees");
    if (empRes.status === "success") setEmployees(empRes.data);
  }

  async function handleSetAnnualBudget(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      fiscalYearId: activeFy?.id || "fy-1",
      newAnnualBudget: newAnnualBudget
    };
    const res = await apiCall("/api/training/budgets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (res.status === "success") {
      setShowBudgetModal(false);
      fetchData();
      triggerRefresh();
    } else {
      alert("Error: " + res.message);
    }
  }

  const activeTb = trainingBudgets.find(b => b.fiscalYearId === (activeFy?.id || "fy-1"));
  const activeBudget = activeTb?.totalBudget || 0;
  const activeCarryOver = activeTb?.carryOverBudget || 0;
  const activeNewAnnual = activeTb?.newAnnualBudget !== undefined ? activeTb.newAnnualBudget : (activeBudget - activeCarryOver);

  const activePrograms = programs.filter(p => p.fiscalYear === (activeFy?.label || "2026"));
  
  // Calculate total allocated
  const existingAllocated = activePrograms.reduce((sum, p) => sum + Number(p.allocatedBudget), 0);
  
  // Add new rows allocated budget + editing rows changes
  let draftTotalAllocated = existingAllocated;
  activePrograms.forEach(p => {
    if (editingRows[p.id]) {
      draftTotalAllocated += (Number(editingRows[p.id].allocatedBudget || 0) - Number(p.allocatedBudget));
    }
  });
  newRows.forEach(nr => {
    draftTotalAllocated += Number(nr.allocatedBudget || 0);
  });
  
  const remainingAnnualBudget = activeBudget - draftTotalAllocated;

  const handleAddRow = () => {
    const newId = `new-${Date.now()}`;
    setNewRows([...newRows, {
      id: newId,
      title: "",
      description: "",
      category: "Technical",
      allocatedBudget: 0,
      startDate: "",
      endDate: "",
      startTime: "08:00",
      endTime: "17:00",
      venue: "",
      facilitator: "",
      maxParticipants: 1,
      targetDivision: "",
      participantIds: [],
      fulfillsNeedTitles: [],
      fiscalYear: activeFy?.label || "2026"
    }]);
  };

  const handleSaveRow = async (id: string, isNew: boolean) => {
    const row = isNew ? newRows.find(r => r.id === id) : editingRows[id];
    if (!row) return;

    if (!row.title || !row.startDate || !row.endDate) {
      alert("Please fill in the required fields (Title, Start Date, End Date).");
      return;
    }

    if (new Date(row.endDate) < new Date(row.startDate)) {
      alert("End Date cannot be earlier than Start Date.");
      return;
    }

    if (remainingAnnualBudget < 0) {
      alert("Error: Total allocated budget exceeds the available fiscal year budget. Please adjust allocations.");
      return;
    }

    let endpoint = "/api/training/programs";
    let method = "POST";
    if (!isNew) {
      endpoint = `/api/training/programs/${id}`;
      method = "PUT";
    }

    let res;
    try {
      res = await apiCall(endpoint, {
        method,
        body: JSON.stringify(row)
      });
    } catch (err: any) {
      alert("Error saving training program: " + err.message);
      return;
    }

    if (res && res.status === "success") {
      if (isNew) {
        setNewRows(newRows.filter(r => r.id !== id));
      } else {
        const updated = { ...editingRows };
        delete updated[id];
        setEditingRows(updated);
      }
      fetchData();
      triggerRefresh();
      // The server enforces capacity and eligibility on save; tell HR who was left out.
      if (res.message) {
        alert("Saved, with notes:\n\n" + res.message);
      }
    } else {
      alert("Error: " + res.message);
    }
  };

  const handleDeleteProgram = async (id: string, isNew: boolean) => {
    if (isNew) {
      setNewRows(newRows.filter(r => r.id !== id));
      return;
    }
    if (!confirm("Are you sure you want to delete this training program?")) return;
    
    const res = await apiCall(`/api/training/programs/${id}`, { method: "DELETE" });
    if (res.status === "success") {
      fetchData();
      triggerRefresh();
    } else {
      alert("Error: " + res.message);
    }
  };

  const startEditing = (p: TrainingProgram) => {
    setEditingRows({
      ...editingRows,
      [p.id]: {
        ...p,
        participantIds: participants.filter(part => part.trainingProgramId === p.id).map(part => part.employeeId)
      }
    });
  };

  const updateRow = (id: string, field: string, value: any, isNew: boolean) => {
    if (isNew) {
      setNewRows(newRows.map(r => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          if (field === 'startDate' && updated.endDate && new Date(updated.endDate) < new Date(value)) {
            updated.endDate = value;
          }
          if (field === 'endDate' && updated.startDate && new Date(value) < new Date(updated.startDate)) {
            updated.startDate = value;
          }
          return updated;
        }
        return r;
      }));
    } else {
      const current = editingRows[id];
      const updated = { ...current, [field]: value };
      if (field === 'startDate' && updated.endDate && new Date(updated.endDate) < new Date(value)) {
        updated.endDate = value;
      }
      if (field === 'endDate' && updated.startDate && new Date(value) < new Date(updated.startDate)) {
        updated.startDate = value;
      }
      setEditingRows({ ...editingRows, [id]: updated });
    }
  };

  const openParticipantModal = (rowId: string, isNew: boolean) => {
    let row = isNew ? newRows.find(r => r.id === rowId) : (editingRows[rowId] || programs.find(p => p.id === rowId));
    if (!row) return;
    // Either source will do: the ticked plan need names the seminar when the title
    // is still blank, and the recommender needs one of them to rank against.
    const coveredNeeds: string[] = row.fulfillsNeedTitles || [];
    const rankAgainst = (row.title || "").trim() || coveredNeeds[0];
    if (!rankAgainst) {
      alert("Tick the plan need this seminar covers, or enter a title, so participants can be recommended.");
      return;
    }

    // Ranking and eligibility come from the server (GET /api/training/recommendations),
    // so the picker can never offer someone the server would refuse on save.
    const program: PickerProgram = {
      id: rowId,
      isNew,
      title: rankAgainst,
      fiscalYear: row.fiscalYear,
      targetDivision: row.targetDivision,
      targetSpecialization: row.targetSpecialization,
      maxParticipants: row.maxParticipants,
      fulfillsNeedTitles: row.fulfillsNeedTitles || []
    };
    setParticipantModalData({ program, selectedIds: row.participantIds || [] });
    setShowParticipantModal(rowId);
  };

  // Which Plan A entries this seminar answers. Stored on the draft row like
  // participantIds and sent with the save.
  const openCoverageModal = (rowId: string, isNew: boolean) => {
    const row = isNew ? newRows.find(r => r.id === rowId) : (editingRows[rowId] || programs.find(p => p.id === rowId));
    if (!row) return;
    setCoverageModalData({
      rowId,
      isNew,
      seminarTitle: row.title || "",
      fiscalYear: row.fiscalYear,
      selectedTitles: row.fulfillsNeedTitles || []
    });
  };

  const handleSaveCoverage = (titles: string[]) => {
    if (!coverageModalData) return;
    const { rowId, isNew } = coverageModalData;

    // The seminar is named after the need it answers — but only while HR hasn't
    // written their own title. `autoTitle` remembers what was filled in last, so a
    // title the officer typed is never overwritten.
    // All fields go in ONE state update: updateRow closes over the current render's
    // state, so separate calls would overwrite each other.
    const patchRow = (r: any) => {
      const typed = (r.title || "").trim();
      const canAutofill = !typed || typed === (r.autoTitle || "");
      return titles.length > 0 && canAutofill
        ? { ...r, fulfillsNeedTitles: titles, title: titles[0], autoTitle: titles[0] }
        : { ...r, fulfillsNeedTitles: titles };
    };

    if (isNew) {
      setNewRows(prev => prev.map(r => (r.id === rowId ? patchRow(r) : r)));
    } else {
      setEditingRows(prev => ({ ...prev, [rowId]: patchRow(prev[rowId] || {}) }));
    }
    setCoverageModalData(null);
  };

  const handleSaveParticipants = (selectedIds: string[]) => {
    if (!participantModalData) return;
    const { program } = participantModalData;
    updateRow(program.id, "participantIds", selectedIds, program.isNew);
    setShowParticipantModal(null);
    setParticipantModalData(null);
  };

  const openBreakdownModal = async (p: any) => {
    setBreakdownProgram(p);
    const res = await apiCall(`/api/training/liquidations?trainingProgramId=${p.id}`);
    if (res.status === "success") {
      setBreakdownData(res.breakdown || []);
      const sum = (res.breakdown || []).reduce((acc: number, curr: any) => acc + curr.total, 0);
      setBreakdownTotal(sum);
      setPerParticipant(res.perParticipant || 0);
      setPerParticipantSplit(res.perParticipantSplit || []);
      setPersonBreakdown(res.personBreakdown || []);
      setShowBreakdownModal(p.id);
    }
  };

  const openLiqModal = (p: any) => {
    setSelectedProgramId(p.id);
    setExpenseCategory("Meals");
    setLiqDesc("");
    setLiqAmount("");
    setLiqParticipantId("");
    setLiqError("");
    setLiqDate(new Date().toISOString().split("T")[0]);
    setShowLiqModal(true);
  };

  // Remaining budget for the program currently open in the liquidation modal.
  const liqProgram = programs.find(p => p.id === selectedProgramId);
  const liqAlreadyFiled = liquidations
    .filter(l => l.trainingProgramId === selectedProgramId)
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const liqRemaining = liqProgram ? Number(liqProgram.allocatedBudget) - liqAlreadyFiled : 0;
  const liqExceeds = Number(liqAmount) > 0 && Number(liqAmount) > liqRemaining;

  async function handleCreateLiquidation(e: React.FormEvent) {
    e.preventDefault();
    setLiqError("");

    // Mirror the server rule locally so the user is told before submitting.
    if (liqExceeds) {
      setLiqError("Liquidation exceeds allocated training budget.");
      return;
    }

    const payload = {
      trainingProgramId: selectedProgramId,
      trainingParticipantId: liqParticipantId || undefined,
      expenseCategory,
      description: liqDesc,
      amount: liqAmount,
      dateIncurred: liqDate
    };

    setLiqSubmitting(true);
    try {
      // apiCall throws on a non-2xx response, so the server's message only
      // reaches the user through this catch.
      const res = await apiCall("/api/training/liquidations", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (res.status === "success") {
        setShowLiqModal(false);
        fetchData();
        triggerRefresh();
      } else {
        setLiqError(res.message || "Failed to file the liquidation expense.");
      }
    } catch (err: any) {
      setLiqError(err.message || "Failed to file the liquidation expense.");
    } finally {
      setLiqSubmitting(false);
    }
  }

  const renderRow = (p: any, isNew: boolean) => {
    const isEditing = isNew || !!editingRows[p.id];
    const row = isEditing ? (isNew ? p : editingRows[p.id]) : p;
    
    // For participants, if viewing, we show count. If editing, we show a button.
    const partsCount = isEditing ? (row.participantIds ? row.participantIds.length : 0) : participants.filter(part => part.trainingProgramId === p.id).length;

    return (
      <tr key={p.id} className={`align-top hover:bg-slate-50/60 ${isEditing ? 'bg-blue-50/40' : ''}`}>
        {/* 1. The plan need comes first: it ranks the participants and names the seminar. */}
        <td className="p-2 border-r border-slate-100 min-w-[150px]">
          {isEditing ? (
            <div className="space-y-1">
              <button onClick={() => openCoverageModal(p.id, isNew)} className={CHIP_BTN}>
                <Target size={12} /> Covers {(row.fulfillsNeedTitles || []).length} plan need{(row.fulfillsNeedTitles || []).length === 1 ? "" : "s"}
              </button>
              {(row.fulfillsNeedTitles || []).map((t: string) => (
                <div key={t} className="px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold leading-snug">{t}</div>
              ))}
            </div>
          ) : (
            (p.fulfillsNeedTitles || []).length > 0 ? (
              <div className="space-y-1">
                {p.fulfillsNeedTitles.map((t: string) => (
                  <div key={t} className="px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold leading-snug">{t}</div>
                ))}
              </div>
            ) : (
              /* A seminar with no covered need can never mark anything accomplished in
                 Plan D, and its participants lose the "Needs this" ranking. That used to
                 read as grey italic small print, which is how it went unnoticed. */
              <div className="rounded border border-amber-200 bg-amber-50 px-1.5 py-1 leading-snug">
                <span className="block text-[10px] font-semibold text-amber-800">Not linked to the plan</span>
                <span className="block text-[9px] text-amber-700">
                  Edit this row and tick the need it answers &mdash; otherwise Plan D can never
                  mark it accomplished.
                </span>
              </div>
            )
          )}
        </td>

        {/* 2. Participants, ranked by that need. */}
        <td className="p-2 border-r border-slate-100">
           {isEditing ? (
             <div className="flex flex-col gap-1.5 items-start">
               <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                 Max <input type="number" className={`${CELL_INPUT} w-16`} value={row.maxParticipants} onChange={e => updateRow(p.id, "maxParticipants", e.target.value, isNew)} />
               </div>
               <button onClick={() => openParticipantModal(p.id, isNew)} className={CHIP_BTN}>
                 <Users size={12} /> {partsCount} Selected
               </button>
             </div>
           ) : (
             <div className="text-slate-600">
               <div className="mb-1 font-semibold flex items-center gap-2">
                 {partsCount} / {p.maxParticipants}
                 {partsCount === 0 && (
                   <span className="px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold flex items-center gap-1">
                     <AlertTriangle size={10} /> Needs Participants
                   </span>
                 )}
               </div>
               {participants.filter(part => part.trainingProgramId === p.id).length > 0 && (
                 <div className="flex flex-wrap gap-1 mt-1">
                   {participants.filter(part => part.trainingProgramId === p.id).map(part => {
                     const emp = employees.find(e => e.id === part.employeeId);
                     return emp ? (
                       <span key={part.id} className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-100 truncate max-w-[120px]" title={emp.fullName}>
                         {emp.fullName.split(' ')[0]}
                       </span>
                     ) : null;
                   })}
                 </div>
               )}
             </div>
           )}
        </td>

        {/* 3. Title — filled from the plan need, still editable. */}
        <td className="p-2 border-r border-slate-100 min-w-[140px]">
          {isEditing ? (
            <input type="text" value={row.title} onChange={e => updateRow(p.id, "title", e.target.value, isNew)} className={CELL_INPUT} placeholder="Title" />
          ) : (
            <div className="font-semibold text-slate-800">{p.title}</div>
          )}
        </td>
        <td className="p-2 border-r border-slate-100 min-w-[180px]">
          {isEditing ? (
            <input type="text" value={row.description} onChange={e => updateRow(p.id, "description", e.target.value, isNew)} className={CELL_INPUT} placeholder="Description" />
          ) : (
            <div className="text-slate-600 truncate max-w-[200px]">{p.description}</div>
          )}
        </td>
        <td className="p-2 border-r border-slate-100">
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <select value={row.category} onChange={e => updateRow(p.id, "category", e.target.value, isNew)} className={CELL_INPUT}>
                <option>Technical</option>
                <option>Leadership</option>
                <option>Administrative</option>
                <option>Legal/Judicial</option>
                <option>Mandatory</option>
              </select>
              <select value={row.targetDivision || ""} onChange={e => updateRow(p.id, "targetDivision", e.target.value, isNew)} className={`${CELL_INPUT} text-slate-600`}>
                <option value="">-- No Target Division --</option>
                <option value="Administrative and Finance Division">Administrative and Finance Division</option>
                <option value="Legal Division">Legal Division</option>
                <option value="Adjudication Division">Adjudication Division</option>
                <option value="Technical Division">Technical Division</option>
              </select>
              <input type="text" value={row.targetSpecialization || ""} onChange={e => updateRow(p.id, "targetSpecialization", e.target.value, isNew)} className={`${CELL_INPUT} text-slate-600`} placeholder="Target Specialization..." />
            </div>
          ) : (
            <div className="flex flex-col gap-1 items-start">
              <span className="px-1.5 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200 text-[10px] font-semibold">{p.category}</span>
              {p.targetDivision && (
                <span className="text-[10px] text-slate-500 font-medium">Div: {p.targetDivision}</span>
              )}
              {p.targetSpecialization && (
                <span className="text-[10px] text-slate-500 font-medium">Spec: {p.targetSpecialization}</span>
              )}
            </div>
          )}
        </td>
        <td className="p-2 border-r border-slate-100">
          {isEditing ? (
            <input type="number" value={row.allocatedBudget} onChange={e => updateRow(p.id, "allocatedBudget", e.target.value, isNew)} className={CELL_INPUT} placeholder="0.00" />
          ) : (
            <div className="font-bold text-slate-800">₱{Number(p.allocatedBudget).toLocaleString()}</div>
          )}
        </td>
        <td className="p-2 border-r border-slate-100 whitespace-nowrap">
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <input type="date" value={row.startDate} min={new Date().toISOString().split('T')[0]} onChange={e => updateRow(p.id, "startDate", e.target.value, isNew)} className={`${CELL_INPUT} w-32`} />
                <input type="time" value={row.startTime} onChange={e => updateRow(p.id, "startTime", e.target.value, isNew)} className={`${CELL_INPUT} w-24`} />
              </div>
              <div className="flex items-center gap-1">
                <input type="date" value={row.endDate} min={row.startDate || new Date().toISOString().split('T')[0]} onChange={e => updateRow(p.id, "endDate", e.target.value, isNew)} className={`${CELL_INPUT} w-32 ${row.endDate && row.startDate && new Date(row.endDate) < new Date(row.startDate) ? 'border-rose-500' : ''}`} />
                <input type="time" value={row.endTime} onChange={e => updateRow(p.id, "endTime", e.target.value, isNew)} className={`${CELL_INPUT} w-24`} />
              </div>
            </div>
          ) : (
            <div className="text-slate-600">
              {p.startDate} {p.startTime} <br/>to {p.endDate} {p.endTime}
              <div className="mt-1 font-semibold text-indigo-700">({p.totalHours} hrs)</div>
            </div>
          )}
        </td>
        <td className="p-2 border-r border-slate-100">
          {isEditing ? (
            <input type="text" value={row.facilitator} onChange={e => updateRow(p.id, "facilitator", e.target.value, isNew)} className={CELL_INPUT} placeholder="Facilitator" />
          ) : (
            <div className="text-slate-600 truncate max-w-[150px]">{p.facilitator || "N/A"}</div>
          )}
        </td>
        <td className="p-2 whitespace-nowrap">
          {isEditing ? (
            <div className="flex gap-1.5">
              <button onClick={() => handleSaveRow(p.id, isNew)} className="p-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100" title="Save">
                <Save size={14} />
              </button>
              <button onClick={() => handleDeleteProgram(p.id, isNew)} className="p-1.5 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100" title={isNew ? "Discard" : "Delete"}>
                <Trash2 size={14} />
              </button>
              {!isNew && (
                <button onClick={() => {
                  const updated = { ...editingRows };
                  delete updated[p.id];
                  setEditingRows(updated);
                }} className="p-1.5 text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200" title="Cancel">
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={() => startEditing(p)} className="p-1.5 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100" title="Edit">
                <Edit2 size={14} />
              </button>
              <button onClick={() => openLiqModal(p)} className="p-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100" title="File Liquidation Expense">
                <FileText size={14} />
              </button>
              <button onClick={() => openBreakdownModal(p)} className="p-1.5 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100" title="Liquidation Breakdown">
                <PieChart size={16} />
              </button>
              <button onClick={() => handleDeleteProgram(p.id, false)} className="p-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100" title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Training Development Plan</h2>
          <p className="text-slate-500">{TAB_BLURB[activeTab]}</p>
        </div>
        {activeTab === "programs" && (
          <div className="flex gap-3">
            {user.role === UserRole.SUPER_ADMIN && (
              <button onClick={() => {
                setNewAnnualBudget(activeNewAnnual.toString());
                setShowBudgetModal(true);
              }} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <DollarSign size={18} /> Set Annual Budget
              </button>
            )}
            <button onClick={handleAddRow} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus size={18} /> Add Training Program
            </button>
          </div>
        )}
      </div>

      {/* Ordered as the work actually flows: plan the needs, run the seminar, monitor the
          result, then evaluate the people who attended. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white p-1 rounded-xl shadow-xs">
        {([
          { key: "plan-a", step: 1, label: "Plan A — Training Needs", icon: <Target size={14} /> },
          { key: "programs", step: 2, label: "Programs & Budget", icon: <BookOpen size={14} /> },
          { key: "plan-d", step: 3, label: "Plan D — Monitoring", icon: <CheckCircle2 size={14} /> },
          { key: "evaluations", step: 4, label: "Evaluations", icon: <ClipboardCheck size={14} /> }
        ] as const).map((tab, i) => (
          <div key={tab.key} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
          <button
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === tab.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 ${
              activeTab === tab.key ? "bg-white text-slate-900" : "bg-slate-200 text-slate-600"
            }`}>{tab.step}</span>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
          </div>
        ))}
      </div>

      {activeTab === "plan-a" && (
        <>
          <TrainingNeedsPlanA />
          <div className="flex justify-end">
            <button onClick={() => setActiveTab("programs")} className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1.5">
              Next: create a seminar for these needs <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
      {activeTab === "plan-d" && (
        <>
          <TrainingMonitoringPlanD />
          <div className="flex justify-end">
            <button onClick={() => setActiveTab("evaluations")} className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer">
              Next: evaluate the participants <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}

      {activeTab === "evaluations" && <TrainingEvaluationsDesk />}

      {activeTab === "programs" && (<>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Fiscal Year Budget ({activeFy?.label || "2026"})</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Carry Over from FY {activeFy ? (Number(activeFy.label) - 1) : "2025"}</span>
            <span className="text-2xl font-bold text-teal-700">₱{activeCarryOver.toLocaleString()}</span>
          </div>
          <div className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">New Annual Budget</span>
            <span className="text-2xl font-bold text-blue-700">₱{activeNewAnnual.toLocaleString()}</span>
          </div>
          <div className="flex flex-col bg-blue-50 p-4 rounded-xl border border-blue-100">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Overall Total Budget</span>
            <span className="text-3xl font-extrabold text-slate-900">₱{activeBudget.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total Allocated</p>
            <h3 className="text-2xl font-bold text-slate-800">₱{draftTotalAllocated.toLocaleString()}</h3>
          </div>
        </div>
        <div className={`bg-white rounded-xl shadow-sm border p-6 flex items-center gap-4 ${remainingAnnualBudget < 0 ? 'border-red-500 bg-red-50' : (remainingAnnualBudget < 50000 ? 'border-orange-500 bg-orange-50' : 'border-slate-200')}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${remainingAnnualBudget < 0 ? 'bg-red-100 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
            {remainingAnnualBudget < 0 ? <AlertTriangle size={24} /> : <Target size={24} />}
          </div>
          <div>
            <p className={`text-sm font-medium mb-1 ${remainingAnnualBudget < 0 ? 'text-red-700' : 'text-slate-500'}`}>Remaining Budget</p>
            <h3 className={`text-2xl font-bold ${remainingAnnualBudget < 0 ? 'text-red-700' : 'text-slate-800'}`}>₱{remainingAnnualBudget.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap justify-between items-center gap-3 pb-3 mb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">Training Programs ({activeFy?.label || "2026"})</h3>
            <p className="text-xs text-slate-500 mt-0.5">Seminars HR runs against the plan. Link each one to the Plan A needs it answers.</p>
          </div>
          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 border border-slate-200 rounded px-2 py-1">
            {activePrograms.length} program{activePrograms.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Ordered as HR works: the plan need drives the ranking, which fills the title. */}
              <tr className="bg-slate-900 text-white uppercase text-[9px] tracking-wide">
                <th className="p-2 border-r border-slate-700">Plan Need</th>
                <th className="p-2 border-r border-slate-700">Participants</th>
                <th className="p-2 border-r border-slate-700">Training Title</th>
                <th className="p-2 border-r border-slate-700">Description</th>
                <th className="p-2 border-r border-slate-700">Category</th>
                <th className="p-2 border-r border-slate-700">Allocated Budget</th>
                <th className="p-2 border-r border-slate-700">Dates</th>
                <th className="p-2 border-r border-slate-700">Facilitator</th>
                <th className="p-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {newRows.map(nr => renderRow(nr, true))}
              {activePrograms.length === 0 && newRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <BookOpen size={48} className="text-slate-300 mb-4" />
                      <p>No training programs found for this fiscal year.</p>
                      <button onClick={handleAddRow} className="mt-4 text-blue-600 hover:underline">Add one now</button>
                    </div>
                  </td>
                </tr>
              )}
              {activePrograms.map(p => renderRow(p, false))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={() => setActiveTab("plan-d")} className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1.5">
          Next: see what has been accomplished <ChevronRight size={14} />
        </button>
      </div>
      </>)}

      {coverageModalData && (
        <NeedCoverageModal
          seminarTitle={coverageModalData.seminarTitle}
          fiscalYear={coverageModalData.fiscalYear}
          selectedTitles={coverageModalData.selectedTitles}
          onConfirm={handleSaveCoverage}
          onClose={() => setCoverageModalData(null)}
        />
      )}

      {showParticipantModal && participantModalData && (
        <ParticipantPickerModal
          program={participantModalData.program}
          initialSelectedIds={participantModalData.selectedIds}
          onConfirm={handleSaveParticipants}
          onClose={() => { setShowParticipantModal(null); setParticipantModalData(null); }}
        />
      )}

      {showLiqModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">File Liquidation Expense</h3>
              <button onClick={() => setShowLiqModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {liqProgram && (
                <div className="mb-5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="text-sm font-bold text-slate-700">{liqProgram.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Allocated ₱{Number(liqProgram.allocatedBudget).toLocaleString()} &middot; Already liquidated ₱{liqAlreadyFiled.toLocaleString()} &middot; Remaining <span className={liqRemaining <= 0 ? "font-bold text-red-600" : "font-bold text-emerald-700"}>₱{Math.max(0, liqRemaining).toLocaleString()}</span>
                  </p>
                </div>
              )}

              {liqError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{liqError}</p>
                </div>
              )}

              <form id="liqForm" onSubmit={handleCreateLiquidation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Charge to</label>
                  <select value={liqParticipantId} onChange={e => setLiqParticipantId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="">Whole program (no specific person)</option>
                    {participants
                      .filter(pt => pt.trainingProgramId === selectedProgramId && pt.status !== "Cancelled")
                      .map(pt => {
                        const emp = employees.find(e => e.id === pt.employeeId || e.employeeId === pt.employeeId);
                        return (
                          <option key={pt.id} value={pt.id}>
                            {emp ? emp.fullName : pt.employeeId}
                          </option>
                        );
                      })}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Leave as "Whole program" for shared costs like venue rental or speaker fees.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expense Category *</label>
                  <select required value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="Meals">Meals</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Accommodation">Accommodation</option>
                    <option value="Materials">Materials</option>
                    <option value="Venue Rental">Venue Rental</option>
                    <option value="Speaker Fees">Speaker Fees</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                  <input required type="text" value={liqDesc} onChange={e => setLiqDesc(e.target.value)} placeholder="e.g. Lunch catering for Day 1" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₱) *</label>
                    <input required type="number" min="0" step="0.01" value={liqAmount} onChange={e => { setLiqAmount(e.target.value); setLiqError(""); }}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:outline-none ${liqExceeds ? "border-red-400 focus:ring-red-500 bg-red-50" : "border-slate-300 focus:ring-blue-500"}`} />
                    {liqExceeds && (
                      <p className="text-xs text-red-600 font-medium mt-1">Liquidation exceeds allocated training budget.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date Incurred *</label>
                    <input required type="date" value={liqDate} onChange={e => setLiqDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowLiqModal(false)} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" form="liqForm" disabled={liqExceeds || liqSubmitting}
                className={`px-4 py-2 rounded-lg text-white ${liqExceeds || liqSubmitting ? "bg-slate-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
                {liqSubmitting ? "Submitting…" : "Submit Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBreakdownModal && breakdownProgram && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Budget and Liquidation</h3>
              <button onClick={() => setShowBreakdownModal(null)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-slate-700">{breakdownProgram.title}</h4>
                <p className="text-xs text-slate-500">Total Program Allocated Budget: ₱{Number(breakdownProgram.allocatedBudget).toLocaleString()}</p>
              </div>

              <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Liquidated to date</h5>

              {breakdownData.length === 0 ? (
                <div className="text-center p-6 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-slate-50">
                  <PieChart size={32} className="mx-auto text-slate-400 mb-2" />
                  <p>No liquidation expenses have been filed for this program yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-slate-600">Expense Category</th>
                        <th className="px-4 py-2 font-semibold text-slate-600 text-right">Amount Liquidated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {breakdownData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{item.category}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">₱{Number(item.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td className="px-4 py-3 text-slate-800">Total Liquidated</td>
                        <td className="px-4 py-3 text-right text-blue-700">₱{Number(breakdownTotal).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {personBreakdown.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Liquidated per Person</h5>
                      <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
                        <tbody className="divide-y divide-slate-100">
                          {personBreakdown.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className={`px-4 py-2 ${item.employeeId ? "text-slate-700" : "text-slate-400 italic"}`}>{item.name}</td>
                              <td className="px-4 py-2 text-right font-medium text-slate-700">₱{Number(item.total).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Visual Bar representation */}
                  <div className="mt-6">
                    <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Budget Utilization</h5>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full ${breakdownTotal > breakdownProgram.allocatedBudget ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, (breakdownTotal / breakdownProgram.allocatedBudget) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-slate-500">
                      <span>₱{Number(breakdownTotal).toLocaleString()} used</span>
                      <span>{((breakdownTotal / Math.max(1, breakdownProgram.allocatedBudget)) * 100).toFixed(1)}% of ₱{Number(breakdownProgram.allocatedBudget).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Planning figure, not spending: the server recomputes this from
                  allocatedBudget / maxParticipants on every request, so it exists from the
                  moment a seminar is created. It sits below the liquidated figures, muted
                  and explicitly labelled, so it can't be read as money already spent. */}
              {perParticipantSplit.length > 0 && (
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <h5 className="text-xs font-semibold text-slate-500 uppercase">Budget plan per participant</h5>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">Not spent</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Planning guide only — the ceiling each participant may claim. Nothing has been
                    liquidated against these figures.
                  </p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-xs text-slate-600">
                        Ceiling per participant &middot; {breakdownProgram.maxParticipants} max
                      </span>
                      <span className="text-sm font-bold text-slate-700">₱{Number(perParticipant).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <table className="w-full text-left text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {perParticipantSplit.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-slate-600">{item.category}</td>
                            <td className="px-4 py-2 text-right text-xs text-slate-400 w-16">{item.percentage}%</td>
                            <td className="px-4 py-2 text-right font-medium text-slate-600 w-32">₱{Number(item.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
              <button onClick={() => setShowBreakdownModal(null)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Set New Annual Budget</h3>
              <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-slate-600"><Plus size={24} className="rotate-45" /></button>
            </div>
            <div className="p-6">
              <form id="budgetForm" onSubmit={handleSetAnnualBudget}>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Annual Budget (₱) *</label>
                <input required type="number" min="0" step="0.01" value={newAnnualBudget} onChange={e=>setNewAnnualBudget(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowBudgetModal(false)} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" form="budgetForm" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
