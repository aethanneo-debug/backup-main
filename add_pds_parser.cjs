const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Add import if not exists
if (!serverCode.includes('@google/genai')) {
  serverCode = serverCode.replace(
    'import fs from "fs";',
    'import fs from "fs";\nimport { GoogleGenAI, Type } from "@google/genai";'
  );
}

// Add the endpoint
const endpointCode = `
app.post("/api/pds/parse", authenticateToken, async (req: any, res) => {
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
            rZipCode: { type: Type.STRING }
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
});
`;

if (!serverCode.includes('/api/pds/parse')) {
  serverCode = serverCode.replace(
    '// Handle serving the Vite client in development',
    endpointCode + '\n\n// Handle serving the Vite client in development'
  );
  fs.writeFileSync('server.ts', serverCode);
  console.log("Added /api/pds/parse endpoint");
} else {
  console.log("Endpoint already exists");
}
