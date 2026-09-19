const fs = require('fs');
const content = fs.readFileSync('src/components/FinanceView.tsx', 'utf8');

const target = `<button
                      onClick={() => {
                        if (!addBudgetRequestForm.amountRequested || !addBudgetRequestForm.purpose) {
                          return alert("Please fill amount and purpose basis.");
                        }
                        handleCreateBudgetRequest(
                          addBudgetRequestForm.department,
                          Number(addBudgetRequestForm.amountRequested),
                          addBudgetRequestForm.requestType,
                          addBudgetRequestForm.purpose
                        );
                        setIsAddBudgetRequestOpen(false);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-mono text-xs px-4 py-2 font-bold shadow-sm cursor-pointer"
                    >
                      Submit Adjustments Proposal
                    </button>`;

const replacement = `<button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!addBudgetRequestForm.amountRequested || !addBudgetRequestForm.purpose) {
                          return alert("Please fill amount and purpose basis.");
                        }
                        await handleCreateBudgetRequest(
                          addBudgetRequestForm.department,
                          Number(addBudgetRequestForm.amountRequested),
                          addBudgetRequestForm.requestType,
                          addBudgetRequestForm.purpose
                        );
                        setIsAddBudgetRequestOpen(false);
                        setAddBudgetRequestForm({ department: "Adjudication Division", amountRequested: "", requestType: "Augmentation", purpose: "" });
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-mono text-xs px-4 py-2 font-bold shadow-sm cursor-pointer"
                    >
                      Submit Adjustments Proposal
                    </button>`;

if (content.includes(target)) {
    fs.writeFileSync('src/components/FinanceView.tsx', content.replace(target, replacement));
    console.log("Success");
} else {
    console.log("Target not found");
}
