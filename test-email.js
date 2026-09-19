const email = process.argv[2];
const token = process.argv[3];
fetch("http://localhost:3000/api/admin/test-email", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
  body: JSON.stringify({ targetEmail: email })
}).then(r => r.json()).then(console.log).catch(console.error);
