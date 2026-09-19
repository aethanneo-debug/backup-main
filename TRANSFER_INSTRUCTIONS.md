# 🚀 IntegraSync: Local Setup & Transfer Instructions

Welcome to **IntegraSync**, the web-based Integrated Personnel and Financial Management System! 

This guide provides step-by-step instructions for exporting the project from AI Studio and running it on your local machine.

---

## 📥 Step 1: Export the Project from AI Studio

1. In the Google AI Studio interface, locate the **Settings / Menu** in the top-right corner.
2. Select **Export** or **Download as ZIP**.
3. Extract the downloaded ZIP file to a folder on your computer (e.g., `C:\Projects\IntegraSync` or `~/Desktop/IntegraSync`).

---

## 🛠 Step 2: Install Prerequisites

Before running the system, ensure you have the following installed:

1. **Node.js** (v18 or v20+ recommended)
   - Download link: [https://nodejs.org/](https://nodejs.org/)
   - This includes `npm`, the Node Package Manager.
2. **Code Editor** (VS Code is highly recommended)
   - Download link: [https://code.visualstudio.com/](https://code.visualstudio.com/)

---

## ⚙️ Step 3: Environment Configuration

1. In the root directory of your extracted project, look for a file named `.env.example`.
2. Make a copy of this file and rename it to `.env`.
3. Open `.env` in your code editor and configure any required variables (if applicable, such as `GEMINI_API_KEY`).

---

## 🚀 Step 4: Install Dependencies & Run

1. Open your terminal (or Command Prompt / PowerShell / VS Code Terminal).
2. Navigate to your project directory:
   ```bash
   cd path/to/IntegraSync
   ```
3. Install all the necessary dependencies:
   ```bash
   npm install
   ```
4. Start the application in development mode:
   ```bash
   npm run dev
   ```
5. Open your web browser and navigate to: **http://localhost:3000**

*Note: The current prototype uses an Express.js backend with local JSON persistence (\`data_store.json\`) to allow it to run smoothly in this environment. For your final capstone architecture (Python REST API + PostgreSQL), you can use this React frontend as a template and rewire the API calls in \`src/utils.ts\` to point to your new Python backend.*

---

## 🔐 Step 5: Default Login Credentials

Here are the pre-configured accounts you can use to test different modules and roles:

1. **Super Admin** (Full Access)
   - Username: `admin`
   - Password: `password123`
   - Role: SUPER_ADMIN

2. **HR Officer** (Personnel Records, Leave Requests)
   - Username: `hr`
   - Password: `password123`
   - Role: HR_OFFICER

3. **Finance Officer** (Budget Allocations, Audit Logs)
   - Username: `finance`
   - Password: `password123`
   - Role: FINANCE_OFFICER

4. **Budget Officer** (Purchase Requests, Account Ledgers)
   - Username: `budget`
   - Password: `password123`
   - Role: BUDGET_OFFICER

5. **Regular Employee** (Standard Access)
   - Username: `employee`
   - Password: `password123`
   - Role: EMPLOYEE

---

## 📦 Step 6: Production Build (Optional)

To compile an optimized build of the prototype for production use:

1. Build the frontend and backend bundle:
   ```bash
   npm run build
   ```
2. Run the compiled application:
   ```bash
   npm start
   ```

---

## 💡 Troubleshooting

- **Port 3000 is occupied**: Make sure no other application or terminal is using port 3000.
- **Module Errors**: If you encounter errors about missing modules, delete the \`node_modules\` folder and run \`npm install\` again.
- **Database Reset**: Data is saved to \`data_store.json\` in the root folder. You can reset the database to its default state by deleting \`data_store.json\` and restarting the server.
