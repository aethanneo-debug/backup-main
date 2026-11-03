import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { apiCall, getLocalTodayString } from '../utils';
import type { TrainingHistoryRecord } from '../types';
import { readTrainingRecord, readTrainingReview, TRAINING_EARLIEST_DATE } from '../trainingRecord';
import EmployeeTrainingHistory from './training/EmployeeTrainingHistory';
import LiquidationDueBadge from './training/LiquidationDueBadge';

const BLANK_TRAINING = { title: '', organizer: '', dateConducted: '', trainingHours: '', certificateFilename: '' };

export default function TrainingsSeminarsView({ user, employees, onOpenLiquidation }: {
  user: any;
  employees: any;
  /** Opens the Employee Portal's Liquidation Report with this seminar chosen. */
  onOpenLiquidation?: (activityId: string) => void;
}) {
  const isHrOrAdmin = ["Administrator / Division Chief", "HR Officer"].includes(user.role);
  // Everyone else who reaches this page is the employee viewing their own seminars. Only
  // they get a link to the liquidation form: HR/Admin never open one for someone else.
  const isOwnView = !isHrOrAdmin;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(isHrOrAdmin ? "" : user.employeeId);
  // Reloads the training history after HR adds or reviews a record.
  const [historyReload, setHistoryReload] = useState(0);
  const [history, setHistory] = useState([]);
  const [assignedActivities, setAssignedActivities] = useState<any[]>([]);
  
  // By the internal id once known: HR's dropdown holds staff codes, and a staff code set to another record's internal id
  // (7j) would otherwise open that person's history, or add a record to it, under this one's name.
  const employeeKey = employees?.find((e: any) => e.employeeId === selectedEmployeeId)?.id ?? selectedEmployeeId;

  const [isModalOpen, setIsModalOpen] = useState(false);
  // The boxes' text: the hours stay as typed until they are checked, so a cleared box isn't NaN.
  const [newTraining, setNewTraining] = useState(BLANK_TRAINING);
  const [addProblem, setAddProblem] = useState("");
  const [adding, setAdding] = useState(false);

  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [verifyRemarks, setVerifyRemarks] = useState("");
  const [reviewProblem, setReviewProblem] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchHistory();
      fetchAssignedActivities();
    } else {
      setHistory([]);
      setAssignedActivities([]);
    }
  }, [selectedEmployeeId]);

  
  const fetchAssignedActivities = async () => {
    try {
      const res = await apiCall(`/api/employees/${selectedEmployeeId}/assigned_activities`);
      if (res.status === 'success') {
        setAssignedActivities(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load assigned activities", err);
    }
  };


  const fetchHistory = async () => {
    try {
      const res = await apiCall(`/api/employees/${selectedEmployeeId}/history`);
      const data = res.data || res;
      if (Array.isArray(data)) {
        const mapped = data.map((h: any) => ({
          id: h.id,
          effectiveDate: h.effective_date || h.effectiveDate,
          action: h.action,
          newDetails: h.new_details || h.newDetails,
          updatedBy: h.updated_by || h.updatedBy
        }));
        setHistory(mapped);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const openAddModal = () => {
    setAddProblem("");
    setIsModalOpen(true);
  };

  const handleAddEntry = async () => {
    if (adding) return;
    // The same checks as the server (src/trainingRecord.ts), which has the last word.
    const fields = readTrainingRecord(newTraining, getLocalTodayString());
    if ("problem" in fields) {
      setAddProblem(fields.problem);
      return;
    }
    setAdding(true);
    setAddProblem("");
    try {
      await apiCall(`/api/employees/${encodeURIComponent(employeeKey)}/trainings`, {
        method: "POST",
        body: JSON.stringify(fields)
      });
      setIsModalOpen(false);
      setNewTraining(BLANK_TRAINING);
      setHistoryReload(n => n + 1);
    } catch (err) {
      setAddProblem(err?.message || "The record couldn't be saved.");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedTraining || reviewing) return;
    const review = readTrainingReview({ status, remarks: verifyRemarks });
    if ("problem" in review) {
      setReviewProblem(review.problem);
      return;
    }
    setReviewing(true);
    setReviewProblem("");
    try {
      await apiCall(`/api/trainings/${encodeURIComponent(selectedTraining.id)}/status`, {
        method: "PUT",
        body: JSON.stringify(review)
      });
      setVerifyModalOpen(false);
      setSelectedTraining(null);
      setVerifyRemarks("");
      setHistoryReload(n => n + 1);
    } catch (err) {
      setReviewProblem(err?.message || "The review couldn't be saved.");
    } finally {
      setReviewing(false);
    }
  };

  // The box starts empty: a verified record mustn't keep the reason it was returned for. That reason shows above it.
  const openVerifyModal = (training) => {
    setSelectedTraining(training);
    setVerifyRemarks("");
    setReviewProblem("");
    setVerifyModalOpen(true);
  };

  // What an HR record's card adds here, from the table it replaced: HR's and the Administrator's Review.
  const recordExtra = (row: TrainingHistoryRecord) => {
    if (!isHrOrAdmin || row.status === 'Verified') return null;
    return (
      <div className="flex justify-end border-t border-slate-100 pt-2">
        <button
          type="button"
          data-history-review
          onClick={() => openVerifyModal({ id: row.id, title: row.title, organizer: row.organizer, dateConducted: row.dateConducted, trainingHours: row.hours, remarks: row.remarks })}
          className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Review<span className="sr-only"> {row.title}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto w-full relative">
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Trainings & Seminars</h1>
            <p className="text-xs text-slate-500 mt-1">Official learning interventions and adjudicated employment history.</p>
          </div>
        </div>

        {isHrOrAdmin && (
          <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 flex items-center gap-4 shadow-sm">
            <label className="text-xs font-bold text-slate-600 uppercase">Select Target Employee:</label>
            <select className="border border-slate-300 rounded p-2 text-xs w-64 bg-slate-50" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
              <option value="">-- Choose Employee --</option>
              {employees?.map(emp => (
                <option key={emp.employeeId} value={emp.employeeId}>{emp.fullName}</option>
              ))}
            </select>
          </div>
        )}

        {!selectedEmployeeId ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-8 text-center rounded-lg shadow-sm">
            <p className="font-semibold text-sm">Please select an employee to view their Trainings and Employment History.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 space-y-6">
              
              {/* Personnel Information Summary */}
              {(() => {
                const emp = employees?.find(e => e.employeeId === selectedEmployeeId);
                if (!emp) return null;
                
                const renderReadOnlyField = (label, value) => (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
                    <input type="text" readOnly value={value || ''} className="border border-slate-300 bg-slate-50 p-2 text-xs rounded w-full text-slate-700" />
                  </div>
                );

                return (
                  <div className="space-y-4">
                    <div className="border-b pb-2 mb-4">
                      <h4 className="text-sm font-bold uppercase text-slate-700">Personnel Information</h4>
                      <p className="text-[10px] text-slate-500">Basic details of the selected employee.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {renderReadOnlyField('Plantilla No.', emp.plantillaNumber || "N/A – Non-Plantilla")}
                      <div className="md:col-span-3">
                        {renderReadOnlyField('Full Name', emp.fullName)}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderReadOnlyField('Position', emp.position)}
                      {renderReadOnlyField('Division / Office', emp.division)}
                    </div>
                  </div>
                );
              })()}

              
              {/* Assigned Activities */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="border-b pb-2 mb-4">
                  <h2 className="text-sm font-bold text-slate-700 uppercase">Assigned Activities & Liquidation</h2>
                  <p className="text-[10px] text-slate-500">
                    {isOwnView
                      ? "Seminars assigned by HR. Once HR records your attendance, click the seminar's title to open its liquidation form."
                      : "Seminars assigned by HR. HR records attendance in Training Plan & Budget; only attendees get a liquidation form."}
                  </p>
                </div>
                
                {assignedActivities.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded text-center text-slate-500 text-xs italic">
                    No active assigned activities or pending liquidations.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assignedActivities.map(activity => (
                      <div
                        key={activity.id}
                        className={`rounded-lg p-4 shadow-sm flex flex-col justify-between border ${
                          activity.status === "Liquidated"
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-blue-200 bg-blue-50/50"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            {/* The title opens the liquidation form, for the employee's own
                                seminar and only once HR has recorded them as attending. */}
                            {isOwnView && activity.canLiquidate && onOpenLiquidation ? (
                              <button
                                type="button"
                                onClick={() => onOpenLiquidation(activity.id)}
                                className="cursor-pointer text-left font-bold text-sm text-blue-800 underline decoration-dotted underline-offset-2 hover:text-blue-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                                title="Open this seminar's liquidation form"
                              >
                                {activity.title}
                              </button>
                            ) : (
                              <h3 className={`font-bold text-sm ${activity.status === "Liquidated" ? "text-emerald-900" : "text-blue-900"}`}>
                                {activity.title}
                              </h3>
                            )}
                            {/* Settled seminars stay listed so the employee can see their own
                                completed record; amber would wrongly read as still pending. */}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              activity.status === "Liquidated"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {activity.status}
                            </span>
                          </div>
                          {/* Seminars created since the Category column was dropped have none;
                              older ones keep showing theirs. */}
                          {String(activity.category ?? "").trim() && (
                            <div className="text-xs text-slate-600 mb-1">
                              <span className="font-semibold text-slate-700">Category:</span> {activity.category}
                            </div>
                          )}
                          <div className="text-xs text-slate-600 mb-1">
                            <span className="font-semibold text-slate-700">Date:</span> {activity.dateConducted} ({activity.startTime} - {activity.endTime})
                          </div>
                          <div className="text-xs text-slate-600 mb-3">
                            <span className="font-semibold text-slate-700">Allocated Budget:</span> ₱{activity.allocatedBudget?.toLocaleString(undefined, {minimumFractionDigits:2})}
                          </div>
                          {activity.status === "Assigned" && (
                            <div className="mb-3">
                              <LiquidationDueBadge dueDate={activity.liquidationDueDate} />
                            </div>
                          )}
                        </div>
                        
                        {/* Attendance, recorded by HR. Only attendees get a liquidation form:
                            the employee opens it from the title above. */}
                        <div className="pt-3 border-t border-blue-200 mt-2 space-y-1">
                          <p className="text-[10px] text-slate-600">
                            <span className="font-semibold text-slate-700">Attendance:</span>{" "}
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                              activity.attendance === "Attended" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : activity.attendance === "Did not attend" ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }`}>
                              {activity.attendance || "Not recorded"}
                            </span>
                          </p>
                          {activity.status === "Liquidation Pending" ? (
                            <p className="text-[10px] text-amber-700 font-semibold italic">Liquidation report filed. Awaiting review.</p>
                          ) : isOwnView && activity.canLiquidate ? (
                            <p className="text-[10px] text-blue-700 font-semibold">Click the title to open your liquidation form.</p>
                          ) : isOwnView && activity.liquidationBlockedReason && activity.status !== "Liquidated" ? (
                            <p className="text-[10px] text-slate-500 italic">{activity.liquidationBlockedReason}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4 border-b pb-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-700 uppercase">Training History</h2>
                    <p className="text-[10px] text-slate-500">
                      {isOwnView ? "Every seminar you were seated in and every training HR recorded for you" : "Every seminar this employee was seated in and every training HR recorded for them"}, newest first: attendance, the certificate, the cash advance and the liquidation report.
                    </p>
                  </div>
                  {/* HR and the Administrator: the server refuses anyone else. */}
                  {isHrOrAdmin && (
                    <button
                      onClick={openAddModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold uppercase shadow transition"
                    >
                      + Add Training Record
                    </button>
                  )}
                </div>

                {/* In place of the "Completed Trainings History" table, which listed only liquidated seminars
                    (the instructor's review, R11). HR's records are here too, with their remarks and Review. */}
                <EmployeeTrainingHistory employeeKey={employeeKey} reloadKey={historyReload} recordExtra={recordExtra} />
              </div>

              <div className="space-y-4">
                <div className="border-b pb-2 mb-4">
                  <h2 className="text-sm font-bold text-slate-700 uppercase">Employment Service Records</h2>
                  <p className="text-[10px] text-slate-500">Service records trace your entire employment history. System-generated through administrative HR actions.</p>
                </div>
                
                <table className="w-full text-left text-xs border-collapse bg-white border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-2">Effective Date</th>
                      <th className="p-2">Action / Position</th>
                      <th className="p-2">Remarks / Details</th>
                      <th className="p-2">Updated By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, idx) => (
                      <tr key={h.id || idx} className="border-b border-slate-100">
                        <td className="p-2 whitespace-nowrap">{h.effectiveDate}</td>
                        <td className="p-2 font-semibold text-slate-700">{h.action}</td>
                        <td className="p-2">{h.newDetails}</td>
                        <td className="p-2">{h.updatedBy}</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">No employment history events logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Training Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-wide">RECORD A TRAINING / SEMINAR</h3>
              {/* Not while the record is being saved: its answer belongs to this form. */}
              <button onClick={() => setIsModalOpen(false)} disabled={adding} aria-label="Close" className="hover:text-slate-300 disabled:opacity-50"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 border border-blue-100 font-medium">
                Record will be attached to: <strong>{(() => {
                  const emp = employees?.find(e => e.id === selectedEmployeeId || e.employeeId === selectedEmployeeId);
                  return emp ? `${emp.fullName} (${emp.plantillaNumber || "N/A – Non-Plantilla"})` : selectedEmployeeId;
                })()}</strong>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Training Title *</label>
                <input type="text" placeholder="e.g. Adjudication Fundamentals" className="w-full border border-slate-300 p-2 text-xs rounded focus:border-blue-500 outline-none" value={newTraining.title} onChange={(e) => setNewTraining({...newTraining, title: e.target.value})}/>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Organizing Agency *</label>
                <input type="text" placeholder="e.g. Civil Service Commission" className="w-full border border-slate-300 p-2 text-xs rounded focus:border-blue-500 outline-none" value={newTraining.organizer} onChange={(e) => setNewTraining({...newTraining, organizer: e.target.value})}/>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Date Conducted *</label>
                    <input type="date" min={TRAINING_EARLIEST_DATE} max={getLocalTodayString()} className="w-full border border-slate-300 p-2 text-xs rounded focus:border-blue-500 outline-none" value={newTraining.dateConducted} onChange={(e) => setNewTraining({...newTraining, dateConducted: e.target.value})}/>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Credit Hours *</label>
                    <input type="number" min="0" step="0.5" className="w-full border border-slate-300 p-2 text-xs rounded focus:border-blue-500 outline-none" value={newTraining.trainingHours} onChange={(e) => setNewTraining({...newTraining, trainingHours: e.target.value})}/>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Certificate File Name (optional)</label>
                <input type="text" placeholder="certificate_2023.pdf" className="w-full border border-slate-300 p-2 text-xs rounded focus:border-blue-500 outline-none" value={newTraining.certificateFilename} onChange={(e) => setNewTraining({...newTraining, certificateFilename: e.target.value})}/>
                <p className="text-[10px] text-slate-500">Only the name is kept with this record, no file.</p>
              </div>

              {addProblem && <p role="alert" data-training-form="problem" className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{addProblem}</p>}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setIsModalOpen(false)} disabled={adding} className="px-4 py-2 bg-slate-100 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 transition disabled:opacity-50">Cancel</button>
                <button onClick={handleAddEntry} disabled={adding} className="px-4 py-2 bg-blue-600 rounded text-xs font-bold text-white hover:bg-blue-700 transition shadow disabled:opacity-50">{adding ? "Saving…" : "Save Record"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verify Training Modal */}
      {verifyModalOpen && selectedTraining && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-wide">HR VERIFICATION</h3>
              {/* Not while the review is being saved: its answer would land on whichever record is open next. */}
              <button onClick={() => setVerifyModalOpen(false)} disabled={reviewing} aria-label="Close" className="hover:text-slate-300 disabled:opacity-50"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded text-xs space-y-1">
                <p><strong>Title:</strong> {selectedTraining.title}</p>
                <p><strong>Organizer:</strong> {selectedTraining.organizer}</p>
                <p><strong>Hours:</strong> {selectedTraining.trainingHours} | <strong>Date:</strong> {selectedTraining.dateConducted}</p>
                {selectedTraining.remarks && <p data-training-review="earlier"><strong>Returned before:</strong> {selectedTraining.remarks}</p>}
              </div>

              {/* What each button does to the record (the user's decision of 2026-11-03). */}
              <p className="text-[11px] text-slate-600">
                Verify confirms the record. Return marks it as wrong: it stops counting toward the year&rsquo;s training, Plan D
                and who was already sent to a training, and the printed PDS leaves it out, but it stays in the history with your
                reason. To correct it, record the training again.
              </p>

              <div className="space-y-1">
                <label htmlFor="training-review-remarks" className="text-[10px] font-bold text-slate-500 uppercase">Remarks (the employee can read these)</label>
                <textarea
                  id="training-review-remarks"
                  className="w-full border border-slate-300 p-2 text-xs rounded h-24 focus:border-blue-500 outline-none"
                  placeholder="Optional to verify. Required to return: say what is wrong."
                  value={verifyRemarks}
                  onChange={(e) => setVerifyRemarks(e.target.value)}
                />
              </div>

              {reviewProblem && <p role="alert" data-training-review="problem" className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{reviewProblem}</p>}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button onClick={() => handleUpdateStatus("Verified")} disabled={reviewing} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow disabled:opacity-50">
                  <CheckCircle size={16} /> Verify & Approve
                </button>
                <button onClick={() => handleUpdateStatus("Returned")} disabled={reviewing} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow disabled:opacity-50">
                  <XCircle size={16} /> Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
