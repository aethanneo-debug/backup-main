TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' -d '{"username":"admin","password":"password123"}' http://localhost:3000/api/auth/login | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
echo "TOKEN: $TOKEN"
curl -s -X POST -H "Authorization: $TOKEN" http://localhost:3000/api/admin/users/u-emp/archive
echo ""
curl -s -X POST -H "Authorization: $TOKEN" http://localhost:3000/api/admin/users/u-emp/restore
