const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.post\("\/api\/pds\/parse"[\s\S]*?res\.status\(500\)\.json\(\{ status: "error", message: err\.message \}\);\n  \}\n\}\);/g;

const correctCode = `app.post("/api/pds/parse", authenticateToken, async (req: any, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    
    if (!base64Data) {
      return res.status(400).json({ status: "error", message: "No file data provided" });
    }

    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        { inlineData: { data: base64Data, mimeType: mimeType || "application/pdf" } },
        "Extract the personal information from this Personal Data Sheet (PDS). If the document is missing some fields, leave them empty."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            surname: { type: Type.STRING },
            firstName: { type: Type.STRING },
            middleName: { type: Type.STRING },
            dateOfBirth: { type: Type.STRING, description: "YYYY-MM-DD" },
            placeOfBirth: { type: Type.STRING },
            sex: { type: Type.STRING },
            civilStatus: { type: Type.STRING },
            bloodType: { type: Type.STRING },
            citizenshipType: { type: Type.STRING },
            telephoneNo: { type: Type.STRING },
            mobileNo: { type: Type.STRING },
            emailAddress: { type: Type.STRING },
            rHouseNo: { type: Type.STRING },
            rStreet: { type: Type.STRING },
            rBarangay: { type: Type.STRING },
            rCityMunicipality: { type: Type.STRING },
            rProvince: { type: Type.STRING },
            rZipCode: { type: Type.STRING },
            spouseSurname: { type: Type.STRING },
            spouseFirstName: { type: Type.STRING },
            spouseMiddleName: { type: Type.STRING },
            spouseExtension: { type: Type.STRING },
            spouseOccupation: { type: Type.STRING },
            spouseEmployer: { type: Type.STRING },
            spouseBusinessAddress: { type: Type.STRING },
            spouseTelephone: { type: Type.STRING },
            fatherSurname: { type: Type.STRING },
            fatherFirstName: { type: Type.STRING },
            fatherMiddleName: { type: Type.STRING },
            fatherExtension: { type: Type.STRING },
            motherMaidenSurname: { type: Type.STRING },
            motherFirstName: { type: Type.STRING },
            motherMiddleName: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fullName: { type: Type.STRING },
                  dateOfBirth: { type: Type.STRING }
                }
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  level: { type: Type.STRING },
                  schoolName: { type: Type.STRING },
                  degreeCourse: { type: Type.STRING },
                  attendanceFrom: { type: Type.STRING },
                  attendanceTo: { type: Type.STRING },
                  highestLevelUnitsEarned: { type: Type.STRING },
                  yearGraduated: { type: Type.STRING },
                  scholarshipsHonorsReceived: { type: Type.STRING }
                }
              }
            },
            civilService: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  eligibilityName: { type: Type.STRING },
                  rating: { type: Type.STRING },
                  dateOfExamination: { type: Type.STRING },
                  placeOfExamination: { type: Type.STRING },
                  licenseNumber: { type: Type.STRING },
                  licenseValidityDate: { type: Type.STRING }
                }
              }
            },
            serviceRecords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  inclusiveDateFrom: { type: Type.STRING },
                  inclusiveDateTo: { type: Type.STRING },
                  positionTitle: { type: Type.STRING },
                  departmentAgency: { type: Type.STRING },
                  monthlySalary: { type: Type.STRING },
                  salaryGrade: { type: Type.STRING },
                  statusOfAppointment: { type: Type.STRING },
                  govService: { type: Type.STRING }
                }
              }
            },
            trainings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  dateFrom: { type: Type.STRING },
                  dateTo: { type: Type.STRING },
                  trainingHours: { type: Type.STRING },
                  typeOfLAndD: { type: Type.STRING },
                  organizer: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const textResponse = response.text || "{}";
    const parsed = JSON.parse(textResponse);
    
    res.json({ status: "success", data: parsed });
  } catch (err: any) {
    console.error("PDS Parsing error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});`;

code = code.replace(regex, correctCode);
fs.writeFileSync('server.ts', code);
console.log("Rewrote endpoint!");
