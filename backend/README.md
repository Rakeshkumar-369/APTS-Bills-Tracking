# APTS Bills Tracking System — Backend

Information Technology, Electronics & Communications Department — Govt of Andhra Pradesh

A workflow-based package tracking system for vendor bill verification. Packages flow through configurable approval chains (PM → TPA → JD-Infra → APTS Manager), with mandatory remarks at every step.

---

## Architecture

```
Route (HTTP) → Validator → Controller → Service → Repository → MySQL
                              ↓
                         Audit Log
```

**Stack:** Node.js + Express 5 + MySQL 8 + JWT (access + refresh tokens)

**Convention:** CommonJS (`require`/`module.exports`), functional services, class-based repositories.

---

## Complete Flow

### 1. User Types & Roles (configurable by Super Admin)

| Role | Rank | Description |
|---|---|---|
| Super Admin | 100 | System configuration (vendors, users, roles, workflows, projects) — does NOT create packages |
| Vendor | 10 | Creates and submits packages; responds to sendbacks — only for assigned projects |
| PM | 30 | First verification desk |
| TPA | 40 | Audit & verification desk |
| JD-Infra | 50 | Digital signature authority |
| APTS Manager | 60 | Final clearance authority |

Roles are stored in the `roles` table with a JSON `permissions` column. Super Admin can create/edit roles and their permissions dynamically.

### 2. Workflow Definition

A **workflow** is a named sequence of ordered **steps**. Each step is handled by a specific **role**. Transitions define who can move a package from one step to the next:

```
[PM: Step 1] ──FORWARD──→ [TPA: Step 2] ──FORWARD──→ [JD-Infra: Step 3]
     ↑                                                      │
     │                   SENDBACK                           │ FORWARD
     │                                                      ↓
     └──── Vendor ←──SENDBACK── [APTS Manager: Step 4] ←───┘
```

**Key rules:**
- Steps cannot be skipped — only valid transitions from the current step are allowed
- Every FORWARD/SENDBACK action requires **mandatory remarks**
- SENDBACK with `to_step_id = NULL` sends the package back to the vendor
- Vendor re-submits → package goes back to the step that sent it back

### 3. Package Lifecycle

```
[Vendor creates package for an assigned project] ──→ Step 1 (PM Desk)
       ↓                                             ↓
  Vendor uploads files         PM reviews → FORWARD → Step 2 (TPA Desk)
                                        → SENDBACK → Vendor (for revision)
       ↓                                             ↓
  Vendor re-submits             TPA reviews → FORWARD → Step 3 (JD-Infra Desk)
                                          → SENDBACK → Step 1 (PM)
       ↓                                             ↓
                           JD-Infra reviews → FORWARD → Step 4 (APTS Manager)
                                           → SENDBACK → Step 2 (TPA)
       ↓                                             ↓
                           APTS Manager reviews → COMPLETE → Package Approved
                                                → SENDBACK → Step 3 (JD-Infra)
```

**Key creation rules:**
- **Only Vendor users** can create packages (Super Admin and officers cannot)
- **Workflow is auto-derived** from the project — no manual workflow selection
- **Vendors can only select projects** they have been assigned to by Super Admin

---

## Database Tables

### Core Entities

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | All login accounts | `id, email, password_hash, role_id, vendor_id, has_digital_signature` |
| `roles` | Configurable roles with JSON permissions | `id, role_name, role_rank, permissions` (JSON) |
| `vendors` | Vendor companies | `id, vendor_name, vendor_code, contact_person, email` |
| `projects` | Infrastructure project types (each linked to a workflow) | `id, project_name, project_code, workflow_id` |

### Workflow Engine

| Table | Purpose | Key Columns |
|---|---|---|
| `workflow_master` | A named workflow | `id, workflow_name` |
| `workflow_steps` | Ordered steps within a workflow | `id, workflow_id, step_order, step_name, required_role_id` |
| `workflow_step_transitions` | Who can move from which step to which | `id, from_step_id, to_step_id, transition_type (FORWARD/SENDBACK), allowed_role_id` |

### Vendor-Project Assignment

| Table | Purpose | Key Columns |
|---|---|---|
| `vendor_projects` | Many-to-many: which projects each vendor can access | `vendor_id, project_id` (composite PK) |

### Package System

| Table | Purpose | Key Columns |
|---|---|---|
| `packages` | The core submission entity | `id, package_code, vendor_id, project_id, workflow_id, current_step_id, status, is_completed` |
| `package_files` | Documents attached to a package | `id, package_id, original_name, stored_name, file_path, file_size` |
| `package_history` | Immutable timeline of every movement | `id, package_id, from_step_id, to_step_id, action, remarks, performed_by` |

### Security & Audit

| Table | Purpose |
|---|---|
| `refresh_tokens` | Hashed JWT refresh tokens with expiry |
| `blocked_users` | Brute-force protection (5 failed attempts = 15 min block) |
| `audit_logs` | Immutable record of all CUD operations (no GET logging) |

### Invoice (Future)

| Table | Purpose |
|---|---|
| `invoice_submissions` | Vendor invoices after package completion |

---

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | ❌ | Login with email/password → returns `accessToken` + sets `refreshToken` cookie |
| POST | `/api/auth/refresh` | ❌ | Rotate refresh token (uses cookie) |
| POST | `/api/auth/logout` | ❌ | Invalidate session, clear cookie |
| POST | `/api/auth/change-password` | ✅ | Change password (requires current + new password) |

**Login Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": [{
    "accessToken": "eyJ...",
    "user": { "id": 1, "name": "Admin", "email": "...", "role_name": "Super Admin", "permissions": {...} }
  }]
}
```

**All subsequent requests** must include header: `Authorization: Bearer <accessToken>`

### Users (Super Admin)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/users` | `user_management.read` | List users (paginated). Query: `?search=&role_id=&is_active=&vendor_id=&limit=&offset=` |
| GET | `/api/users/roles` | — | List all roles (for dropdowns) |
| GET | `/api/users/:id` | `user_management.read` | Get user by ID |
| POST | `/api/users` | `user_management.create` | Create user. Body: `{name, email, password, role_id, vendor_id?, designation?, phone?}` |
| PUT | `/api/users/:id` | `user_management.update` | Update user. Body: `{name?, role_id?, vendor_id?, is_active?, has_digital_signature?}` |
| DELETE | `/api/users/:id` | `user_management.delete` | Soft-delete user |

### Vendors (Super Admin)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/vendors` | `vendor.read` | List vendors (paginated). Query: `?search=&is_active=&limit=&offset=` |
| GET | `/api/vendors/:id` | `vendor.read` | Get vendor. Query: `?include_users=true` (includes contact users), `?include_projects=true` (includes assigned projects) |
| POST | `/api/vendors` | `vendor.create` | Create vendor. Body: `{vendor_name, vendor_code?, contact_person?, email?, phone?, address?}` |
| PUT | `/api/vendors/:id` | `vendor.update` | Update vendor. Body: `{vendor_name?, is_active?, ...}` |
| DELETE | `/api/vendors/:id` | `vendor.delete` | Soft-delete vendor |
| GET | `/api/vendors/:id/projects` | — | List projects assigned to this vendor |
| POST | `/api/vendors/:id/projects` | `vendor.update` | Assign a project to vendor. Body: `{project_id}` |
| DELETE | `/api/vendors/:id/projects/:projectId` | `vendor.update` | Remove a project from vendor |

### Projects (Super Admin)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/projects` | `procurement.read` | List projects (includes `workflow_name` via JOIN) |
| GET | `/api/projects/:id` | `procurement.read` | Get project by ID |
| POST | `/api/projects` | `procurement.create` | Create project. Body: `{project_name, project_code?, description?, workflow_id}` **(workflow_id required)** |
| PUT | `/api/projects/:id` | `procurement.update` | Update project. Body: `{project_name?, workflow_id?, is_active?, ...}` |
| DELETE | `/api/projects/:id` | `procurement.delete` | Soft-delete project |

### Roles (Super Admin — dynamic permissions)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/roles` | `role_management.read` | List all roles with permissions |
| GET | `/api/roles/:id` | `role_management.read` | Get role by ID |
| POST | `/api/roles` | `role_management.create` | Create role. Body: `{role_name, role_rank, permissions (JSON object)}` |
| PUT | `/api/roles/:id` | `role_management.update` | Update role/permissions |
| DELETE | `/api/roles/:id` | `role_management.delete` | Soft-delete (fails if users are assigned) |

### Workflows (Super Admin)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/workflows` | — | List workflows. Query: `?include_details=true` (includes steps + transitions) |
| GET | `/api/workflows/:id` | — | Get workflow. Query: `?include_details=true` |
| POST | `/api/workflows` | `workflow.manage` | Create workflow. Body: `{workflow_name, description?}` |
| PUT | `/api/workflows/:id` | `workflow.manage` | Update workflow |
| GET | `/api/workflows/:id/steps` | — | Get steps for a workflow |
| POST | `/api/workflows/:id/steps` | `workflow.configure_steps` | Create step. Body: `{step_order, step_name, step_code?, required_role_id}` |
| PUT | `/api/workflows/steps/:id` | `workflow.configure_steps` | Update step |
| DELETE | `/api/workflows/steps/:id` | `workflow.configure_steps` | Soft-delete step |
| GET | `/api/workflows/:id/transitions` | `workflow.configure_steps` | Get transitions |
| POST | `/api/workflows/:id/transitions` | `workflow.configure_steps` | Create transition. Body: `{from_step_id?, to_step_id, transition_type, allowed_role_id}` |
| DELETE | `/api/workflows/transitions/:id` | `workflow.configure_steps` | Soft-delete transition |

### Packages (Core Workflow)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/packages` | `package.read` | List packages (scoped by role — vendors see only their own, officers see workflow-involved, admin sees all). Query: `?status=&project_id=&search=&limit=&offset=` |
| GET | `/api/packages/:id` | `package.read` | Get package with files + history. Query: `?include_details=true/false` |
| POST | `/api/packages` | `package.create` | **Create package** (multipart/form-data). Fields: `vendor_id`, `vendor_contact_user_id?`, `project_id`, `remarks?` + file field: `files[]` (optional, multiple). **workflow_id is auto-derived from the project** |
| POST | `/api/packages/:id/forward` | `package.forward` | **Forward to next step.** Body: `{remarks}` (mandatory, min 3 chars) |
| POST | `/api/packages/:id/sendback` | `package.sendback` | **Send back to previous step.** Body: `{remarks}` (mandatory) |
| POST | `/api/packages/:id/resubmit` | — | **Vendor re-submits** after revision. Body: `{remarks}` (mandatory) |
| GET | `/api/packages/:id/history` | `package.read` | Get full timeline of the package |
| POST | `/api/packages/:id/files` | `package.update` | Upload file to existing package (multipart form-data, field: `file`, accepts PDF/images). Files can also be uploaded during package creation via the `files[]` field. |
| DELETE | `/api/packages/:id/files/:fileId` | `package.update` | Delete a file |
| GET | `/api/packages/:id/files/:fileId/download` | `package.read` | Download/serve a file |

### Inbox (Role-based)

| Method | Path | Description |
|---|---|---|
| GET | `/api/inbox` | Packages at your desk (matched by `current_step.required_role_id === your role_id`). Ordered by oldest first. |
| GET | `/api/inbox/outbox` | Packages you have already actioned |
| GET | `/api/inbox/stats` | Counts: `{total, pending, returned}` |

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- MySQL 8+
- Python 3.8+ (for API testing)

### 1. Create Database & Schema
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS apts_bills"
mysql -u root -p apts_bills < backend/database/schema.sql
```

### 2. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your MySQL credentials and JWT secrets
```

### 3. Seed Data
```bash
mysql -u root -p apts_bills < backend/database/seed.sql
```

### 4. Install & Run
```bash
cd backend
npm install
npm run dev    # or: npm start
```

### 5. Run API Tests
```bash
# Install Python dependencies
pip install requests fpdf2

# Run the test suite (update API_BASE_URL if needed)
python backend/tests/test_api.py
```

---

## Seed Data Credentials

| Name | Email | Password | Role |
|---|---|---|---|
| Admin User | admin@apts.gov.in | Admin@123 | Super Admin |
| Akshara Enterprises | vendor@example.com | password123 | Vendor |
| Sri K. Srinivasa Rao | pm_user@apts.gov.in | password123 | PM |
| Vedic Systems Audit | tpa_user@apts.gov.in | password123 | TPA |
| Sri M. Ravi Kumar | jd_infra@apts.gov.in | password123 | JD-Infra |
| Sri P. Venkataswamy | apts_manager@apts.gov.in | password123 | APTS Manager |

---

## Security

- **No hardcoded credentials** — all users/roles/permissions are database-driven
- **Parameterized queries** — no SQL injection vectors
- **JWT with session version** — logout/password-change invalidates all existing tokens
- **Refresh token rotation** — each refresh issues a new pair, old token is deleted
- **Brute-force protection** — 5 failed attempts = 15-minute account lock
- **Audit logging** — all CUD operations logged; GET requests are NOT logged
- **Mandatory remarks** — every workflow transition requires a remark
- **Hierarchy enforcement** — users can only CRUD users with roles of lower rank
- **Permissions as JSON** — fully configurable per role
- **Data isolation** — vendors see only their own packages; officers see packages where their role is in the workflow chain; admins see all packages

---

## Future Enhancements

- Invoice submission & reconciliation (table already exists: `invoice_submissions`)
- Email notifications on workflow transitions
- Dashboard analytics with charts
- Digital signature verification
- File virus scanning
- Rate limiting on API endpoints
