import re

with open("src/App.tsx", "r") as f:
    code = f.read()

# Replace TrainingsSeminarsView invocation
code = re.sub(r'<TrainingsSeminarsView[^>]+>', '<TrainingsSeminarsView user={user} employees={employees} />', code)

# Replace AssetsView invocation
assets_repl = """<AssetsView 
          user={user}
          assets={assets}
          supplies={supplies}
          employees={employees}
          fetchSummary={fetchSummary}
          onRefresh={triggerRefresh}
        />"""
code = re.sub(r'<AssetsView\s+user=\{user\}\s+assets=\{assets\}\s+supplies=\{supplies\}\s+fetchSummary=\{fetchSummary\}\s+onRefresh=\{triggerRefresh\}\s+/>', assets_repl, code, flags=re.MULTILINE|re.DOTALL)
code = re.sub(r'<AssetsView[^>]+>', assets_repl, code, flags=re.MULTILINE|re.DOTALL) # just to be safe

# Replace RequestsView invocation
requests_repl = """<RequestsView 
          user={user}
          requests={requests}
          fetchSummary={fetchSummary}
          supplies={supplies}
          onRefresh={triggerRefresh}
        />"""
code = re.sub(r'<RequestsView\s+user=\{user\}\s+requests=\{requests\}\s+employees=\{employees\}\s+supplies=\{supplies\}\s+onRefresh=\{triggerRefresh\}\s+/>', requests_repl, code, flags=re.MULTILINE|re.DOTALL)
code = re.sub(r'<RequestsView[^>]+>', requests_repl, code, flags=re.MULTILINE|re.DOTALL)

# Replace ReportsView invocation
reports_repl = """<ReportsView 
            user={user} 
            employees={employees} 
            transactions={transactions} 
            assets={assets} 
            supplies={supplies} 
            requests={requests} 
          />"""
code = re.sub(r'<ReportsView\s+user=\{user\}\s+fetchSummary=\{fetchSummary\}\s+transactions=\{transactions\}\s+assets=\{assets\}\s+supplies=\{supplies\}\s+requests=\{requests\}\s+/>', reports_repl, code, flags=re.MULTILINE|re.DOTALL)
code = re.sub(r'<ReportsView[^>]+>', reports_repl, code, flags=re.MULTILINE|re.DOTALL)


# Also EmployeePortalView
portal_repl = """<EmployeePortalView 
            user={user} 
            onRefresh={triggerRefresh}
          />"""
code = re.sub(r'<EmployeePortalView[^>]+>', portal_repl, code, flags=re.MULTILINE|re.DOTALL)

with open("src/App.tsx", "w") as f:
    f.write(code)

