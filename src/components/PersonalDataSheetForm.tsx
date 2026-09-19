import React, { useState, useEffect, useRef } from 'react';
import { apiCall } from '../utils';
import { Upload, Loader2 } from 'lucide-react';

export const PersonalDataSheetForm = ({ user, employees, onSuccess }: any) => {
  const isHrOrAdmin = ["Administrator / Division Chief", "HR Officer"].includes(user.role);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(isHrOrAdmin ? "" : user.employeeId);
  const [activeTab, setActiveTab] = useState(1);
  const emptyPdsDefaults = {
    surname: '', firstName: '', middleName: '', nameExtension: '', dateOfBirth: '', placeOfBirth: '',
    sex: 'Male', civilStatus: 'Single', heightM: '', weightKg: '', bloodType: '', gsisId: '', pagibigId: '', philhealthId: '', sssId: '', tinNo: '', agencyEmployeeNo: '', citizenshipType: 'Filipino',
    dualCitizenshipBy: '', dualCountry: '',
    rHouseNo: '', rStreet: '', rSubdivision: '', rBarangay: '', rCityMunicipality: '', rProvince: '', rZipCode: '',
    pHouseNo: '', pStreet: '', pSubdivision: '', pBarangay: '', pCityMunicipality: '', pProvince: '', pZipCode: '',
    telephoneNo: '', mobileNo: '', emailAddress: '', 
    spouseSurname: '', spouseFirstName: '', spouseMiddleName: '', spouseExtension: '', spouseOccupation: '', spouseEmployer: '', spouseBusinessAddress: '', spouseTelephone: '',
    fatherSurname: '', fatherFirstName: '', fatherMiddleName: '', fatherExtension: '',
    motherMaidenSurname: '', motherFirstName: '', motherMiddleName: '', 
    children: [], education: [], civilService: [], serviceRecords: [], trainings: []
  };

  const [formData, setFormData] = useState(emptyPdsDefaults);
  const [trainingsLedger, setTrainingsLedger] = useState([]);
  const [serviceRecordsLedger, setServiceRecordsLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setFormData(emptyPdsDefaults);
      setTrainingsLedger([]);
      setServiceRecordsLedger([]);
      setErrorMsg("");
      setSuccessMsg("");
      return;
    }

    const controller = new AbortController();
    const requestedEmployeeId = selectedEmployeeId;

    async function loadSelectedEmployee() {
      setLoading(true);
      setFormData(emptyPdsDefaults);
      setTrainingsLedger([]);
      setServiceRecordsLedger([]);
      setErrorMsg("");
      // Keep successMsg if it was set by handleSave
      // setSuccessMsg(""); 

      try {
        const [pdsRes, trainRes, histRes] = await Promise.all([
          apiCall(`/api/employees/${requestedEmployeeId}/pds-profile`, { signal: controller.signal }),
          apiCall(`/api/employees/${requestedEmployeeId}/trainings`, { signal: controller.signal }),
          apiCall(`/api/employees/${requestedEmployeeId}/history`, { signal: controller.signal })
        ]);

        if (requestedEmployeeId !== selectedEmployeeId) {
          return;
        }

        if (pdsRes.status === "success") {
          const emp = pdsRes.data.employee || {};
          const savedPds = pdsRes.data.pds || {};

          let fallbackSurname = emp.surname || "";
          let fallbackFirstName = emp.firstName || "";
          let fallbackMiddleName = emp.middleName || "";
          let fallbackNameExtension = emp.nameExtension || "";

          if (!fallbackSurname && emp.fullName) {
             const nameParts = emp.fullName.replace(/^(Hon\.|Atty\.|Dr\.|Mr\.|Ms\.)\s+/i, '').split(' ');
             fallbackSurname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
             
             const possibleExt = nameParts[nameParts.length - 1].toLowerCase();
             if (["jr.", "sr.", "ii", "iii", "iv"].includes(possibleExt) && nameParts.length > 2) {
                fallbackNameExtension = nameParts.pop();
                fallbackSurname = nameParts.pop();
             }

             fallbackFirstName = nameParts.slice(0, nameParts.length > 1 && nameParts[nameParts.length - 1].endsWith('.') ? -2 : -1).join(' ');
             fallbackMiddleName = nameParts.length > 1 && nameParts[nameParts.length - 1].endsWith('.') ? nameParts[nameParts.length - 1] : '';
             
             if (!fallbackFirstName && !fallbackMiddleName) {
               fallbackFirstName = nameParts[0] || "";
             }
          }

          const employeeFallback = {
            surname: fallbackSurname,
            firstName: fallbackFirstName,
            middleName: fallbackMiddleName,
            nameExtension: fallbackNameExtension,
            agencyEmployeeNo: emp.employeeId || "",
            emailAddress: emp.email || "",
            mobileNo: emp.contactNumber || "",
            telephoneNo: emp.contactNumber || "",
            rHouseNo: emp.address || "",
            pHouseNo: emp.address || "",
            salary: emp.salary || "",
            position: emp.position || "",
          };

          setFormData({
            ...emptyPdsDefaults,
            ...employeeFallback,
            ...savedPds,
            children: savedPds.children || [],
            education: savedPds.education || [],
            civilService: savedPds.civilService || [],
          });
          
          if (!pdsRes.data.pds) {
            setSuccessMsg("No saved PDS found. Employee information has been prefilled.");
          } else if (!successMsg) { // Only set if not already showing save success
            setSuccessMsg("PDS information loaded successfully.");
          }
        }

        if (trainRes.status === "success") {
          const trainData = trainRes.data || trainRes;
          if (Array.isArray(trainData)) {
            setTrainingsLedger(trainData.map(t => ({
              title: t.title,
              organizer: t.organizer,
              dateConducted: t.date_conducted || t.dateConducted,
              trainingHours: t.training_hours || t.trainingHours,
              status: t.status
            })));
          }
        }

        if (histRes.status === "success") {
           const histData = histRes.data || histRes;
           if (Array.isArray(histData)) {
             setServiceRecordsLedger(histData.map(h => ({
               effectiveDate: h.effective_date || h.effectiveDate,
               action: h.action,
               newDetails: h.new_details || h.newDetails,
               updatedBy: h.updated_by || h.updatedBy
             })));
           }
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setErrorMsg("Employee record could not be loaded.");
          console.error("Failed to load employee records", error);
        }
      } finally {
        if (requestedEmployeeId === selectedEmployeeId) {
          setLoading(false);
        }
      }
    }

    loadSelectedEmployee();

    return () => controller.abort();
  }, [selectedEmployeeId, reloadTrigger]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    setSuccessMsg("");
    setErrorMsg("");
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = (event.target.result as string).split(',')[1];
        
        try {
          // Send to our backend parser which uses Gemini API
          const parseRes = await apiCall('/api/pds/parse', {
            method: 'POST',
            body: JSON.stringify({
              base64Data: base64String,
              mimeType: file.type || "application/pdf"
            })
          });

          if (parseRes.status === "success" && parseRes.data) {
            const extractedData = {
              ...formData,
              ...parseRes.data
            };
            
            setFormData(extractedData);
            
            // Auto-save the extracted PDS data
            await apiCall(`/api/employees/${selectedEmployeeId}/pds`, {
              method: 'POST',
              body: JSON.stringify({ 
                data: extractedData,
                filename: file.name
              })
            });
            
            setSuccessMsg("PDS document successfully uploaded and processed. Profile auto-populated with extracted data.");
            setReloadTrigger(prev => prev + 1);
            
            // Notify parent to refresh user context since PDS is now completed
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            setErrorMsg(parseRes.message || "Failed to extract data from PDS.");
          }
        } catch (err: any) {
          setErrorMsg("Error processing PDS document: " + err.message);
        } finally {
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        setErrorMsg("Failed to read the file.");
        setIsUploading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg("Error handling file: " + err.message);
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedEmployeeId) {
      setErrorMsg("Please select an employee.");
      return;
    }
    try {
      setLoading(true);
      setErrorMsg("");
      await apiCall(`/api/employees/${selectedEmployeeId}/pds`, {
        method: 'POST',
        body: JSON.stringify({ data: formData })
      });
      setSuccessMsg("PDS information saved successfully.");
      setReloadTrigger(prev => prev + 1);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg("Error saving PDS: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const addChild = () => {
    setFormData(prev => ({ ...prev, children: [...prev.children, { fullName: '', dateOfBirth: '' }] }));
  };

  const updateChild = (index, field, value) => {
    const newChildren = [...formData.children];
    newChildren[index][field] = value;
    setFormData(prev => ({ ...prev, children: newChildren }));
  };

  const removeChild = (index) => {
    const newChildren = formData.children.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, children: newChildren }));
  };

  const addEducation = () => {
    setFormData(prev => ({ ...prev, education: [...prev.education, { level: 'Elementary', schoolName: '', degreeCourse: '', attendanceFrom: '', attendanceTo: '', highestLevelUnitsEarned: '', yearGraduated: '', scholarshipsHonorsReceived: '' }] }));
  };

  const updateEducation = (index, field, value) => {
    const newEdu = [...formData.education];
    newEdu[index][field] = value;
    setFormData(prev => ({ ...prev, education: newEdu }));
  };

  const removeEducation = (index) => {
    const newEdu = formData.education.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, education: newEdu }));
  };

  const addCivilService = () => {
    setFormData(prev => ({ ...prev, civilService: [...prev.civilService, { eligibilityName: '', rating: '', dateOfExamination: '', placeOfExamination: '', licenseNumber: '', licenseValidityDate: '' }] }));
  };

  const updateCivilService = (index, field, value) => {
    const newCS = [...formData.civilService];
    newCS[index][field] = value;
    setFormData(prev => ({ ...prev, civilService: newCS }));
  };

  const removeCivilService = (index) => {
    const newCS = formData.civilService.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, civilService: newCS }));
  };

  const renderField = (name, label, type = "text", width = "w-full") => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <input type={type} name={name} value={formData[name] || ''} onChange={handleChange} className={`border border-slate-300 p-2 text-xs rounded ${width}`} />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto w-full relative">
      {/* Print View Layout - Only visible when printing */}
      <div className="hidden print:block w-full text-[10px] leading-tight text-black font-sans bg-white p-4">
        <h1 className="text-center font-bold text-xl italic mb-4">CS Form No. 212<br/>PERSONAL DATA SHEET</h1>
        <p className="text-center text-[9px] mb-4">WARNING: Any misrepresentation made in the Personal Data Sheet and the Work Experience Sheet shall cause the filing of administrative/criminal case/s against the person concerned.</p>
        
        {/* I. PERSONAL INFORMATION */}
        <div className="bg-gray-400 text-white font-bold italic px-2 py-1 border border-black">I. PERSONAL INFORMATION</div>
        <table className="w-full border-collapse border border-black mb-4 table-fixed">
          <tbody>
            <tr><td className="border border-black p-1 bg-gray-200 w-1/4">2. SURNAME</td><td colSpan={3} className="border border-black p-1">{formData.surname}</td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">FIRST NAME</td><td colSpan={2} className="border border-black p-1">{formData.firstName}</td><td className="border border-black p-1 w-1/4">NAME EXTENSION: {formData.nameExtension}</td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">MIDDLE NAME</td><td colSpan={3} className="border border-black p-1">{formData.middleName}</td></tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">3. DATE OF BIRTH</td><td className="border border-black p-1">{formData.dateOfBirth}</td>
              <td className="border border-black p-1 bg-gray-200">16. CITIZENSHIP</td><td className="border border-black p-1">{formData.citizenshipType} {formData.dualCitizenshipBy} {formData.dualCountry}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">4. PLACE OF BIRTH</td><td className="border border-black p-1">{formData.placeOfBirth}</td>
              <td rowSpan={2} className="border border-black p-1 bg-gray-200">17. RESIDENTIAL ADDRESS</td>
              <td rowSpan={2} className="border border-black p-1">{formData.rHouseNo} {formData.rStreet} {formData.rSubdivision} {formData.rBarangay} {formData.rCityMunicipality} {formData.rProvince} {formData.rZipCode}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">5. SEX</td><td className="border border-black p-1">{formData.sex}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">6. CIVIL STATUS</td><td className="border border-black p-1">{formData.civilStatus}</td>
              <td rowSpan={2} className="border border-black p-1 bg-gray-200">18. PERMANENT ADDRESS</td>
              <td rowSpan={2} className="border border-black p-1">{formData.pHouseNo} {formData.pStreet} {formData.pSubdivision} {formData.pBarangay} {formData.pCityMunicipality} {formData.pProvince} {formData.pZipCode}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">7. HEIGHT (m)</td><td className="border border-black p-1">{formData.heightM}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">8. WEIGHT (kg)</td><td className="border border-black p-1">{formData.weightKg}</td>
              <td className="border border-black p-1 bg-gray-200">19. TELEPHONE NO.</td><td className="border border-black p-1">{formData.telephoneNo}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">9. BLOOD TYPE</td><td className="border border-black p-1">{formData.bloodType}</td>
              <td className="border border-black p-1 bg-gray-200">20. MOBILE NO.</td><td className="border border-black p-1">{formData.mobileNo}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">10. GSIS ID NO.</td><td className="border border-black p-1">{formData.gsisId}</td>
              <td className="border border-black p-1 bg-gray-200">21. E-MAIL ADDRESS</td><td className="border border-black p-1">{formData.emailAddress}</td>
            </tr>
            <tr><td className="border border-black p-1 bg-gray-200">11. PAG-IBIG ID NO.</td><td className="border border-black p-1">{formData.pagibigId}</td><td colSpan={2} className="border border-black p-1 bg-gray-200"></td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">12. PHILHEALTH NO.</td><td className="border border-black p-1">{formData.philhealthId}</td><td colSpan={2} className="border border-black p-1 bg-gray-200"></td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">13. SSS NO.</td><td className="border border-black p-1">{formData.sssId}</td><td colSpan={2} className="border border-black p-1 bg-gray-200"></td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">14. TIN NO.</td><td className="border border-black p-1">{formData.tinNo}</td><td colSpan={2} className="border border-black p-1 bg-gray-200"></td></tr>
            
            <tr>
              <td className="border border-black p-1 bg-gray-200">15. AGENCY EMPLOYEE NO.</td>
              <td className="border border-black p-1">{formData.agencyEmployeeNo}</td>
              <td className="border border-black p-1 bg-gray-200">16. SALARY</td>
              <td className="border border-black p-1">{formData.salary}</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black p-1 bg-gray-200"></td>
              <td className="border border-black p-1 bg-gray-200">17. POSITION</td>
              <td className="border border-black p-1">{formData.position}</td>
            </tr>

          </tbody>
        </table>

        {/* II. FAMILY BACKGROUND */}
        <div className="bg-gray-400 text-white font-bold italic px-2 py-1 border border-black" style={{pageBreakBefore: 'always'}}>II. FAMILY BACKGROUND</div>
        <table className="w-full border-collapse border border-black mb-4 table-fixed">
          <tbody>
            <tr>
              <td className="border border-black p-1 bg-gray-200 w-1/4">22. SPOUSE'S SURNAME</td><td className="border border-black p-1 w-1/4">{formData.spouseSurname}</td>
              <td className="border border-black p-1 bg-gray-200 w-1/4">23. NAME of CHILDREN</td><td className="border border-black p-1 bg-gray-200 w-1/4">DATE OF BIRTH</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">FIRST NAME</td><td className="border border-black p-1">{formData.spouseFirstName} {formData.spouseExtension}</td>
              <td className="border border-black p-1">{formData.children[0]?.fullName || ''}</td><td className="border border-black p-1">{formData.children[0]?.dateOfBirth || ''}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">MIDDLE NAME</td><td className="border border-black p-1">{formData.spouseMiddleName}</td>
              <td className="border border-black p-1">{formData.children[1]?.fullName || ''}</td><td className="border border-black p-1">{formData.children[1]?.dateOfBirth || ''}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">OCCUPATION</td><td className="border border-black p-1">{formData.spouseOccupation}</td>
              <td className="border border-black p-1">{formData.children[2]?.fullName || ''}</td><td className="border border-black p-1">{formData.children[2]?.dateOfBirth || ''}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">EMPLOYER/BUSINESS NAME</td><td className="border border-black p-1">{formData.spouseEmployer}</td>
              <td className="border border-black p-1">{formData.children[3]?.fullName || ''}</td><td className="border border-black p-1">{formData.children[3]?.dateOfBirth || ''}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">BUSINESS ADDRESS</td><td className="border border-black p-1">{formData.spouseBusinessAddress}</td>
              <td className="border border-black p-1">{formData.children[4]?.fullName || ''}</td><td className="border border-black p-1">{formData.children[4]?.dateOfBirth || ''}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">TELEPHONE NO.</td><td className="border border-black p-1">{formData.spouseTelephone}</td>
              <td className="border border-black p-1">{formData.children[5]?.fullName || ''}</td><td className="border border-black p-1">{formData.children[5]?.dateOfBirth || ''}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 bg-gray-200">24. FATHER'S SURNAME</td><td className="border border-black p-1">{formData.fatherSurname}</td>
              <td colSpan={2} className="border border-black p-1 bg-gray-200 text-center italic">(Continue on separate sheet if necessary)</td>
            </tr>
            <tr><td className="border border-black p-1 bg-gray-200">FIRST NAME</td><td colSpan={3} className="border border-black p-1">{formData.fatherFirstName} {formData.fatherExtension}</td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">MIDDLE NAME</td><td colSpan={3} className="border border-black p-1">{formData.fatherMiddleName}</td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">25. MOTHER'S MAIDEN NAME</td><td colSpan={3} className="border border-black p-1 bg-gray-200"></td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">SURNAME</td><td colSpan={3} className="border border-black p-1">{formData.motherMaidenSurname}</td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">FIRST NAME</td><td colSpan={3} className="border border-black p-1">{formData.motherFirstName}</td></tr>
            <tr><td className="border border-black p-1 bg-gray-200">MIDDLE NAME</td><td colSpan={3} className="border border-black p-1">{formData.motherMiddleName}</td></tr>
          </tbody>
        </table>

        {/* III. EDUCATIONAL BACKGROUND */}
        <div className="bg-gray-400 text-white font-bold italic px-2 py-1 border border-black">III. EDUCATIONAL BACKGROUND</div>
        <table className="w-full border-collapse border border-black mb-4 text-center table-fixed">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-1 w-1/6">26. LEVEL</th>
              <th className="border border-black p-1 w-1/5">NAME OF SCHOOL</th>
              <th className="border border-black p-1 w-1/5">BASIC EDUCATION/DEGREE/COURSE</th>
              <th className="border border-black p-1 w-1/12">FROM</th>
              <th className="border border-black p-1 w-1/12">TO</th>
              <th className="border border-black p-1">HIGHEST LEVEL/UNITS EARNED</th>
              <th className="border border-black p-1">YEAR GRADUATED</th>
              <th className="border border-black p-1">SCHOLARSHIP/HONORS</th>
            </tr>
          </thead>
          <tbody>
            {formData.education.map((edu, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1 bg-gray-200 text-left">{edu.level}</td>
                <td className="border border-black p-1">{edu.schoolName}</td>
                <td className="border border-black p-1">{edu.degreeCourse}</td>
                <td className="border border-black p-1">{edu.attendanceFrom}</td>
                <td className="border border-black p-1">{edu.attendanceTo}</td>
                <td className="border border-black p-1">{edu.highestLevelUnitsEarned}</td>
                <td className="border border-black p-1">{edu.yearGraduated}</td>
                <td className="border border-black p-1">{edu.scholarshipsHonorsReceived}</td>
              </tr>
            ))}
            {formData.education.length === 0 && (
              <tr><td colSpan={8} className="border border-black p-4 text-gray-500 italic">No records provided</td></tr>
            )}
          </tbody>
        </table>

        {/* IV. CIVIL SERVICE ELIGIBILITY */}
        <div className="bg-gray-400 text-white font-bold italic px-2 py-1 border border-black" style={{pageBreakBefore: 'always'}}>IV. CIVIL SERVICE ELIGIBILITY</div>
        <table className="w-full border-collapse border border-black mb-4 text-center table-fixed">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-1 w-1/4">27. CAREER SERVICE/ RA 1080 (BOARD/ BAR) UNDER SPECIAL LAWS/ CES/ CSEE</th>
              <th className="border border-black p-1 w-1/12">RATING</th>
              <th className="border border-black p-1 w-1/6">DATE OF EXAMINATION / CONFERMENT</th>
              <th className="border border-black p-1 w-1/4">PLACE OF EXAMINATION / CONFERMENT</th>
              <th className="border border-black p-1">LICENSE Number</th>
              <th className="border border-black p-1">LICENSE Date of Validity</th>
            </tr>
          </thead>
          <tbody>
            {formData.civilService.map((cs, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1">{cs.eligibilityName}</td>
                <td className="border border-black p-1">{cs.rating}</td>
                <td className="border border-black p-1">{cs.dateOfExamination}</td>
                <td className="border border-black p-1">{cs.placeOfExamination}</td>
                <td className="border border-black p-1">{cs.licenseNumber}</td>
                <td className="border border-black p-1">{cs.licenseValidityDate}</td>
              </tr>
            ))}
             {formData.civilService.length === 0 && (
              <tr><td colSpan={6} className="border border-black p-4 text-gray-500 italic">No records provided</td></tr>
            )}
          </tbody>
        </table>

        {/* V. WORK EXPERIENCE */}
        <div className="bg-gray-400 text-white font-bold italic px-2 py-1 border border-black">V. WORK EXPERIENCE (Service Records)</div>
        <table className="w-full border-collapse border border-black mb-4 text-center table-fixed">
          <thead>
            <tr className="bg-gray-200">
              <th colSpan={2} className="border border-black p-1">28. INCLUSIVE DATES</th>
              <th rowSpan={2} className="border border-black p-1">POSITION TITLE</th>
              <th rowSpan={2} className="border border-black p-1">DEPARTMENT / AGENCY / OFFICE / COMPANY</th>
              <th rowSpan={2} className="border border-black p-1">MONTHLY SALARY</th>
              <th rowSpan={2} className="border border-black p-1">SALARY/ JOB/ PAY GRADE</th>
              <th rowSpan={2} className="border border-black p-1">STATUS OF APPOINTMENT</th>
              <th rowSpan={2} className="border border-black p-1">GOV'T SERVICE (Y/ N)</th>
            </tr>
            <tr className="bg-gray-200">
              <th className="border border-black p-1">From</th>
              <th className="border border-black p-1">To</th>
            </tr>
          </thead>
          <tbody>
            {(formData.serviceRecords && formData.serviceRecords.length > 0 ? formData.serviceRecords : serviceRecordsLedger.map(sr => ({
              inclusiveDateFrom: sr.effectiveDate,
              inclusiveDateTo: 'Present',
              positionTitle: sr.action,
              departmentAgency: 'HSAC RAB 1',
              monthlySalary: '-',
              salaryGrade: '-',
              statusOfAppointment: '-',
              govService: 'Y'
            }))).map((sr: any, idx: number) => (
              <tr key={idx}>
                <td className="border border-black p-1">{sr.inclusiveDateFrom}</td>
                <td className="border border-black p-1">{sr.inclusiveDateTo}</td>
                <td className="border border-black p-1">{sr.positionTitle}</td>
                <td className="border border-black p-1">{sr.departmentAgency}</td>
                <td className="border border-black p-1">{sr.monthlySalary}</td>
                <td className="border border-black p-1">{sr.salaryGrade}</td>
                <td className="border border-black p-1">{sr.statusOfAppointment}</td>
                <td className="border border-black p-1">{sr.govService}</td>
              </tr>
            ))}
             {(!formData.serviceRecords || formData.serviceRecords.length === 0) && serviceRecordsLedger.length === 0 && (
              <tr><td colSpan={8} className="border border-black p-4 text-gray-500 italic">No records provided</td></tr>
            )}
          </tbody>
        </table>

        {/* VII. LEARNING AND DEVELOPMENT */}
        <div className="bg-gray-400 text-white font-bold italic px-2 py-1 border border-black" style={{pageBreakBefore: 'always'}}>VII. LEARNING AND DEVELOPMENT (L&D) INTERVENTIONS/TRAINING PROGRAMS ATTENDED</div>
        <table className="w-full border-collapse border border-black mb-4 text-center table-fixed">
          <thead>
            <tr className="bg-gray-200">
              <th rowSpan={2} className="border border-black p-1 w-1/3">30. TITLE OF LEARNING AND DEVELOPMENT INTERVENTIONS/TRAINING PROGRAMS</th>
              <th colSpan={2} className="border border-black p-1">INCLUSIVE DATES OF ATTENDANCE</th>
              <th rowSpan={2} className="border border-black p-1 w-1/12">NUMBER OF HOURS</th>
              <th rowSpan={2} className="border border-black p-1 w-1/12">Type of L&D (Managerial/ Supervisory/ Technical/etc)</th>
              <th rowSpan={2} className="border border-black p-1">CONDUCTED/ SPONSORED BY</th>
            </tr>
            <tr className="bg-gray-200">
              <th className="border border-black p-1">From</th>
              <th className="border border-black p-1">To</th>
            </tr>
          </thead>
          <tbody>
            {(formData.trainings && formData.trainings.length > 0 ? formData.trainings : trainingsLedger.map(trn => ({
              title: trn.title,
              dateFrom: trn.dateConducted,
              dateTo: trn.dateConducted,
              trainingHours: trn.trainingHours,
              typeOfLAndD: 'Technical',
              organizer: trn.organizer
            }))).map((trn: any, idx: number) => (
              <tr key={idx}>
                <td className="border border-black p-1 text-left">{trn.title}</td>
                <td className="border border-black p-1">{trn.dateFrom}</td>
                <td className="border border-black p-1">{trn.dateTo}</td>
                <td className="border border-black p-1">{trn.trainingHours}</td>
                <td className="border border-black p-1">{trn.typeOfLAndD}</td>
                <td className="border border-black p-1">{trn.organizer}</td>
              </tr>
            ))}
             {(!formData.trainings || formData.trainings.length === 0) && trainingsLedger.length === 0 && (
              <tr><td colSpan={6} className="border border-black p-4 text-gray-500 italic">No records provided</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Screen Interface - Hidden when printing */}
      <div className="print:hidden p-6 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Personal Data Sheet (CS Form 212)</h1>
            <p className="text-xs text-slate-500 mt-1">Official digital record entry mapped to CSC standard.</p>
          </div>
          
          <div className="flex gap-2">
            {!isHrOrAdmin && (
              <>
                <input 
                  type="file" 
                  accept=".pdf,.png,.jpg,.jpeg" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handlePdfUpload} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow text-xs font-bold uppercase transition flex items-center gap-1.5"
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {isUploading ? "Processing Document..." : "Smart Upload PDS"}
                </button>
              </>
            )}
            <button onClick={handlePrint} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded shadow text-xs font-bold uppercase transition">Print PDS</button>
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-xs font-bold uppercase transition">Save Changes</button>
          </div>

        </div>

        {isHrOrAdmin && (
          <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 flex items-center gap-4 shadow-sm">
            <label className="text-xs font-bold text-slate-600 uppercase">Select Target Employee:</label>
            <select className="border border-slate-300 rounded p-2 text-xs w-64 bg-slate-50" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
              <option value="">-- Choose Employee --</option>
              {employees.map(emp => (
                <option key={emp.employeeId} value={emp.employeeId}>{emp.fullName}</option>
              ))}
            </select>
          </div>
        )}

        {loading && <div className="mb-4 text-sm text-blue-600 font-medium">Loading employee PDS...</div>}
        {errorMsg && <div className="mb-4 text-sm text-rose-600 font-medium">{errorMsg}</div>}
        {successMsg && !loading && <div className="mb-4 text-sm text-emerald-600 font-medium">{successMsg}</div>}

        {!selectedEmployeeId ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-8 text-center rounded-lg shadow-sm">
            <p className="font-semibold text-sm">Please select an employee to view or edit their Personal Data Sheet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            
            {/* Flat Tabs Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-100 overflow-x-auto">
              {[
                { id: 1, label: "I. Personal Info" },
                { id: 2, label: "II. Family Background" },
                { id: 3, label: "III. Educational Background" },
                { id: 4, label: "IV. Civil Service & Service Records" },
                { id: 5, label: "V. Trainings & Seminars" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-xs font-bold whitespace-nowrap uppercase tracking-wider transition-colors ${activeTab === tab.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-6">
              {activeTab === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {renderField('surname', 'Surname')}
                    {renderField('firstName', 'First Name')}
                    {renderField('middleName', 'Middle Name')}
                    {renderField('nameExtension', 'Extension (Jr., Sr.)')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderField('dateOfBirth', 'Date of Birth', 'date')}
                    {renderField('placeOfBirth', 'Place of Birth')}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Sex</label>
                      <select name="sex" value={formData.sex} onChange={handleChange} className="border border-slate-300 p-2 text-xs rounded">
                        <option>Male</option><option>Female</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Civil Status</label>
                      <select name="civilStatus" value={formData.civilStatus} onChange={handleChange} className="border border-slate-300 p-2 text-xs rounded">
                        <option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option><option>Other</option>
                      </select>
                    </div>
                    {renderField('heightM', 'Height (m)', 'number')}
                    {renderField('weightKg', 'Weight (kg)', 'number')}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderField('bloodType', 'Blood Type')}
                    {renderField('gsisId', 'GSIS ID No.')}
                    {renderField('pagibigId', 'PAG-IBIG ID No.')}
                    {renderField('philhealthId', 'PhilHealth No.')}
                    {renderField('sssId', 'SSS No.')}
                    {renderField('tinNo', 'TIN No.')}
                    {renderField('agencyEmployeeNo', 'Agency Employee No.')}
                    {renderField('position', 'Position')}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Salary</label>
                      <input 
                        type="number" 
                        name="salary" 
                        value={formData.salary || ''} 
                        onChange={handleChange} 
                        className={`border border-slate-300 p-2 text-xs rounded w-full ${user.role === 'Administrator / Division Chief' ? '' : 'bg-slate-200 cursor-not-allowed'}`}
                        readOnly={user.role !== 'Administrator / Division Chief'}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-200 rounded">
                    <div>
                      <h4 className="text-xs font-bold uppercase mb-2 text-slate-700 border-b pb-1">Residential Address</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {renderField('rHouseNo', 'House/Block/Lot No.')}
                        {renderField('rStreet', 'Street')}
                        {renderField('rSubdivision', 'Subdivision/Village')}
                        {renderField('rBarangay', 'Barangay')}
                        {renderField('rCityMunicipality', 'City/Municipality')}
                        {renderField('rProvince', 'Province')}
                        {renderField('rZipCode', 'Zip Code')}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase mb-2 text-slate-700 border-b pb-1">Permanent Address</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {renderField('pHouseNo', 'House/Block/Lot No.')}
                        {renderField('pStreet', 'Street')}
                        {renderField('pSubdivision', 'Subdivision/Village')}
                        {renderField('pBarangay', 'Barangay')}
                        {renderField('pCityMunicipality', 'City/Municipality')}
                        {renderField('pProvince', 'Province')}
                        {renderField('pZipCode', 'Zip Code')}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderField('telephoneNo', 'Telephone No.')}
                    {renderField('mobileNo', 'Mobile No.')}
                    {renderField('emailAddress', 'Email Address', 'email')}
                  </div>
                </div>
              )}

              {activeTab === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase text-slate-700 border-b pb-2">Spouse Information</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {renderField('spouseSurname', 'Surname')}
                        {renderField('spouseFirstName', 'First Name')}
                        {renderField('spouseMiddleName', 'Middle Name')}
                        {renderField('spouseExtension', 'Extension (Jr, Sr)')}
                        {renderField('spouseOccupation', 'Occupation')}
                        {renderField('spouseEmployer', 'Employer/Business Name')}
                        <div className="col-span-2">{renderField('spouseBusinessAddress', 'Business Address')}</div>
                        {renderField('spouseTelephone', 'Telephone No.')}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase text-slate-700 border-b pb-2">Parents Information</h4>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="col-span-2"><h5 className="text-xs font-semibold text-slate-500">FATHER</h5></div>
                        {renderField('fatherSurname', 'Surname')}
                        {renderField('fatherFirstName', 'First Name')}
                        {renderField('fatherMiddleName', 'Middle Name')}
                        {renderField('fatherExtension', 'Extension')}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2"><h5 className="text-xs font-semibold text-slate-500">MOTHER (Maiden Name)</h5></div>
                        {renderField('motherMaidenSurname', 'Maiden Surname')}
                        {renderField('motherFirstName', 'First Name')}
                        {renderField('motherMiddleName', 'Middle Name')}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                      <h4 className="text-sm font-bold uppercase text-slate-700">Children</h4>
                      <button onClick={addChild} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded font-bold">+ Add Child</button>
                    </div>
                    <div className="space-y-2">
                      {formData.children.map((child, index) => (
                        <div key={index} className="flex items-center gap-4 bg-slate-50 p-2 border border-slate-200 rounded">
                          <input type="text" placeholder="Full Name" value={child.fullName} onChange={(e) => updateChild(index, 'fullName', e.target.value)} className="flex-1 border border-slate-300 p-2 text-xs rounded" />
                          <input type="date" value={child.dateOfBirth} onChange={(e) => updateChild(index, 'dateOfBirth', e.target.value)} className="border border-slate-300 p-2 text-xs rounded w-40" />
                          <button onClick={() => removeChild(index)} className="text-rose-500 font-bold px-2 hover:bg-rose-100 rounded">X</button>
                        </div>
                      ))}
                      {formData.children.length === 0 && <p className="text-xs text-slate-500 italic">No children recorded.</p>}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center border-b pb-2 mb-4">
                    <h4 className="text-sm font-bold uppercase text-slate-700">Educational Background</h4>
                    <button onClick={addEducation} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded font-bold">+ Add Record</button>
                  </div>
                  <div className="space-y-4">
                    {formData.education.map((edu, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 border border-slate-200 rounded relative">
                        <button onClick={() => removeEducation(index)} className="absolute top-2 right-2 text-rose-500 font-bold bg-white px-2 py-1 border border-rose-200 hover:bg-rose-50 rounded text-xs">Remove</button>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Level</label>
                          <select value={edu.level} onChange={(e) => updateEducation(index, 'level', e.target.value)} className="border border-slate-300 p-2 text-xs rounded">
                            <option>Elementary</option><option>Secondary</option><option>Vocational/Trade Course</option><option>College</option><option>Graduate Studies</option>
                          </select>
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Name of School</label>
                          <input type="text" value={edu.schoolName} onChange={(e) => updateEducation(index, 'schoolName', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Basic Education/Degree/Course</label>
                          <input type="text" value={edu.degreeCourse} onChange={(e) => updateEducation(index, 'degreeCourse', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">From</label>
                          <input type="text" value={edu.attendanceFrom} onChange={(e) => updateEducation(index, 'attendanceFrom', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" placeholder="Year" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">To</label>
                          <input type="text" value={edu.attendanceTo} onChange={(e) => updateEducation(index, 'attendanceTo', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" placeholder="Year" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Highest Level/Units Earned</label>
                          <input type="text" value={edu.highestLevelUnitsEarned} onChange={(e) => updateEducation(index, 'highestLevelUnitsEarned', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Year Graduated</label>
                          <input type="text" value={edu.yearGraduated} onChange={(e) => updateEducation(index, 'yearGraduated', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Scholarship / Honors Received</label>
                          <input type="text" value={edu.scholarshipsHonorsReceived} onChange={(e) => updateEducation(index, 'scholarshipsHonorsReceived', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                        </div>
                      </div>
                    ))}
                    {formData.education.length === 0 && <p className="text-xs text-slate-500 italic">No education records provided.</p>}
                  </div>
                </div>
              )}

              {activeTab === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  {/* Civil Service section */}
                  <div>
                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                      <h4 className="text-sm font-bold uppercase text-slate-700">Civil Service Eligibility</h4>
                      <button onClick={addCivilService} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded font-bold">+ Add Eligibility</button>
                    </div>
                    <div className="space-y-3">
                      {formData.civilService.map((cs, index) => (
                         <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 p-3 border border-slate-200 rounded relative">
                            <button onClick={() => removeCivilService(index)} className="absolute top-2 right-2 text-rose-500 font-bold bg-white px-2 py-1 border border-rose-200 hover:bg-rose-50 rounded text-[10px]">Remove</button>
                            <div className="col-span-2 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Eligibility Name</label>
                              <input type="text" value={cs.eligibilityName} onChange={(e) => updateCivilService(index, 'eligibilityName', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Rating</label>
                              <input type="text" value={cs.rating} onChange={(e) => updateCivilService(index, 'rating', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Date of Exam</label>
                              <input type="date" value={cs.dateOfExamination} onChange={(e) => updateCivilService(index, 'dateOfExamination', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Place of Exam</label>
                              <input type="text" value={cs.placeOfExamination} onChange={(e) => updateCivilService(index, 'placeOfExamination', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">License No.</label>
                              <input type="text" value={cs.licenseNumber} onChange={(e) => updateCivilService(index, 'licenseNumber', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">License Validity</label>
                              <input type="date" value={cs.licenseValidityDate} onChange={(e) => updateCivilService(index, 'licenseValidityDate', e.target.value)} className="border border-slate-300 p-2 text-xs rounded" />
                            </div>
                         </div>
                      ))}
                      {formData.civilService.length === 0 && <p className="text-xs text-slate-500 italic">No civil service eligibility records provided.</p>}
                    </div>
                  </div>

                  {/* Service Records section */}
                  <div>
                    <div className="border-b pb-2 mb-4">
                      <h4 className="text-sm font-bold uppercase text-slate-700">Employment Service Records</h4>
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
                        {(formData.serviceRecords && formData.serviceRecords.length > 0 ? formData.serviceRecords : serviceRecordsLedger.map(sr => ({
                          inclusiveDateFrom: sr.effectiveDate,
                          inclusiveDateTo: 'Present',
                          positionTitle: sr.action,
                          departmentAgency: sr.newDetails,
                          updatedBy: sr.updatedBy
                        }))).map((sr: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="p-2 whitespace-nowrap">{sr.inclusiveDateFrom}</td>
                            <td className="p-2 font-semibold text-slate-700">{sr.positionTitle}</td>
                            <td className="p-2">{sr.departmentAgency}</td>
                            <td className="p-2">{sr.updatedBy || 'AI Parsed'}</td>
                          </tr>
                        ))}
                        {(!formData.serviceRecords || formData.serviceRecords.length === 0) && serviceRecordsLedger.length === 0 && (
                          <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">No service records found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 5 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="border-b pb-2 mb-4">
                    <h4 className="text-sm font-bold uppercase text-slate-700">Trainings & Seminars Ledger</h4>
                    <p className="text-[10px] text-slate-500">Includes all submitted seminars. The Trainings & Seminars module populates this automatically.</p>
                  </div>
                  <table className="w-full text-left text-xs border-collapse bg-white border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-2">Training Title</th>
                        <th className="p-2">Organizer</th>
                        <th className="p-2 text-center">Date Conducted</th>
                        <th className="p-2 text-center">Hours</th>
                        <th className="p-2 text-center">Verification Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formData.trainings && formData.trainings.length > 0 ? formData.trainings.map((t: any) => ({ ...t, status: 'Completed' })) : trainingsLedger.map(trn => ({
                        title: trn.title,
                        dateFrom: trn.dateConducted,
                        dateTo: trn.dateConducted,
                        trainingHours: trn.trainingHours,
                        organizer: trn.organizer,
                        status: trn.status
                      }))).map((trn: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="p-2 font-semibold text-slate-700">{trn.title}</td>
                          <td className="p-2">{trn.organizer}</td>
                          <td className="p-2 text-center">{trn.dateFrom || trn.dateConducted}</td>
                          <td className="p-2 text-center">{trn.trainingHours}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${trn.status === 'Verified' || trn.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : trn.status === 'Returned' || trn.status === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                              {trn.status || 'Pending Verification'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!formData.trainings || formData.trainings.length === 0) && trainingsLedger.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">No training records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action Buttons inside tab area */}
              <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-200">
                <button 
                  onClick={() => setActiveTab(Math.max(1, activeTab - 1))} 
                  disabled={activeTab === 1}
                  className="px-4 py-2 bg-slate-100 text-slate-600 disabled:opacity-50 rounded text-xs font-bold"
                >
                  &larr; Previous Section
                </button>
                <div className="text-xs font-bold text-slate-400">Page {activeTab} of 5</div>
                <button 
                  onClick={() => activeTab < 5 ? setActiveTab(activeTab + 1) : handleSave()} 
                  className={`px-4 py-2 ${activeTab === 5 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} rounded text-xs font-bold`}
                >
                  {activeTab === 5 ? 'Save Final Changes' : 'Next Section &rarr;'}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
