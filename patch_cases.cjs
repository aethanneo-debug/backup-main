const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const missingCases = `
      case "user-accounts":
        if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.HR_OFFICER) {
          return <div className="p-6 text-slate-500">Unauthenticated credentials path error [RA 10173 Security Block].</div>;
        }
        return <UserAccountsView currentUser={user} />;
      case "finance":
        return <FinanceView 
          user={user}
          transactions={transactions}
          employees={employees}
          fetchSummary={fetchSummary}
          onRefresh={triggerRefresh}
          activeSubTab={activeFinanceSubTab}
          setActiveSubTab={setActiveFinanceSubTab}
        />;
      case "budget":
        return <FinanceView 
          user={user}
          transactions={transactions}
          employees={employees}
          fetchSummary={fetchSummary}
          onRefresh={triggerRefresh}
          activeSubTab="budget"
          setActiveSubTab={setActiveFinanceSubTab}
        />;
      case "trainings_seminars":
        return <TrainingsSeminarsView user={user} employees={employees} />;
      case "training_development":
        return <TrainingDevelopmentView user={user} triggerRefresh={triggerRefresh} />;
      case "assets":
        return <AssetsView 
          user={user}
          assets={assets}
          employees={employees}
          onRefresh={triggerRefresh}
        />;
      case "requests":
        return <RequestsView 
          user={user}
          requests={requests}
          employees={employees}
          supplies={supplies}
          onRefresh={triggerRefresh}
        />;
`;

if (!code.includes('case "user-accounts":')) {
  code = code.replace('case "activities":', missingCases + '      case "activities":');
  fs.writeFileSync('src/App.tsx', code);
  console.log('Restored missing cases');
} else {
  console.log('Cases already present');
}
