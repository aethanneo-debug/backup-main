const fs = require('fs');
let code = fs.readFileSync('src/components/PersonalDataSheetForm.tsx', 'utf8');

const importStatements = `import React, { useState, useEffect, useRef } from 'react';
import { apiCall } from '../utils';
import { Upload, Loader2 } from 'lucide-react';`;

code = code.replace(`import React, { useState, useEffect } from 'react';\nimport { apiCall } from '../utils';`, importStatements);

const oldSave = `const handleSave = async () => {`;
const newSave = `
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSimulatePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    setSuccessMsg("");
    setErrorMsg("");
    
    // Simulate AI extraction delay
    setTimeout(async () => {
      // Simulate extracted data mapped to our formData structure
      const extractedData = {
        ...formData,
        surname: "Dela Cruz",
        firstName: "Juan",
        middleName: "Santos",
        dateOfBirth: "1990-05-15",
        placeOfBirth: "Manila",
        sex: "Male",
        civilStatus: "Married",
        bloodType: "O+",
        citizenshipType: "Filipino",
        telephoneNo: "123-4567",
        mobileNo: "09123456789",
        emailAddress: user?.email || "juan.delacruz@example.com",
        rHouseNo: "123",
        rStreet: "Rizal St",
        rBarangay: "Brgy 1",
        rCityMunicipality: "Quezon City",
        rProvince: "Metro Manila",
        rZipCode: "1100"
      };
      
      setFormData(extractedData);
      
      // Auto-save the extracted PDS data
      try {
        await apiCall(\`/api/employees/\${selectedEmployeeId}/pds\`, {
          method: 'POST',
          body: JSON.stringify({ 
            data: extractedData,
            filename: file.name
          })
        });
        setSuccessMsg("PDS document successfully uploaded and processed. Profile auto-populated.");
        setIsUploading(false);
        setReloadTrigger(prev => prev + 1);
        
        // Notify parent to refresh user context since PDS is now completed
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        setErrorMsg("Error processing PDS document: " + err.message);
        setIsUploading(false);
      }
    }, 2500);
  };

  const handleSave = async () => {`;

code = code.replace(oldSave, newSave);

const uploadButtonJSX = `
          <div className="flex gap-2">
            {!isHrOrAdmin && (
              <>
                <input 
                  type="file" 
                  accept=".pdf,.png,.jpg,.jpeg" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleSimulatePdfUpload} 
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
`;

code = code.replace(
  /<div className="flex gap-2">\s*<button onClick=\{handlePrint\}.*?<\/button>\s*<button onClick=\{handleSave\}.*?<\/button>\s*<\/div>/g,
  uploadButtonJSX
);

fs.writeFileSync('src/components/PersonalDataSheetForm.tsx', code);
