import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { apiCall } from '../utils';
import LiquidationDueBadge from './training/LiquidationDueBadge';

export default function TrainingsSeminarsView({ user, employees }) {
  const isHrOrAdmin = ["Administrator / Division Chief", "HR Officer"].includes(user.role);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(isHrOrAdmin ? "" : user.employeeId);
  const [trainings, setTrainings] = useState([]);
  const [history, setHistory] = useState([]);
  const [assignedActivities, setAssignedActivities] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTraining, setNewTraining] = useState({
    title: '', organizer: '', dateConducted: '', trainingHours: 0, certificateFilename: ''
  });

  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [verifyRemarks, setVerifyRemarks] = useState("");

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchTrainings();
      fetchHistory();
      fetchAssignedActivities();
    } else {
      setTrainings([]);
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

  const handleLiquidate = async (participantId) => {
    try {
      const res = await apiCall(`/api/employees/${selectedEmployeeId}/liquidate_activity/${participantId}`, {
        method: "POST"
      });
      if (res.status === "success") {
        alert("Liquidation documents submitted successfully.");
        fetchAssignedActivities();
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const fetchTrainings = async () => {
    try {
      const res = await apiCall(`/api/employees/${selectedEmployeeId}/trainings`);
      const data = res.data || res; // Handle wrapped or unwrapped array
      if (Array.isArray(data)) {
        const mapped = data.map((t: any) => ({
          id: t.id,
          title: t.title,
          organizer: t.organizer,
          dateConducted: t.date_conducted || t.dateConducted,
          trainingHours: t.training_hours || t.trainingHours,
          certificateFilename: t.certificate_file_name || t.certificateFilename,
          status: t.status,
          remarks: t.remarks
        }));
        setTrainings(mapped);
      }
    } catch (err) {
      console.error("Failed to load trainings", err);
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

  const handleAddEntry = async () => {
    try {
      const payload = {
        title: newTraining.title,
        organizer: newTraining.organizer,
        date_conducted: newTraining.dateConducted,
        training_hours: newTraining.trainingHours,
        certificate_file_name: newTraining.certificateFilename,
        employee_id: selectedEmployeeId
      };
      await apiCall(`/api/employees/${selectedEmployeeId}/trainings`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setIsModalOpen(false);
      setNewTraining({ title: '', organizer: '', dateConducted: '', trainingHours: 0, certificateFilename: '' });
      fetchTrainings();
    } catch (err) {
      alert("Error adding training: " + err.message);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedTraining) return;
    try {
      await apiCall(`/api/trainings/${selectedTraining.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, remarks: verifyRemarks })
      });
      setVerifyModalOpen(false);
      setSelectedTraining(null);
      setVerifyRemarks("");
      fetchTrainings();
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };

  const openVerifyModal = (training) => {
    setSelectedTraining(training);
    setVerifyRemarks(training.remarks || "");
    setVerifyModalOpen(true);
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
                  <p className="text-[10px] text-slate-500">Seminars assigned by HR. Upload liquidation documents here.</p>
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
                            <h3 className={`font-bold text-sm ${activity.status === "Liquidated" ? "text-emerald-900" : "text-blue-900"}`}>
                              {activity.title}
                            </h3>
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
                          <div className="text-xs text-slate-600 mb-1">
                            <span className="font-semibold text-slate-700">Category:</span> {activity.category}
                          </div>
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
                        
                        {(activity.status === "Assigned" || activity.status === "Scheduled" || activity.status === "Completed") && (
                          <div className="pt-3 border-t border-blue-200 mt-2">
                            <button 
                              onClick={() => {
                                // Simulate document upload and liquidation submission
                                const confirmUpload = confirm("Confirm uploading liquidation documents (Certificate of Appearance, Receipts, etc.) for this seminar?");
                                if (confirmUpload) {
                                  handleLiquidate(activity.id);
                                }
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-bold transition shadow-sm"
                            >
                              Upload Liquidation Documents
                            </button>
                          </div>
                        )}
                        {activity.status === "Liquidation Pending" && (
                          <div className="pt-3 border-t border-blue-200 mt-2">
                            <p className="text-[10px] text-amber-700 font-semibold italic text-center">Liquidation documents submitted. Pending HR verification.</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>


              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase">Completed Trainings History</h2>
                    <p className="text-[10px] text-slate-500">Includes all submitted seminars. Official learning interventions requiring HR verification.</p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold uppercase shadow transition"
                  >
                    + Add Training Record
                  </button>
                </div>

                <table className="w-full text-left text-xs border-collapse bg-white border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-2">Training Title</th>
                      <th className="p-2">Organizer</th>
                      <th className="p-2 text-center">Date Conducted</th>
                      <th className="p-2 text-center">Hours</th>
                      <th className="p-2 text-center">Verification Status</th>
                      <th className="p-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainings.map((training) => (
                      <tr key={training.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2">
                          <div className="font-semibold text-slate-700">{training.title}</div>
                          {training.certificateFilename && (
                            <div className="text-[10px] text-slate-500 mt-1">Cert: {training.certificateFilename}</div>
                          )}
                          {training.remarks && (
                            <div className="text-[10px] text-rose-600 mt-1">Remarks: {training.remarks}</div>
                          )}
                        </td>
                        <td className="p-2 text-slate-600">{training.organizer}</td>
                        <td className="p-2 text-center text-slate-600">{training.dateConducted}</td>
                        <td className="p-2 text-center text-slate-600">{training.trainingHours}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider ${training.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : training.status === 'Returned' || training.status === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                            {training.status || 'Pending Verification'}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {isHrOrAdmin && training.status !== 'Verified' && (
                            <button onClick={() => openVerifyModal(training)} className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded font-bold shadow uppercase tracking-wider">
                              Review
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {trainings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-sm italic">
                          No training records submitted for this employee.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
              <h3 className="font-bold text-sm tracking-wide">SUBMIT TRAINING / SEMINAR</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:text-slate-300"><X size={18} /></button>
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
                    <input type="date" className="w-full border border-slate-300 p-2 text-xs rounded focus:border-blue-500 outline-none" value={newTraining.dateConducted} onChange={(e) => setNewTraining({...newTraining, dateConducted: e.target.value})}/>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Credit Hours *</label>
                    <input type="number" className="w-full border border-slate-300 p-2 text-xs rounded focus:border-blue-500 outline-none" value={newTraining.trainingHours} onChange={(e) => setNewTraining({...newTraining, trainingHours: parseInt(e.target.value)})}/>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Digital Certificate Filename</label>
                <input type="text" placeholder="certificate_2023.pdf" className="w-full border border-slate-300 p-2 text-xs rounded focus:border-blue-500 outline-none" value={newTraining.certificateFilename} onChange={(e) => setNewTraining({...newTraining, certificateFilename: e.target.value})}/>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 transition">Cancel</button>
                <button onClick={handleAddEntry} className="px-4 py-2 bg-blue-600 rounded text-xs font-bold text-white hover:bg-blue-700 transition shadow">Submit Record</button>
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
              <button onClick={() => setVerifyModalOpen(false)} className="hover:text-slate-300"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded text-xs space-y-1">
                <p><strong>Title:</strong> {selectedTraining.title}</p>
                <p><strong>Organizer:</strong> {selectedTraining.organizer}</p>
                <p><strong>Hours:</strong> {selectedTraining.trainingHours} | <strong>Date:</strong> {selectedTraining.dateConducted}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">HR Remarks / Return Reason</label>
                <textarea 
                  className="w-full border border-slate-300 p-2 text-xs rounded h-24 focus:border-blue-500 outline-none" 
                  placeholder="Optional for verification. Required if returning."
                  value={verifyRemarks}
                  onChange={(e) => setVerifyRemarks(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button onClick={() => handleUpdateStatus("Verified")} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow">
                  <CheckCircle size={16} /> Verify & Approve
                </button>
                <button onClick={() => handleUpdateStatus("Returned")} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow">
                  <XCircle size={16} /> Return to Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
