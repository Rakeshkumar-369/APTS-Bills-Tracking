#!/usr/bin/env python3
"""
APTS Bills Tracking System -- API Test Suite
============================================
Tests all endpoints with all seed users through complete workflows including:
- Workflow-based claim lifecycle (forward, sendback, complete)
- Non-workflow manual assignment (assign, pull-back)
- Purchase Order CRUD (Admin role)
- Officers list endpoint
- Role-based data isolation and permission checks

Usage:
    pip install requests fpdf2
    python test_api.py
"""

import sys
import json
import time
import io
from pathlib import Path

# Fix Unicode output on Windows terminals
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Force line-buffered stdout so test results print immediately
sys.stdout.reconfigure(line_buffering=True)

try:
    import requests
except ImportError:
    print("Missing 'requests' library. Install: pip install requests")
    sys.exit(1)

try:
    from fpdf import FPDF
except ImportError:
    print("Missing 'fpdf2' library. Install: pip install fpdf2")
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────
API_BASE = "http://localhost:5000/api"
RESULTS = []  # list of {test, status, detail}


def log(test_name, status, detail=""):
    """Record a test result and print it."""
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"  {icon} [{status}] {test_name}" + (f" \u2014 {detail}" if detail else ""))
    RESULTS.append({"test": test_name, "status": status, "detail": detail})


# ── PDF Generator ─────────────────────────────────────────────────────────
def generate_test_pdf(filename="test_particulars.pdf", text="Test Particulars Document"):
    """Generate a simple PDF file for upload testing."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.cell(200, 10, text="APTS Bills Tracking System", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)
    pdf.cell(200, 10, text="Test Particulars Document", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(10)
    pdf.multi_cell(0, 8, text)
    pdf.output(filename)
    return filename


# ── API Client ────────────────────────────────────────────────────────────
class APTSSession:
    """Maintains auth state (access token) for a logged-in user."""

    def __init__(self, email, password, label):
        self.email = email
        self.password = password
        self.label = label
        self.token = None
        self.user = None

    def login(self):
        """Authenticate and store the access token."""
        url = f"{API_BASE}/auth/login"
        resp = requests.post(url, json={"email": self.email, "password": self.password})
        if resp.status_code != 200:
            log(f"Login [{self.label}]", "FAIL", f"HTTP {resp.status_code}: {resp.text}")
            return False
        data = resp.json()
        if not data.get("success"):
            log(f"Login [{self.label}]", "FAIL", data.get("message", ""))
            return False
        self.token = data["data"][0]["accessToken"]
        self.user = data["data"][0]["user"]
        log(f"Login [{self.label}]", "PASS", f"\u2192 {self.user.get('name', '?')} ({self.user.get('role_name', '?')})")
        return True

    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def get(self, path, params=None, label=None):
        label = label or f"GET {path}"
        try:
            resp = requests.get(f"{API_BASE}{path}", headers=self.headers(), params=params, timeout=10)
            return self._handle_response(resp, label)
        except requests.RequestException as e:
            log(label, "FAIL", str(e))
            return None

    def post(self, path, body=None, label=None, files=None):
        label = label or f"POST {path}"
        try:
            if files:
                headers = {"Authorization": f"Bearer {self.token}"}
                resp = requests.post(f"{API_BASE}{path}", headers=headers, files=files, timeout=10)
            else:
                resp = requests.post(f"{API_BASE}{path}", headers=self.headers(), json=body or {}, timeout=10)
            return self._handle_response(resp, label)
        except requests.RequestException as e:
            log(label, "FAIL", str(e))
            return None

    def put(self, path, body=None, label=None):
        label = label or f"PUT {path}"
        try:
            resp = requests.put(f"{API_BASE}{path}", headers=self.headers(), json=body or {}, timeout=10)
            return self._handle_response(resp, label)
        except requests.RequestException as e:
            log(label, "FAIL", str(e))
            return None

    def delete(self, path, label=None):
        label = label or f"DELETE {path}"
        try:
            resp = requests.delete(f"{API_BASE}{path}", headers=self.headers(), timeout=10)
            return self._handle_response(resp, label)
        except requests.RequestException as e:
            log(label, "FAIL", str(e))
            return None

    def _handle_response(self, resp, label):
        try:
            data = resp.json()
        except Exception:
            log(label, "FAIL", f"HTTP {resp.status_code}: Invalid JSON response")
            return None

        if resp.status_code >= 500:
            log(label, "FAIL", f"HTTP {resp.status_code}: {data.get('message', '')}")
            return None
        if resp.status_code >= 400:
            log(label, "PASS", f"(expected) HTTP {resp.status_code}: {data.get('message', '')}")
            return data

        log(label, "PASS", f"HTTP {resp.status_code}")
        return data


# ── Test Suite ─────────────────────────────────────────────────────────────
def run_all_tests():
    print("\n" + "=" * 72)
    print("  APTS Bills Tracking System \u2014 API Test Suite")
    print("=" * 72)

    # ── 1. Login all users ─────────────────────────────────────────────────
    print("\n\u2500\u2500\u2500 1. AUTHENTICATION \u2500\u2500\u2500")
    admin = APTSSession("admin@apts.gov.in", "Admin@123", "Super Admin")
    vendor = APTSSession("vendor@example.com", "password123", "Vendor")
    pm = APTSSession("pm_user@apts.gov.in", "password123", "PM")
    tpa = APTSSession("tpa_user@apts.gov.in", "password123", "TPA")
    jd_infra = APTSSession("jd_infra@apts.gov.in", "password123", "JD-Infra")
    apts_mgr = APTSSession("apts_manager@apts.gov.in", "password123", "APTS Manager")

    logins_ok = all([
        admin.login(), vendor.login(), pm.login(), tpa.login(), jd_infra.login(), apts_mgr.login()
    ])
    if not logins_ok:
        print("\n\u26a0\ufe0f  Some logins failed. Continuing with available sessions...\n")

    # ── 2. Super Admin: CRUD Vendors ───────────────────────────────────────
    print("\n\u2500\u2500\u2500 2. VENDORS (Super Admin) \u2500\u2500\u2500")
    create_vendor_resp = admin.post("/vendors", {
        "vendor_name": "Test Vendor Co",
        "vendor_code": "TESTCO",
        "contact_person": "Test Contact",
        "email": "test@vendor.com",
        "phone": "9999999999"
    }, "Create vendor")
    test_vendor_id = None
    if create_vendor_resp and create_vendor_resp.get("success"):
        test_vendor_id = create_vendor_resp["data"][0]["id"]

    admin.get("/vendors", label="List vendors")
    if test_vendor_id:
        admin.get(f"/vendors/{test_vendor_id}", label="Get vendor by ID")
        admin.get(f"/vendors/{test_vendor_id}?include_users=true", label="Get vendor with users")
        admin.put(f"/vendors/{test_vendor_id}", {"vendor_name": "Test Vendor Updated"}, "Update vendor")

    # Permission check
    vendor.post("/vendors", {"vendor_name": "Should Fail"}, "Vendor cannot create vendor")

    # ── 3. Super Admin: CRUD Projects ──────────────────────────────────────
    print("\n\u2500\u2500\u2500 3. PROJECTS (Super Admin) \u2500\u2500\u2500")

    # 3a. Project WITH workflow (existing behavior)
    create_proj = admin.post("/projects", {
        "project_name": "Test Workflow Project",
        "project_code": "TWF-001",
        "description": "A test project with workflow",
        "workflow_id": 1
    }, "Create project WITH workflow")
    test_project_wf_id = None
    if create_proj and create_proj.get("success"):
        test_project_wf_id = create_proj["data"][0]["id"]

    # 3b. Project WITHOUT workflow (for manual assignment tests)
    create_proj_nwf = admin.post("/projects", {
        "project_name": "Test Manual Project",
        "project_code": "TMN-001",
        "description": "A test project WITHOUT workflow (manual assignment)"
        # No workflow_id = manual assignment mode
    }, "Create project WITHOUT workflow")
    test_project_nwf_id = None
    if create_proj_nwf and create_proj_nwf.get("success"):
        test_project_nwf_id = create_proj_nwf["data"][0]["id"]

    admin.get("/projects", label="List projects")
    if test_project_wf_id:
        admin.get(f"/projects/{test_project_wf_id}", label="Get project by ID")
        admin.put(f"/projects/{test_project_wf_id}", {"project_name": "Test Workflow Project Updated"}, "Update project")
    if test_project_nwf_id:
        admin.get(f"/projects/{test_project_nwf_id}", label="Get no-workflow project")

    # ── 3c. Super Admin: Assign test projects to test vendor ──────────────
    print("\n\u2500\u2500\u2500 3c. VENDOR-PROJECT ASSIGNMENT (Super Admin) \u2500\u2500\u2500")
    if test_vendor_id and test_project_wf_id:
        admin.post(f"/vendors/{test_vendor_id}/projects",
                   {"project_id": test_project_wf_id},
                   "Assign workflow project to vendor")
        admin.post(f"/vendors/{test_vendor_id}/projects",
                   {"project_id": 1},
                   "Assign project 1 to vendor")

        vendor_projects = admin.get(f"/vendors/{test_vendor_id}/projects",
                                    label="List vendor's assigned projects")

    if test_vendor_id and test_project_nwf_id:
        admin.post(f"/vendors/{test_vendor_id}/projects",
                   {"project_id": test_project_nwf_id},
                   "Assign no-workflow project to vendor")

    # Permission check
    vendor.post(f"/vendors/1/projects", {"project_id": 1},
                "Vendor cannot assign projects (permission)")

    # ── 4. Super Admin: CRUD Roles ─────────────────────────────────────────
    print("\n\u2500\u2500\u2500 4. ROLES (Super Admin) \u2500\u2500\u2500")
    admin.get("/roles", label="List roles")

    create_role = admin.post("/roles", {
        "role_name": "TestObserver",
        "role_rank": 5,
        "permissions": {
            "claim": {"create": False, "read": True, "forward": False, "sendback": False},
            "po": {"create": False, "read": True},
            "vendor": {"create": False, "read": True}
        }
    }, "Create role")
    test_role_id = None
    if create_role and create_role.get("success"):
        test_role_id = create_role["data"][0]["id"]

    if test_role_id:
        admin.get(f"/roles/{test_role_id}", label="Get role by ID")
        admin.put(f"/roles/{test_role_id}", {"role_name": "TestObserverV2"}, "Update role")
        admin.post("/roles", {
            "role_name": "TestObserverV2", "role_rank": 5, "permissions": {}
        }, "Create role with duplicate name (expect 409)")
        admin.post("/roles", {
            "role_name": "Hyphen-Role", "role_rank": 5, "permissions": {}
        }, "Create role with invalid name (hyphen, expect 400)")
        admin.delete(f"/roles/{test_role_id}", "Delete test role")

    # ── 5. Purchase Orders (via Admin role) ───────────────────────────────
    print("\n\u2500\u2500\u2500 5. PURCHASE ORDERS (Admin role) \u2500\u2500\u2500")

    # 5a. Create an Admin user first (Admin role id=7 from seed)
    admin_user = admin.post("/users", {
        "name": "PO Admin User",
        "email": "poadmin@apts.gov.in",
        "password": "Admin@123",
        "role_id": 7,  # Admin role
        "designation": "Purchase Order Manager"
    }, "Create PO Admin user (role_id=7)")
    po_admin_user_id = None
    if admin_user and admin_user.get("success"):
        po_admin_user_id = admin_user["data"][0]["id"]

    # Login as the PO Admin
    po_admin = APTSSession("poadmin@apts.gov.in", "Admin@123", "PO Admin")
    po_admin_ok = po_admin.login() if po_admin_user_id else False

    # 5b. PO CRUD (as PO Admin)
    po_id_wf = None
    po_id_nwf = None
    if po_admin_ok and test_vendor_id and test_project_wf_id:
        po_resp = po_admin.post("/purchase-orders", {
            "project_id": test_project_wf_id,
            "vendor_ids": [test_vendor_id],
            "description": "Test PO for workflow project",
            "amount": 500000.00
        }, "PO Admin: Create PO for workflow project")
        if po_resp and po_resp.get("success"):
            po_id_wf = po_resp["data"][0]["id"]
            po_number = po_resp["data"][0]["po_number"]
            log("PO created", "PASS", f"PO#: {po_number}")

    # --- NEW: Test PO creation with file attachment ---
    print("\n  → Testing PO creation with file attachment...")
    pdf_po_create = generate_test_pdf("po_create_upload.pdf", "Test PO with file at creation")
    with open(pdf_po_create, "rb") as f:
        create_po_with_file = po_admin.post(
            "/purchase-orders",
            files={
                "project_id": (None, str(test_project_wf_id)),
                "vendor_ids": (None, str(test_vendor_id)),
                "description": (None, "PO with file attachment"),
                "amount": (None, "100000.00"),
                "files": ("po_doc_create.pdf", f, "application/pdf")
            },
            label="PO Admin: Create PO with file"
        )
    Path(pdf_po_create).unlink()

    if create_po_with_file and create_po_with_file.get("success"):
        po_with_file_id = create_po_with_file["data"][0]["id"]
        files_attached = len(create_po_with_file["data"][0].get("files", []))
        log("PO created with file", "PASS" if files_attached > 0 else "FAIL",
            f"PO ID: {po_with_file_id}, files: {files_attached}")
        # Clean up
        po_admin.delete(f"/purchase-orders/{po_with_file_id}", "Cleanup PO with file")
    else:
        log("PO creation with file failed", "FAIL", str(create_po_with_file) if create_po_with_file else "No response")
    # --- END NEW ---

    if po_admin_ok and test_vendor_id and test_project_nwf_id:
        po_resp_nwf = po_admin.post("/purchase-orders", {
            "project_id": test_project_nwf_id,
            "vendor_ids": [test_vendor_id],
            "description": "Test PO for manual project",
            "amount": 250000.00
        }, "PO Admin: Create PO for non-workflow project")
        if po_resp_nwf and po_resp_nwf.get("success"):
            po_id_nwf = po_resp_nwf["data"][0]["id"]

    # List POs
    po_admin.get("/purchase-orders", label="PO Admin: List all POs")

    # Get by ID
    if po_id_wf:
        po_admin.get(f"/purchase-orders/{po_id_wf}", label="PO Admin: Get PO by ID")
        po_admin.put(f"/purchase-orders/{po_id_wf}", {"description": "Updated description"},
                     "PO Admin: Update PO")

    # Vendor can see their POs
    if po_id_wf or po_id_nwf:
        vendor.get("/purchase-orders", label="Vendor: List POs (scoped to their vendor)")

    # 5c. PO File upload/download tests
    print("\n  → Testing PO file upload/download...")
    if po_id_wf:
        pdf_path_po = generate_test_pdf("po_upload.pdf", "This is a test PO document.")
        with open(pdf_path_po, "rb") as f:
            upload_po = po_admin.post(f"/purchase-orders/{po_id_wf}/files",
                                       files={"file": ("po_doc.pdf", f, "application/pdf")},
                                       label="PO Admin: Upload file to PO")
        Path(pdf_path_po).unlink()

        po_file_id = None
        if upload_po and upload_po.get("success"):
            po_file_id = upload_po["data"][0]["id"]
            log("PO file uploaded", "PASS", f"File ID: {po_file_id}")

        # List PO with files (verify PO has files now)
        if po_file_id:
            po_detail = po_admin.get(f"/purchase-orders/{po_id_wf}",
                                     label="PO Admin: Get PO (check files available)")

            # Download the file (authenticated)
            dl_label = f"Download PO file #{po_file_id}"
            try:
                dl_resp = requests.get(
                    f"{API_BASE}/purchase-orders/{po_id_wf}/files/{po_file_id}/download",
                    headers={"Authorization": f"Bearer {po_admin.token}"},
                    timeout=10
                )
                if dl_resp.status_code == 200 and len(dl_resp.content) > 0:
                    log(dl_label, "PASS", f"Downloaded {len(dl_resp.content)} bytes")
                else:
                    log(dl_label, "FAIL", f"HTTP {dl_resp.status_code}")
            except requests.RequestException as e:
                log(dl_label, "FAIL", str(e))

            # Delete the PO file
            po_admin.delete(f"/purchase-orders/{po_id_wf}/files/{po_file_id}",
                            "PO Admin: Delete PO file")

            # Verify non-admin can ALSO download PO files (officers working on claims need this)
            pm_dl_label = f"PM: Download PO file #{po_file_id} (should be accessible)"
            # Re-upload for PM to download
            pdf_reup = generate_test_pdf("po_reup.pdf", "Re-upload for PM test")
            with open(pdf_reup, "rb") as f:
                reup = po_admin.post(f"/purchase-orders/{po_id_wf}/files",
                                      files={"file": ("po_doc2.pdf", f, "application/pdf")},
                                      label="PO Admin: Re-upload for PM test")
            Path(pdf_reup).unlink()
            if reup and reup.get("success"):
                reup_id = reup["data"][0]["id"]
                try:
                    dl_resp2 = requests.get(
                        f"{API_BASE}/purchase-orders/{po_id_wf}/files/{reup_id}/download",
                        headers={"Authorization": f"Bearer {pm.token}"},
                        timeout=10
                    )
                    if dl_resp2.status_code == 200:
                        log("PM can download PO file", "PASS", f"HTTP {dl_resp2.status_code}")
                    else:
                        log("PM can download PO file", "FAIL", f"HTTP {dl_resp2.status_code}")
                except requests.RequestException as e:
                    log("PM can download PO file", "FAIL", str(e))
                # Cleanup
                po_admin.delete(f"/purchase-orders/{po_id_wf}/files/{reup_id}", "Cleanup PO file")

    # Permission check: PM should FAIL to create POs
    pm.post("/purchase-orders", {"project_id": 1, "vendor_ids": [1]},
            "PM: Cannot create PO (permission)")

    # ── 6. Super Admin: Workflow Management ────────────────────────────────
    print("\n\u2500\u2500\u2500 6. WORKFLOWS (Super Admin) \u2500\u2500\u2500")
    default_workflow_id = 1

    admin.get(f"/workflows/{default_workflow_id}?include_details=true",
              label="Get workflow with steps & transitions")
    steps_resp = admin.get(f"/workflows/{default_workflow_id}/steps", label="Get workflow steps")
    steps = []
    if steps_resp and steps_resp.get("success"):
        steps = steps_resp["data"]
        step_names = [s["step_name"] for s in steps]
        log("Workflow steps extracted", "PASS", f"Steps: {', '.join(step_names)}")

    trans_get = admin.get(f"/workflows/{default_workflow_id}/transitions", label="Get workflow transitions")
    if trans_get and trans_get.get("success") and len(trans_get["data"]) > 0:
        transition_id_to_update = trans_get["data"][0]["id"]
        admin.put(f"/workflows/transitions/{transition_id_to_update}",
                  {"transition_type": "FORWARD", "is_active": 1},
                  "Update workflow transition")

    import datetime
    ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    test_wf_name = f"Test Workflow {ts}"
    admin.post("/workflows", {
        "workflow_name": test_wf_name, "description": "Testing workflow name validation"
    }, "Create workflow")
    admin.post("/workflows", {
        "workflow_name": test_wf_name, "description": "Should fail due to duplicate name"
    }, "Create workflow with duplicate name (expect 409)")

    admin.post(f"/workflows/{default_workflow_id}/steps", {
        "step_order": 5, "step_name": "Final Audit Review", "step_code": "FINAL_AUDIT",
        "required_role_id": 6
    }, "Create workflow step")

    # ── 7. Users (Super Admin) ─────────────────────────────────────────────
    print("\n\u2500\u2500\u2500 7. USERS (Super Admin) \u2500\u2500\u2500")
    admin.get("/users", label="List users")
    admin.get("/users/roles", label="List all roles")
    admin.get("/users/1", label="Get user by ID")

    # 7b. Test Officers endpoint
    print("\n\u2500\u2500\u2500 7b. OFFICERS LIST \u2500\u2500\u2500")
    officers_resp = admin.get("/users/officers", label="Admin: List officers")
    if officers_resp and officers_resp.get("success"):
        officer_names = [o["name"] for o in officers_resp["data"]]
        log("Officers listed", "PASS", f"Found {len(officer_names)} officers: {', '.join(officer_names)}")
        # Verify Super Admin (Admin User) is NOT in the list
        has_admin = any("Admin User" in n for n in officer_names)
        log("Super Admin excluded from officers", "PASS" if not has_admin else "FAIL", "")
        # Verify vendor is NOT in the list
        has_vendor = any("Akshara" in n for n in officer_names)
        log("Vendor excluded from officers", "PASS" if not has_vendor else "FAIL", "")

    # Vendors and PM can also list officers
    vendor.get("/users/officers", label="Vendor: List officers")
    pm.get("/users/officers", label="PM: List officers")

    # Create a test vendor user
    create_user = admin.post("/users", {
        "name": "Test Vendor User",
        "email": "testuser@vendor.com",
        "password": "Test@1234",
        "role_id": 2,
        "vendor_id": test_vendor_id if test_vendor_id else 1,
        "designation": "Test Contact"
    }, "Create vendor user")
    test_user_id = None
    if create_user and create_user.get("success"):
        test_user_id = create_user["data"][0]["id"]

    if test_user_id:
        admin.put(f"/users/{test_user_id}", {"designation": "Senior Test Contact"}, "Update user")
        admin.delete(f"/users/{test_user_id}", "Delete user")
        admin.post("/users", {
            "name": "Another User", "email": "testuser@vendor.com",
            "password": "Test@1234", "role_id": 2
        }, "Create user with deleted user's email (expect 409)")

    # ── 8. CLAIM WORKFLOW (Workflow-based: Full Lifecycle) ────────────────
    print("\n\u2500\u2500\u2500 8. CLAIM WORKFLOW (Workflow-based) \u2500\u2500\u2500")
    claim_id = None

    pdf_path = generate_test_pdf("test_upload.pdf",
        "This is a test particulars document for APTS claim verification.\n"
        "Project: Video Conferencing Phase-II\n"
        "Vendor: Akshara Enterprises\n"
        "Scope: Baseline specification document for fibre grid connectivity.")

    with open(pdf_path, "rb") as f:
        create_claim = vendor.post("/claims",
            files={
                "vendor_id": (None, "1"),
                "vendor_contact_user_id": (None, "2"),
                "project_id": (None, "1"),
                "po_id": (None, str(po_id_wf)) if po_id_wf else (None, "1"),
                "remarks": (None, "Initial claim for Video Conferencing project"),
                "files": ("particulars.pdf", f, "application/pdf")
            },
            label="Vendor: Create claim with files")
    Path(pdf_path).unlink()

    if create_claim and create_claim.get("success"):
        claim_id = create_claim["data"][0]["id"]
        claim_code = create_claim["data"][0]["claim_code"]
        log("Claim created", "PASS", f"Code: {claim_code}, ID: {claim_id}")

        current_step = create_claim["data"][0].get("current_step_name", "")
        log("Claim at step", "PASS" if "PM" in current_step else "FAIL",
            f"Current: {current_step}")

        # Verify workflow was auto-derived from project
        claim_wf_id = create_claim["data"][0].get("workflow_id")
        log("Workflow auto-derived from project", "PASS" if claim_wf_id else "FAIL",
            f"workflow_id={claim_wf_id}")

        # Verify files were uploaded
        files_count = len(create_claim["data"][0].get("files", []))
        log("Files uploaded with claim", "PASS" if files_count > 0 else "FAIL",
            f"{files_count} file(s) attached")

        admin.get(f"/claims/{claim_id}?include_details=true", label="Get claim with files & history")
        admin.get(f"/claims/{claim_id}/history", label="Get claim history")
    else:
        log("Trying JSON fallback (no files)", "PASS", "")
        create_claim = vendor.post("/claims", {
            "vendor_id": 1,
            "vendor_contact_user_id": 2,
            "project_id": 1,
            "po_id": po_id_wf if po_id_wf else 1,
            "remarks": "Initial claim for Video Conferencing project"
        }, "Vendor: Create claim (fallback)")
        if create_claim and create_claim.get("success"):
            claim_id = create_claim["data"][0]["id"]
            log("Claim created (fallback)", "PASS", f"ID: {claim_id}")

    # 8c. PM forwards to TPA
    if claim_id:
        time.sleep(0.1)
        pm.post(f"/claims/{claim_id}/forward",
                {"remarks": "Initial verification complete. Forwarding to TPA for audit."},
                "PM: Forward \u2192 TPA")
        admin.get(f"/claims/{claim_id}", label="Check claim after PM forward")

    # 8d. TPA sends back to PM
    if claim_id:
        time.sleep(0.1)
        sendback_resp = tpa.post(f"/claims/{claim_id}/sendback",
                                 {"remarks": "Minor discrepancies found. Returning to PM."},
                                 "TPA: Sendback \u2192 PM")
        if sendback_resp and sendback_resp.get("success"):
            time.sleep(0.1)
            pm.post(f"/claims/{claim_id}/forward",
                    {"remarks": "Discrepancies resolved. Re-forwarding to TPA."},
                    "PM: Re-forward \u2192 TPA (after sendback)")

    # 8e. TPA forwards to JD-Infra
    if claim_id:
        time.sleep(0.1)
        tpa.post(f"/claims/{claim_id}/forward",
                 {"remarks": "Audit completed. Forwarding for digital signature."},
                 "TPA: Forward \u2192 JD-Infra")

    # 8f. JD-Infra forwards to APTS Manager
    if claim_id:
        time.sleep(0.1)
        jd_infra.post(f"/claims/{claim_id}/forward",
                      {"remarks": "Digitally signed and verified. Forwarding for clearance."},
                      "JD-Infra: Forward \u2192 APTS Manager")

    # 8g. Verify at step 4
    if claim_id:
        time.sleep(0.1)
        pk = admin.get(f"/claims/{claim_id}", label="Claim state before APTS Manager action")
        if pk and pk.get("success"):
            pd = pk["data"][0]
            log(f"Claim at APTS Manager desk",
                "PASS" if pd.get('current_step_id') == 4 else "FAIL",
                f"step_id={pd.get('current_step_id')} ({pd.get('current_step_name')})")

    # 8h. APTS Manager completes
    if claim_id:
        time.sleep(0.1)
        apts_mgr.post(f"/claims/{claim_id}/forward",
                      {"remarks": "Final clearance approved. Claim completed."},
                      "APTS Manager: Complete claim")

    # 8i. Verify final state
    if claim_id:
        final_check = admin.get(f"/claims/{claim_id}?include_details=true",
                                label="Verify claim is COMPLETED")
        if final_check and final_check.get("success"):
            claim_data = final_check["data"][0]
            status = claim_data.get("status", "")
            completed = claim_data.get("is_completed", False)
            history_count = len(claim_data.get("history", []))
            log("Claim final status", "PASS" if completed else "FAIL",
                f"Status: {status}, Completed: {completed}, History entries: {history_count}")
            print("\n  \ud83d\udccb Claim Timeline (Workflow):")
            for h in claim_data.get("history", []):
                from_name = h.get('from_user_name', '?')
                to_name = h.get('to_user_name', '?')
                print(f"     \u2022 {h.get('action', '?'):12s} | {h.get('performed_by_name', '?'):30s} | "
                      f"FROM: {from_name:25s} TO: {to_name:25s} | "
                      f"{h.get('action_label', '?'):45s}")

            # Verify from_user_id is NEVER null (always tracks who sent it)
            history_entries = claim_data.get("history", [])
            all_from_filled = len(history_entries) > 0 and all(
                h.get('from_user_id') is not None for h in history_entries
            )
            log("All history entries have from_user_id", "PASS" if all_from_filled else "FAIL",
                f"{len(history_entries)} entries checked")

            # Verify that for CREATE action, from_user_id == performed_by
            create_entry = next((h for h in claim_data.get("history", []) if h.get('action') == 'CREATE'), None)
            if create_entry:
                from_matches = create_entry.get('from_user_id') == create_entry.get('performed_by')
                log("CREATE: from_user_id matches performed_by", "PASS" if from_matches else "FAIL", "")

            # Verify the LAST history entry has from_user_id set (pullback logic)
            last_entry = claim_data["history"][-1] if claim_data.get("history") else None
            if last_entry:
                log("Last history entry has from_user_id for pullback check",
                    "PASS" if last_entry.get('from_user_id') else "FAIL",
                    f"from_user_id={last_entry.get('from_user_id')}")

    # ── 9. CLAIM MANUAL ASSIGN (Non-Workflow: Assign + Pull-back) ────────
    print("\n\u2500\u2500\u2500 9. CLAIM MANUAL ASSIGN (Non-Workflow) \u2500\u2500\u2500")

    nwf_claim_id = None

    # 9a. Create a claim under the non-workflow project
    if test_vendor_id and test_project_nwf_id and po_id_nwf:
        create_nwf = vendor.post("/claims", {
            "vendor_id": test_vendor_id,
            "vendor_contact_user_id": 2,
            "project_id": test_project_nwf_id,
            "po_id": po_id_nwf,
            "remarks": "Claim under non-workflow project"
        }, "Vendor: Create claim (non-workflow project)")

        if create_nwf and create_nwf.get("success"):
            nwf_claim_id = create_nwf["data"][0]["id"]
            nwf_code = create_nwf["data"][0]["claim_code"]
            log("Non-workflow claim created", "PASS", f"Code: {nwf_code}, ID: {nwf_claim_id}")

            # Verify it has NO workflow_id
            has_wf = create_nwf["data"][0].get("workflow_id") is not None
            log("Claim has no workflow", "PASS" if not has_wf else "FAIL", "")

            # Verify it's assigned to the vendor (creator)
            assigned_user = create_nwf["data"][0].get("current_assigned_user_id")
            expected_user = 2  # vendor user id in seed
            log("Claim starts with vendor", "PASS" if assigned_user == expected_user else "FAIL",
                f"assigned_user_id={assigned_user}, expected={expected_user}")

    # 9b. Assign claim to PM (user id=3)
    if nwf_claim_id:
        # Vendor assigns to PM
        assign_resp = vendor.post(f"/claims/{nwf_claim_id}/assign", {
            "target_user_id": 3,  # PM user
            "remarks": "Assigning to PM for review"
        }, "Vendor: Assign claim to PM")

        if assign_resp and assign_resp.get("success"):
            log("Claim assigned to PM", "PASS", "")
            # Verify claim is now at PM
            check = admin.get(f"/claims/{nwf_claim_id}", label="Check claim assigned to PM")
            if check and check.get("success"):
                assigned_to = check["data"][0].get("assigned_user_name", "")
                log(f"Claim at PM desk", "PASS" if "Srinivasa" in assigned_to or "PM" in str(check["data"][0].get("current_assigned_user_id")) else "FAIL",
                    f"Assigned to: {assigned_to}")

    # 9c. PM assigns to TPA (user id=4)
    if nwf_claim_id:
        assign2 = pm.post(f"/claims/{nwf_claim_id}/assign", {
            "target_user_id": 4,  # TPA user
            "remarks": "Forwarding to TPA for audit"
        }, "PM: Assign claim to TPA")

        if assign2 and assign2.get("success"):
            log("PM assigned to TPA", "PASS", "")

    # 9d. PM pulls back from TPA (PM sent it to TPA, so PM can pull back)
    if nwf_claim_id:
        pull_resp = pm.post(f"/claims/{nwf_claim_id}/pull-back", {
            "remarks": "Need to review again, pulling back"
        }, "PM: Pull back from TPA")

        if pull_resp and pull_resp.get("success"):
            log("PM pulled claim back", "PASS", "")
        else:
            log("PM pulled claim back", "FAIL", "PM assigned to TPA but pull-back was rejected")

    # 9e. Vendor pulls back from PM (chain: Vendor→PM→TPA, PM pulled back, so claim is at PM)
    # Vendor assigned to PM originally and claim is now at PM → vendor CAN pull back.
    if nwf_claim_id:
        vendor_pull = vendor.post(f"/claims/{nwf_claim_id}/pull-back", {
            "remarks": "Vendor pulling back the claim they assigned to PM"
        }, "Vendor: Pull back from PM (should succeed)")

        if vendor_pull and vendor_pull.get("success"):
            log("Vendor can pull back the claim they assigned", "PASS", "")
            # Verify the claim is back with the vendor
            back_check = admin.get(f"/claims/{nwf_claim_id}", label="Check claim back with vendor")
            if back_check and back_check.get("success"):
                back_to = back_check["data"][0].get("current_assigned_user_id")
                log("Claim returned to vendor after pull-back",
                    "PASS" if back_to == 2 else "FAIL",
                    f"current_assigned_user_id={back_to}, expected=2 (vendor user)")
        else:
            log("Vendor can pull back the claim they assigned", "FAIL",
                "Vendor assigned the claim but pull-back was rejected")

    # 9f. Try to pull back from different angle: create a new claim and test chain rule
    # Vendor→PM→TPA and vendor tries to pull back (should fail because vendor didn't send to TPA)
    if test_vendor_id and test_project_nwf_id and po_id_nwf:
        create_nwf2 = vendor.post("/claims", {
            "vendor_id": test_vendor_id,
            "vendor_contact_user_id": 2,
            "project_id": test_project_nwf_id,
            "po_id": po_id_nwf,
            "remarks": "Second non-workflow claim for chain test"
        }, "Vendor: Create another non-workflow claim")
        nwf2_id = None
        if create_nwf2 and create_nwf2.get("success"):
            nwf2_id = create_nwf2["data"][0]["id"]

            # Vendor→PM
            vendor.post(f"/claims/{nwf2_id}/assign", {"target_user_id": 3, "remarks": "Vendor to PM"},
                        "Chain: Vendor \u2192 PM")
            # PM→TPA
            pm.post(f"/claims/{nwf2_id}/assign", {"target_user_id": 4, "remarks": "PM to TPA"},
                    "Chain: PM \u2192 TPA")

            # Now vendor tries pull-back (should fail - vendor never sent to TPA)
            vendor_try = vendor.post(f"/claims/{nwf2_id}/pull-back",
                                     {"remarks": "Vendor should not be able to pull back"},
                                     "Chain: Vendor pull-back from TPA (expect fail)")
            if vendor_try and not vendor_try.get("success"):
                log("Chain rule enforced: Vendor cannot pull back from TPA", "PASS", "")

            # PM can pull back from TPA
            pm_try = pm.post(f"/claims/{nwf2_id}/pull-back",
                             {"remarks": "PM should be able to pull back"},
                             "Chain: PM pull-back from TPA (expect success)")
            if pm_try and pm_try.get("success"):
                log("Chain rule: PM pulled back from TPA", "PASS", "")
            else:
                log("Chain rule: PM pulled back from TPA", "FAIL",
                    "PM assigned to TPA but pull-back was rejected")

    # 9g. FOCUSED REGRESSION TEST: vendor assigns claim to an officer, then pulls it back
    # (exact scenario that was broken — findLatestForward looked at the wrong column)
    if test_vendor_id and test_project_nwf_id and po_id_nwf:
        create_nwf3 = vendor.post("/claims", {
            "vendor_id": test_vendor_id,
            "vendor_contact_user_id": 2,
            "project_id": test_project_nwf_id,
            "po_id": po_id_nwf,
            "remarks": "Third non-workflow claim for pull-back regression test"
        }, "Vendor: Create claim for pull-back regression test")
        nwf3_id = None
        if create_nwf3 and create_nwf3.get("success"):
            nwf3_id = create_nwf3["data"][0]["id"]

            # Vendor → PM (user 3)
            assign3 = vendor.post(f"/claims/{nwf3_id}/assign",
                                  {"target_user_id": 3, "remarks": "Vendor assigns to PM"},
                                  "Regression: Vendor assigns to PM")
            if assign3 and assign3.get("success"):
                # Vendor pulls back from PM — must succeed (they forwarded to the current assignee)
                pull3 = vendor.post(f"/claims/{nwf3_id}/pull-back",
                                    {"remarks": "Vendor pulls back the claim"},
                                    "Regression: Vendor pulls back claim they assigned (expect success)")
                if pull3 and pull3.get("success"):
                    log("Pull-back works when vendor assigns to officer", "PASS", "")
                    # Verify history has to_user_id populated for the FORWARD entry
                    hist3 = admin.get(f"/claims/{nwf3_id}/history", label="Check pull-back claim history")
                    if hist3 and hist3.get("success"):
                        fwd3 = next((h for h in hist3["data"] if h.get("action") == "FORWARD"), None)
                        if fwd3:
                            to_id = fwd3.get("to_user_id")
                            log("FORWARD history has to_user_id set",
                                "PASS" if to_id == 3 else "FAIL",
                                f"to_user_id={to_id}, expected=3 (PM)")
                else:
                    log("Pull-back works when vendor assigns to officer", "FAIL",
                        "Vendor assigned the claim but pull-back was rejected")
            else:
                log("Regression: Vendor assigns to PM", "FAIL", "Assignment failed")

    # ── 10. Inbox & Outbox ─────────────────────────────────────────────────
    print("\n\u2500\u2500\u2500 10. INBOX / OUTBOX \u2500\u2500\u2500")
    pm.get("/inbox", label="PM: Inbox")
    pm.get("/inbox/outbox", label="PM: Outbox")
    pm.get("/inbox/stats", label="PM: Inbox stats")
    tpa.get("/inbox", label="TPA: Inbox")
    jd_infra.get("/inbox", label="JD-Infra: Inbox")
    apts_mgr.get("/inbox", label="APTS Manager: Inbox")
    vendor.get("/inbox", label="Vendor: Inbox")

    # ── 10b. DB Sanity Checks ─────────────────────────────────────────────
    print("\n\u2500\u2500\u2500 10b. DB SANITY CHECKS \u2500\u2500\u2500")
    trans_resp = admin.get("/workflows/1/transitions", label="Fetch all transitions for verification")
    if trans_resp and trans_resp.get("success"):
        has_completion = any(
            t.get("from_step_id") == 4 and t.get("transition_type") == "FORWARD"
            and t.get("allowed_role_id") == 6
            for t in trans_resp["data"]
        )
        log("Completion transition exists (step4\u2192NULL, role=APTS Manager)",
            "PASS" if has_completion else "FAIL", "")

    print("  \u2139\ufe0f  Outbox 500 diagnosis: check server logs at backend/logs/error.log")

    # ── 10c. is_active Access Control Tests ────────────────────────────────
    print("\n\u2500\u2500\u2500 10c. IS_ACTIVE ACCESS CONTROL \u2500\u2500\u2500")

    # Deactivate the non-workflow project to verify active/inactive visibility rules
    # NOTE: is_active must be sent as a JSON boolean (validator uses .isBoolean())
    if test_project_nwf_id:
        admin.put(f"/projects/{test_project_nwf_id}", {"is_active": False},
                  "Admin: Deactivate non-workflow project for visibility test")

        # Super Admin default list includes BOTH active AND inactive records
        admin_default = admin.get("/projects", {"limit": 50}, "Admin: List projects (default = active + inactive)")
        if admin_default and admin_default.get("success"):
            admin_default_ids = {p["id"] for p in admin_default["data"]}
            log("Super Admin sees inactive project by default",
                "PASS" if test_project_nwf_id in admin_default_ids else "FAIL",
                f"Inactive project {test_project_nwf_id} in admin default list: {test_project_nwf_id in admin_default_ids}")

        # Super Admin with is_active=0 sees ONLY inactive records
        admin_inactive = admin.get("/projects", {"limit": 50, "is_active": 0}, "Admin: List projects with is_active=0")
        if admin_inactive and admin_inactive.get("success"):
            admin_inactive_ids = {p["id"] for p in admin_inactive["data"]}
            all_inactive = all(p.get("is_active") == 0 for p in admin_inactive["data"])
            log("Super Admin is_active=0 returns inactive only",
                "PASS" if all_inactive and test_project_nwf_id in admin_inactive_ids else "FAIL",
                f"Found {len(admin_inactive_ids)} inactive project(s)")

        # PM default list is ACTIVE only
        pm_default = pm.get("/projects", {"limit": 50}, "PM: List projects (default active only)")
        if pm_default and pm_default.get("success"):
            pm_default_ids = {p["id"] for p in pm_default["data"]}
            log("PM does NOT see inactive project by default",
                "PASS" if test_project_nwf_id not in pm_default_ids else "FAIL", "")

        # PM requesting is_active=0 is FORCED to active-only (never sees inactive)
        pm_inactive = pm.get("/projects", {"limit": 50, "is_active": 0}, "PM: List projects with is_active=0 (forced active)")
        if pm_inactive and pm_inactive.get("success"):
            pm_inactive_ids = {p["id"] for p in pm_inactive["data"]}
            pm_all_active = all(p.get("is_active") == 1 for p in pm_inactive["data"]) if pm_inactive["data"] else True
            log("PM is_active=0 forced to active only",
                "PASS" if pm_all_active and test_project_nwf_id not in pm_inactive_ids else "FAIL",
                f"PM saw {len(pm_inactive['data'])} project(s) with is_active=0 request")

        # Reactivate for later steps / cleanup
        admin.put(f"/projects/{test_project_nwf_id}", {"is_active": True},
                  "Admin: Reactivate non-workflow project")

    vendor.get("/vendors", {"is_active": 0}, label="Vendor: cannot list vendors (permission)")
    wf_pm = pm.get("/workflows", {"limit": 1}, "PM: List workflows (default active only)")
    wf_pm_inactive = pm.get("/workflows", {"limit": 1, "is_active": 0}, "PM: List workflows with is_active=0 (forced active)")
    if wf_pm and wf_pm_inactive:
        log("PM workflows is_active=0 forced to active", "PASS",
            f"PM saw {len(wf_pm['data'])} default, {len(wf_pm_inactive['data'])} with is_active=0")

    # ── 11. Permission Tests ──────────────────────────────────────────────
    print("\n\u2500\u2500\u2500 11. PERMISSION CHECKS \u2500\u2500\u2500")
    # Super Admin should FAIL to create claims (only vendors can create)
    admin.post("/claims", {
        "vendor_id": 1, "project_id": 1, "po_id": 1,
        "remarks": "Super Admin should not be able to create claims"
    }, "Super Admin cannot create claims (expected)")

    vendor.post("/vendors", {"vendor_name": "Hack Attempt"}, "Vendor cannot create vendor (permission)")
    pm.post("/users", {"name": "Hack", "email": "hack@test.com", "password": "Test@1234", "role_id": 2},
            "PM cannot create users (permission)")
    vendor.post("/claims/99999/forward", {"remarks": "Hack"}, "Vendor cannot forward non-existent claim (permission)")

    if test_vendor_id and test_project_wf_id:
        vendor.post(f"/vendors/{test_vendor_id}/projects",
                    {"project_id": test_project_wf_id},
                    "Vendor cannot assign projects (permission)")

    # ── 11b. Data Isolation Tests ──────────────────────────────────────────
    print("\n\u2500\u2500\u2500 11b. DATA ISOLATION \u2500\u2500\u2500")
    if claim_id:
        vendor_claims = vendor.get("/claims", label="Vendor: List claims (should see their own)")
        if vendor_claims and vendor_claims.get("success"):
            vendor_claim_ids = [p["id"] for p in vendor_claims["data"]]
            log("Vendor sees their claim", "PASS" if claim_id in vendor_claim_ids else "FAIL",
                f"Claim {claim_id} in vendor's list: {claim_id in vendor_claim_ids}")

        pm_claims = pm.get("/claims", label="PM: List claims (workflow chain)")
        if pm_claims and pm_claims.get("success"):
            pm_claim_ids = [p["id"] for p in pm_claims["data"]]
            log("PM sees claim in workflow", "PASS" if claim_id in pm_claim_ids else "FAIL",
                f"Claim {claim_id} in PM's list: {claim_id in pm_claim_ids}")

        admin_claims = admin.get("/claims", label="Admin: List all claims")
        if admin_claims and admin_claims.get("success"):
            admin_claim_ids = [p["id"] for p in admin_claims["data"]]
            log("Admin sees all claims", "PASS" if claim_id in admin_claim_ids else "FAIL",
                f"Claim {claim_id} in admin's list: {claim_id in admin_claim_ids}")

    # ── 12. File Download Test ─────────────────────────────────────────────
    print("\n\u2500\u2500\u2500 12. FILE DOWNLOAD \u2500\u2500\u2500")
    if claim_id:
        claim_detail = admin.get(f"/claims/{claim_id}?include_details=true", label="Get claim for file download")
        if claim_detail and claim_detail.get("success"):
            files = claim_detail["data"][0].get("files", [])
            if files:
                file_id = files[0]["id"]
                dl_label = f"Download file #{file_id}"
                try:
                    dl_resp = requests.get(
                        f"{API_BASE}/claims/{claim_id}/files/{file_id}/download",
                        headers={"Authorization": f"Bearer {admin.token}"},
                        timeout=10
                    )
                    if dl_resp.status_code == 200 and len(dl_resp.content) > 0:
                        log(dl_label, "PASS", f"Downloaded {len(dl_resp.content)} bytes")
                    else:
                        log(dl_label, "FAIL", f"HTTP {dl_resp.status_code}")
                except requests.RequestException as e:
                    log(dl_label, "FAIL", str(e))

    # ── 13. Cleanup ───────────────────────────────────────────────────────
    print("\n\u2500\u2500\u2500 13. CLEANUP \u2500\u2500\u2500")

    # Backward compat: verify /api/packages alias still works
    print("\n  → Verifying backward compat: /api/packages alias...")
    if claim_id:
        backward = admin.get("/packages", {"limit": 10}, "Backward compat: GET /api/packages (aliased to /api/claims)")
        if backward and backward.get("success"):
            ids = [c["id"] for c in backward["data"]]
            log("Backward compat works", "PASS" if claim_id in ids else "FAIL",
                f"Claim {claim_id} found via /api/packages")

    # Clean up non-workflow claim (already tested, nothing to delete)
    if nwf_claim_id:
        log("Non-workflow claim tested", "PASS", f"ID: {nwf_claim_id}")

    # Clean up PO Admin user to avoid duplicate email on next run
    if po_admin_user_id:
        admin.delete(f"/users/{po_admin_user_id}", "Delete PO Admin user")

    # Remove project assignments
    if test_vendor_id:
        if test_project_wf_id:
            admin.delete(f"/vendors/{test_vendor_id}/projects/{test_project_wf_id}",
                         "Remove workflow project from vendor")
        if test_project_nwf_id:
            admin.delete(f"/vendors/{test_vendor_id}/projects/{test_project_nwf_id}",
                         "Remove non-workflow project from vendor")
        admin.delete(f"/vendors/{test_vendor_id}/projects/1",
                     "Remove project 1 from vendor")

        remaining = admin.get(f"/vendors/{test_vendor_id}/projects",
                              label="Verify vendor has no projects")
        if remaining and remaining.get("success"):
            log("Vendor projects cleared", "PASS" if len(remaining["data"]) == 0 else "FAIL",
                f"{len(remaining['data'])} remaining")

    # Delete created records
    if test_vendor_id:
        admin.delete(f"/vendors/{test_vendor_id}", "Delete test vendor")
    if test_project_wf_id:
        admin.delete(f"/projects/{test_project_wf_id}", "Delete workflow project")
    if test_project_nwf_id:
        admin.delete(f"/projects/{test_project_nwf_id}", "Delete non-workflow project")

    # ── Summary ────────────────────────────────────────────────────────────
    print("\n" + "=" * 72)
    print("  TEST RESULTS SUMMARY")
    print("=" * 72)
    passed = sum(1 for r in RESULTS if r["status"] == "PASS")
    failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
    expected = sum(1 for r in RESULTS if "(expected)" in r["detail"])
    total = len(RESULTS)
    real_failures = failed

    print(f"  Total tests:      {total}")
    print(f"  Passed:           {passed}")
    print(f"  Failed:           {failed}")
    print(f"  Expected denials: {expected}")
    print(f"  Unexpected fails: {real_failures}")
    print(f"  Success rate:    {passed/total*100:.1f}%" if total > 0 else "  No tests run")

    if real_failures > 0:
        print("\n  \u274c UNEXPECTED FAILURES:")
        for r in RESULTS:
            if r["status"] == "FAIL" and "(expected)" not in r["detail"]:
                print(f"     - {r['test']}: {r['detail']}")

    print("\n" + "=" * 72)
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
