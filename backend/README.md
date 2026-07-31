# APTS Bills Tracking System — Backend

Information Technology, Electronics & Communications Department — Govt of Andhra Pradesh

A bill verification and claim tracking system for vendor invoices. Supports both **workflow-based** (configurable approval chains: PM → TPA → JD-Infra → APTS Manager) and **manual assignment** (officer-to-officer forwarding with pull-back) modes. Claims are linked to **Purchase Orders** managed by an Admin role. Mandatory remarks at every step.

---

## Architecture

```
Route (HTTP) → Validator → Controller → Service → Repository → MySQL
                              ↓
                         Audit Log
```

**Stack:** Node.js + Express 5 + MySQL 8 + JWT (access + refresh tokens)

**Convention:** CommonJS (`require`/`module.exports`), functional services, class-based repositories.

### Validation Rules

All names (role names, workflow names, step names) follow these rules:

| Rule | Applied to | Regex / Check |
|------|-----------|---------------|
| **Alphabets + numbers + spaces only** | `role_name`, `workflow_name`, `step_name` | `/^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/` — no hyphens, underscores, or special chars |
| **Trimmed** | All name fields | `.trim()` runs before `.matches()` — leading/trailing spaces stripped first, then validated |
| **Unique** | `role_name`, `workflow_name` | DB `UNIQUE` constraint + app-layer 409 check on create & update |
| **Escaped** | All text fields | `.escape()` converts HTML entities to prevent XSS |

Example valid names: `Standard Workflow`, `PM 2`, `AuditStep3`
Example invalid names: `JD-Infra` (hyphen), `PM_Verify` (underscore), `  Lead ` (leading space)

---

## Complete Flow

### 1. User Types & Roles (configurable by Super Admin)

| Role | Rank | Description |
|---|---|---|
| Super Admin | 100 | System configuration (vendors, users, roles, workflows, projects, POs) — does NOT create claims |
| Admin | 80 | Purchase Order management (CRUD) + read/update access to other modules |
| Vendor | 10 | Creates and submits claims under assigned POs; responds to sendbacks |
| PM | 30 | First verification desk |
| TPA | 40 | Audit & verification desk |
| JD-Infra | 50 | Digital signature authority |
| APTS Manager | 60 | Final clearance authority |

Roles are stored in the `roles` table with a JSON `permissions` column. Super Admin can create/edit roles and their permissions dynamically.

### 2. Workflow Definition

A **workflow** is a named sequence of ordered **steps**. Each step is handled by a specific **role**. Transitions define who can move a claim from one step to the next:

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
- SENDBACK with `to_step_id = NULL` sends the claim back to the vendor
- Vendor re-submits → claim goes back to the step that sent it back

### Non-Workflow (Manual Assignment)

If a project has **no workflow assigned** (`workflow_id = NULL`), claims under that project use **manual officer assignment**:

1. **Vendor creates the claim** under a Purchase Order — it stays with the vendor
2. **Vendor assigns** the claim to any officer via `POST /api/claims/:id/assign`
3. **Officer can forward** to any other officer (except Super Admin, Admin, or the creating vendor)
4. **Pull-back** (both modes): The sender can pull back from the current step/officer via `POST /api/claims/:id/pull-back`. Chain rule: only the immediate sender can pull back.
   - **Non-workflow:** Vendor→A → Vendor can pull back. Vendor→A→B → A can pull back (from B), Vendor cannot.
   - **Workflow:** The forwarding officer can pull back from the next step to the previous step.
   - Frontend check: `claim.history[last].from_user_id === currentUserId` determines whether to show the pull-back button.

## Purchase Orders

Purchase Orders (POs) are managed by the **Admin** role (rank 80). Each PO is linked to a project and assigned to a vendor.

| Concept | Detail |
|---|---|
| **Code format** | Auto-generated: `PO-2026-0001` |
| **Statuses** | `ACTIVE`, `CLOSED`, `CANCELLED` |
| **Vendor assignment** | Admin selects one or more vendors when creating/updating the PO (send as `vendor_ids: [1, 2, 3]` or comma-separated string `"1,2,3"`) |
| **Claim link** | Every claim must reference a PO that the vendor is assigned to |
| **Vendor visibility** | Vendors only see POs assigned to them |

A vendor creates a claim under a PO → the claim is linked to both the PO and the project. The PO must belong to the same project and the vendor must be one of the assigned vendors (multi-vendor supported).

---

### 3. Claim Lifecycle (Workflow Mode)

```
[Vendor creates claim under a PO for assigned project] ──→ Step 1 (PM Desk)
       ↓                                                   ↓
  Vendor uploads files           PM reviews → FORWARD → Step 2 (TPA Desk)
                                          → SENDBACK → Vendor (for revision)
       ↓                                                   ↓
  Vendor re-submits               TPA reviews → FORWARD → Step 3 (JD-Infra Desk)
                                            → SENDBACK → Step 1 (PM)
       ↓                                                   ↓
                           JD-Infra reviews → FORWARD → Step 4 (APTS Manager)
                                           → SENDBACK → Step 2 (TPA)
       ↓                                                   ↓
                           APTS Manager reviews → COMPLETE → Claim Approved
                                                → SENDBACK → Step 3 (JD-Infra)
```

**Key creation rules:**
- **Only Vendor users** can create claims (Super Admin and officers cannot)
- **Workflow is auto-derived** from the project — if the project has no workflow, manual assignment mode is used instead
- **Every claim requires a PO** — vendor selects a PO assigned to their vendor for the chosen project
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

### Vendor-Project & PO-Vendor Assignment

| Table | Purpose | Key Columns |
|---|---|---|
| `vendor_projects` | Many-to-many: which projects each vendor can access | `vendor_id, project_id` (composite PK) |
| `po_vendors` | Many-to-many: which vendors are assigned to a Purchase Order | `po_id, vendor_id` (composite PK) |

### Claim System

| Table | Purpose | Key Columns |
|---|---|---|
| `purchase_orders` | Admin-managed POs linked to projects (vendors via `po_vendors`) | `id, po_number, project_id, status, amount` |
| `claims` | The core submission entity | `id, claim_code, vendor_id, project_id, po_id, workflow_id?, current_step_id?, current_assigned_user_id?, status, is_completed` |
| `claim_files` | Documents attached to a claim (soft-deletable) | `id, claim_id, original_name, stored_name, file_path, file_size, is_deleted` |
| `claim_history` | Immutable timeline of every movement | `id, claim_id, from_step_id?, to_step_id?, from_user_id?, to_user_id?, action, remarks, performed_by` |

**New action types in claim_history:** `CREATE`, `FORWARD`, `SENDBACK`, `COMPLETE`, `REJECT`, `RESUBMIT`, `PULL_BACK`

**from_user_id / to_user_id tracking:** Each history entry records:
- `from_user_id` — the user who SENT/initiated the action (always filled — this is the "from officer")
- `to_user_id` — the user who RECEIVED it (filled for manual assignments, null for workflow step forwards)
- The frontend can check if the last history entry's `from_user_id` matches the current logged-in user to decide whether to show the pull-back button

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
| POST | `/api/users` | `user_management.create` | Create user. Body: `{name, email, password, role_id, vendor_id?, designation?, phone?}` — **duplicate email checked against ALL users** (active + deleted) |
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
| PUT | `/api/workflows/transitions/:id` | `workflow.configure_steps` | Update transition (all fields optional). Body: `{from_step_id?, to_step_id?, transition_type?, allowed_role_id?, is_active?}` |
| DELETE | `/api/workflows/transitions/:id` | `workflow.configure_steps` | Soft-delete transition |

### Claims (Core Workflow + Manual Assignment)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/claims` | `claim.read` | List claims (scoped by role — vendors see their own, officers see involved, admin sees all). Query: `?status=&project_id=&po_id=&search=&limit=&offset=` |
| GET | `/api/claims/:id` | `claim.read` | Get claim with files + history. Query: `?include_details=true/false` |
| POST | `/api/claims` | `claim.create` | **Create claim** (multipart/form-data). Fields: `vendor_id`, `vendor_contact_user_id?`, `project_id`, `po_id`, `remarks?` + file field: `files[]` (optional, multiple). **workflow_id is auto-derived from the project** |
| POST | `/api/claims/:id/forward` | `claim.forward` | **Forward to next step** (workflow mode only). Body: `{remarks}` |
| POST | `/api/claims/:id/assign` | `claim.forward` | **Assign to officer** (non-workflow mode). Body: `{target_user_id, remarks}` |
| POST | `/api/claims/:id/pull-back` | `claim.forward` | **Pull back from current officer** (non-workflow mode). Body: `{remarks}` |
| POST | `/api/claims/:id/sendback` | `claim.sendback` | **Send back to vendor** (both modes). Body: `{remarks}` |
| POST | `/api/claims/:id/resubmit` | — | **Vendor re-submits** after revision. Body: `{remarks}` |
| GET | `/api/claims/:id/history` | `claim.read` | Get full timeline of the claim |
| POST | `/api/claims/:id/files` | `claim.update` | Upload file to existing claim (multipart, field: `file`). |
| DELETE | `/api/claims/:id/files/:fileId` | `claim.update` | Delete a file |
| GET | `/api/claims/:id/files/:fileId/download` | `claim.read` | Download/serve a file |

**Backward compatibility:** The old `/api/packages/*` routes still work via an internal alias pointing to the same claim handlers.

### Purchase Orders (Admin)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/purchase-orders` | `po.read` | List POs (filtered by vendor for Vendor users). Query: `?project_id=&vendor_id=&status=&search=&limit=&offset=` |
| GET | `/api/purchase-orders/:id` | `po.read` | Get PO by ID (includes `files` array when `?include_files=true`) |
| POST | `/api/purchase-orders` | `po.create` | Create PO (multipart/form-data). Fields: `project_id`, `vendor_ids` (array `[1,2,3]` or comma-separated string `"1,2,3"`), `description?`, `amount?` + optional file field `files[]`. Returns PO with attached files.|
| PUT | `/api/purchase-orders/:id` | `po.update` | Update PO. Body: `{project_id?, vendor_ids?, description?, amount?, status?, is_active?}` — `vendor_ids` accepts array or comma-separated string |
| DELETE | `/api/purchase-orders/:id` | `po.delete` | Soft-delete PO (sets `is_active=0`, status `CANCELLED`) |
| POST | `/api/purchase-orders/:id/files` | `po.update` | Upload file to PO (multipart, field: `file`, accepts PDF/images). Files are visible to anyone with `po.read` permission |
| DELETE | `/api/purchase-orders/:id/files/:fileId` | `po.update` | Delete a file |
| GET | `/api/purchase-orders/:id/files/:fileId/download` | `po.read` | Download/serve a PO file (authenticated) |

### Users

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/users/officers` | — | List active officers for claim assignment (excludes Super Admin, Admin, Vendor) |

### Inbox (Role-based + User-based)

| Method | Path | Description |
|---|---|---|
| GET | `/api/inbox` | Claims at your desk. **Workflow mode:** matched by `current_step.required_role_id === your role_id`. **Non-workflow mode:** matched by `current_assigned_user_id === your user_id`. Ordered by oldest first. |
| GET | `/api/inbox/outbox` | Claims you have already actioned |
| GET | `/api/inbox/stats` | Counts: `{total, pending, returned}` (combined across both modes) |

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
| (Admin PO Manager) | *no seed user yet — create via Super Admin* | — | Admin |
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
- **is_active access control** — list endpoints (`GET /api/:entity`) behave differently by role:
  - **Super Admin**: sees **both active and inactive** records by default (no filter applied). Can still pass `?is_active=0` to see only inactive, or `?is_active=1` for active-only.
  - **Everyone else**: always locked to **active records only** (`is_active = 1`) — they can never retrieve inactive records regardless of the query param.
  - The logic is centralized in `src/utils/isActiveFilter.js` — `resolveIsActiveFilter(user, rawIsActive)`. Returning `undefined` (Super Admin default) makes repositories skip the is_active condition entirely.
- **is_deleted soft delete** — the system uses a separate `is_deleted` column (BOOLEAN DEFAULT FALSE) to distinguish "deleted" from "deactivated" (is_active=0). DELETE API endpoints set `is_deleted=1` AND `deleted_at=NOW()`. Records with `is_deleted=1` are **never** returned by any query — not even to Super Admin. This preserves audit trail data while hiding truly deleted records. Users can re-register with an email that belonged to a deleted account; projects can be re-created with a project code that was previously deleted.
- **Unique constraint pattern (`deleted_at`)** — UNIQUE constraints on `email`, `role_name`, `vendor_code`, `project_code`, `workflow_name`, `po_number`, and `claim_code` now use a **generated column** that equals the unique field while active and becomes `NULL` once deleted. MySQL allows multiple NULLs in a UNIQUE index, so deleted rows can repeat the same unique value indefinitely — fixing the old 409 "already exists" error that occurred when a record was deleted, re-created with the same code, and then deleted again. Migration: `database/migration_v3.sql`.
- **Inactive user management** — Super Admin can fetch, edit and reactivate `is_active=0` users (via `findByIdForManagement`). Other roles still get 404 for inactive users.
- **File soft deletion** — `claim_files` and `po_files` also use soft deletion (`is_deleted` column). Files stay on disk and in the database after deletion. `getFiles()` only returns non-deleted files. Physical files are never removed from disk — preserving sensitive documents for future reference.
- **Friendly duplicate error handling** — MySQL `ER_DUP_ENTRY` errors are caught and returned as HTTP 409 with a clear message (e.g. "A record with this email already exists") instead of a generic 500.

---

## Future Enhancements

- Invoice submission & reconciliation (table already exists: `invoice_submissions`)
- Email notifications on workflow transitions
- Dashboard analytics with charts
- Digital signature verification
- File virus scanning
- Rate limiting on API endpoints
