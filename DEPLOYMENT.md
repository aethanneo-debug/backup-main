# Production Setup and Deployment Guide
## Integrated Personnel and Financial Management System (IPFMS)
### Human Settlements Adjudication Commission Regional Adjudication Branch No. 1 (HSAC RAB 1)

This project contains two architectures to fulfill development and production requirements:
1. **Developer Sandbox / Live Preview**: A full-stack Express + React system served on Port 3000 that utilizes `data_store.json` for lightweight persistent state.
2. **Production Deployment**: A production-ready Python FastAPI backend integrated with a secure SQL-indexed PostgreSQL database.

---

## 1. Prerequisites and Backend Stack Configuration
Ensure your production target server environment contains:
* **Python v3.10+** (with pip)
* **PostgreSQL v14+**
* **Node.js v20+** (with npm)

---

## 2. Database Migration Setup (PostgreSQL)
1. Initialize the PostgreSQL Service and create the regional target database:
   ```bash
   psql -U postgres
   CREATE DATABASE hsac_ipfms;
   \q
   ```
2. Import the schema, relations structure, indexes, and primary role-based default records defined in `/database/schema.sql`:
   ```bash
   psql -U postgres -d hsac_ipfms -f database/schema.sql
   ```

---

## 3. Production FastAPI Backend Setup
1. Standardize execution by creating a clean virtual environment:
   ```bash
   cd backend_fastapi
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install --no-cache-dir -r requirements.txt
   ```
3. Set your production environment properties by copying variables:
   ```env
   # .env
   DATABASE_URL="postgresql://postgres:password123@localhost:5432/hsac_ipfms"
   JWT_SECRET="YOUR_SECURE_RANDOM_LONG_STRING_SECRET_HERE"
   ```
4. Perform a local micro-service test run to bind Swagger endpoints to external ports:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   * Open `http://localhost:8000/docs` to verify the OpenAPI schema and interact with Swagger endpoints.

---

## 4. Production React Frontend Compilation
1. Return to the workspace root directory and assure required production node modules are loaded:
   ```bash
   npm install
   ```
2. Build optimized static production chunks inside `/dist`:
   ```bash
   npm run build
   ```
3. Deploy the resulting compiled SPA files from `/dist` to a high-speed web server layer (such as Nginx) or configure path proxy headers to rewrite browser requests targeting API endpoints `/api/*` towards FastAPI's port `8000`.

### Sample Nginx Configuration File:
```nginx
server {
    listen 80;
    server_name ipfms-rab1.hsac.gov.ph;

    location / {
        root /var/www/hsac-ipfms/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Security and Data Compliance (RA 10173 Philippines)
This application complies with **Republic Act 10173 (Data Privacy Act of 2012)**:
* **Access Control**: Users are strictly isolated based on Role-Based Access Control (RBAC). Only HR Officers have privileges over raw employee profiles, and only Finance Officers can manipulate active transaction sheets.
* **Audit Trails**: Security audits are non-destructive and registered with timestamps matching usernames to guarantee perfect accountability across user interactions.
