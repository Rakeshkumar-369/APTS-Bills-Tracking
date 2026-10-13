# APTS Bills Tracking Portal

Bill verification and claim tracking portal for the ITE&C Department, Government of Andhra Pradesh.

**Flow:** Super Admin sets up vendors, projects, workflows and users → Admin raises Purchase Orders
and assigns vendors → the vendor submits a claim (amount, invoice, documents) against a PO → the claim is
attested by a chain of officers (PM → TPA → JD-Infra → APTS Manager, or manual officer-to-officer
assignment) → the APTS Manager approves & completes it. Every step needs remarks and is recorded in an
immutable attestation trail.

| Folder | Stack |
|---|---|
| `backend/` | Node.js 20+ · Express 5 · MySQL 8 · JWT (access + rotating refresh cookie) |
| `frontend/` | React 19 · Vite · Bootstrap 5 · PDF.js |

Detailed API documentation: [`backend/README.md`](backend/README.md) · Security review: [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md)

---

## Run it on your computer

### 1. Install the prerequisites

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20.6 or newer (22 LTS recommended) | `node -v` |
| MySQL Server | 8.0 or newer | `mysql --version` |
| Git | any | `git --version` |
| Python 3 + pip | optional, only to run the API test suite | `python3 --version` |

### 2. Get the code

```bash
git clone https://github.com/Rakeshkumar-369/APTS-Bills-Tracking.git
cd APTS-Bills-Tracking
```

### 3. Create the database

Open a MySQL prompt as an administrator (`mysql -u root -p`) and create a dedicated user for the app
(choose your own password):

```sql
CREATE DATABASE IF NOT EXISTS apts_bills_tracking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'apts_app'@'localhost' IDENTIFIED BY 'Choose-A-Strong-Password-1';
GRANT ALL PRIVILEGES ON apts_bills_tracking.* TO 'apts_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Load the schema and the demo data (run from the repository folder):

```bash
mysql -u root -p apts_bills_tracking < backend/database/schema.sql
mysql -u root -p apts_bills_tracking < backend/database/seed.sql
```

> **Already have a database from an older version?** Don't reload `schema.sql` (it drops tables).
> Apply only the migrations you have not run yet, in order — the newest is
> `mysql -u root -p < backend/database/migration_v8.sql` (adds claim amount / invoice fields and indexes).

### 4. Configure and start the backend

```bash
cd backend
cp .env.example .env          # Windows: copy .env.example .env
```

Edit `backend/.env` and set at least:

```ini
DB_USER=apts_app
DB_PASSWORD=Choose-A-Strong-Password-1
JWT_SECRET=<long random value>
REFRESH_TOKEN_SECRET=<a different long random value>
```

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Then install and run:

```bash
npm install
npm run dev                   # http://localhost:5000  (auto-restarts on code changes)
```

You should see `Server running on 127.0.0.1:5000` and `MySQL Database connected successfully`.

### 5. Start the frontend (in a second terminal)

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Open **http://localhost:5173** in your browser. The dev server forwards `/api` calls to the backend, so
no extra configuration is needed.

### 6. Sign in with the demo accounts

The login page shows one-click demo buttons in development builds (they are removed from production builds).

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@apts.gov.in` | `Admin@123` |
| Vendor (Akshara Enterprises) | `vendor@example.com` | `password123` |
| PM | `pm_user@apts.gov.in` | `password123` |
| TPA | `tpa_user@apts.gov.in` | `password123` |
| JD-Infra | `jd_infra@apts.gov.in` | `password123` |
| APTS Manager | `apts_manager@apts.gov.in` | `password123` |

> Change these passwords (or delete the demo users) before using real data.

**Try the full flow:**
1. **Super Admin** → *Purchase Orders* → create a PO for project *Video Conferencing* and vendor *Akshara Enterprises* (enter a PO amount).
2. **Vendor** → *Claim Submission* → *Video Conferencing* → pick the PO → *Submit New Claim / Bill* → enter amount, invoice number, attach the invoice PDF → *Submit Claim*.
3. **PM**, then **TPA**, then **JD-Infra** → *Inbox* → open the claim → *Forward* with remarks.
4. **APTS Manager** → *Inbox* → open the claim → *Approve & Complete*.

Only one session per user is allowed — signing in elsewhere signs out the earlier session. Use separate
browsers (or a private window) to be logged in as two roles at the same time.

### 7. Run the tests (optional)

With the backend running:

```bash
pip install requests fpdf2
cd backend
RATE_LIMIT_AUTH_MAX=1000 npm run dev   # in one terminal (raises the login rate limit for repeated test runs)
python3 tests/test_api.py              # in another terminal — 132 end-to-end checks
```

Frontend lint / production build:

```bash
cd frontend
npm run lint
npm run build
```

---

## Production deployment (summary)

```bash
cd frontend && npm ci && npm run build          # creates frontend/dist
cd ../backend && npm ci --omit=dev
# backend/.env: NODE_ENV=production, FRONTEND_ORIGIN=https://your-domain, DB_SSL=true, TRUST_PROXY=loopback
npm start                                        # serves the API and frontend/dist on one origin
```

Put Nginx (or another reverse proxy) with **HTTPS (TLS 1.2+)** in front, keep MySQL on a private network,
and run the app with a process manager (PM2 / systemd). See the deployment checklist in
[`SECURITY_AUDIT.md`](SECURITY_AUDIT.md#deployment-checklist).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing required environment variable: …` | A value in `backend/.env` is empty — every variable without a default must be set (including `DB_PASSWORD`). |
| `Database connection failed` | Check MySQL is running and the `DB_*` values; the user needs rights on `apts_bills_tracking`. |
| Login says *Too many login attempts* | Rate limit (20 per 15 min per IP) — wait, or raise `RATE_LIMIT_AUTH_MAX` in development. |
| *Account temporarily blocked* | 5 wrong passwords lock that account for 15 minutes. |
| Signed out unexpectedly | Sessions end after 30 minutes of inactivity, after `REFRESH_TOKEN_EXPIRES_IN` (default 8h), or when the same user signs in elsewhere. |
| Upload rejected | Only PDF, JPG, PNG, WEBP up to 25 MB, and the file content must match its extension. |
