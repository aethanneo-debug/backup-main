import re
with open("src/App.tsx", "r") as f:
    lines = f.readlines()

out = []
for i, line in enumerate(lines):
    if "FinanceView" in "".join(lines[max(0, i-5):i+5]):
        out.append(line.replace("employees={employees}", "fetchSummary={fetchSummary}"))
    elif "TrainingsSeminarsView" in line:
        out.append(line.replace("employees={employees}", "fetchSummary={fetchSummary}"))
    elif "AssetsView" in "".join(lines[max(0, i-5):i+5]):
        out.append(line.replace("employees={employees}", "fetchSummary={fetchSummary}"))
    elif "EmployeePortalView" in "".join(lines[max(0, i-5):i+5]):
        out.append(line.replace("employees={employees}", "fetchSummary={fetchSummary}"))
    elif "ReportsView" in "".join(lines[max(0, i-5):i+5]):
        out.append(line.replace("employees={employees}", "fetchSummary={fetchSummary}"))
    else:
        out.append(line)

with open("src/App.tsx", "w") as f:
    f.writelines(out)
