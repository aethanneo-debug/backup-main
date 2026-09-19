const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const regex = /responseSchema:\s*\{\s*type:\s*Type\.OBJECT,\s*properties:\s*\{[\s\S]*?\}\s*\}/;

const newSchema = `responseSchema: {
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
        }`;

serverCode = serverCode.replace(regex, newSchema);

fs.writeFileSync('server.ts', serverCode);
console.log("Updated schema in server.ts");
