const fs = require('fs');
let content = fs.readFileSync('src/components/HrUnifiedRequests.tsx', 'utf8');

const target = `  const filteredItems = allItems.filter(item => {
    if (filterCategory === "All") return true;
    if (["Personnel Request", "Liquidation"].includes(filterCategory)) {
      return item._category === filterCategory;
    }
    return item.requestType === filterCategory || item.leaveType === filterCategory;
  });`;

const replacement = `  const filteredItems = allItems.filter(item => {
    let catMatch = true;
    if (filterCategory !== "All") {
      if (["Personnel Request", "Liquidation"].includes(filterCategory)) {
        catMatch = item._category === filterCategory;
      } else {
        catMatch = item.requestType === filterCategory || item.leaveType === filterCategory;
      }
    }
    
    let statMatch = true;
    if (filterStatus !== "All") {
      statMatch = item.status && item.status.includes(filterStatus);
    }
    
    return catMatch && statMatch;
  });`;

content = content.replace(target, replacement);

const targetSelect = `<button onClick={fetchData} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-600 transition-colors cursor-pointer" title="Refresh">`;
const replacementSelect = `<select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Endorsed">Endorsed</option>
            <option value="Approved">Approved</option>
            <option value="Returned">Returned</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button onClick={fetchData} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-600 transition-colors cursor-pointer" title="Refresh">`;

content = content.replace(targetSelect, replacementSelect);

fs.writeFileSync('src/components/HrUnifiedRequests.tsx', content);
