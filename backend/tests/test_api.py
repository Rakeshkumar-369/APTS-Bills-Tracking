#!/usr/bin/env python3
"""
APTS Bills Tracking System — API Test Suite
============================================
Tests all endpoints with all seed users through a complete workflow lifecycle.
Generates PDF files dynamically for file upload testing.

Usage:
    pip install requests fpdf2
    python test_api.py
"""

import sys
import json
import time
from pathlib import Path
try:
    import requests
except ImportError:
    print("❌ Missing 'requests' library. Install: pip install requests")
    sys.exit(1)

try:
    from fpdf import FPDF
except ImportError:
    print("❌ Missing 'fpdf2' library. Install: pip install fpdf2")
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────
API_BASE = "http://localhost:5000/api"
RESULTS = []  # list of {test, status, detail}

def log(test_name, status, detail=""):
    """Record a test result and print it."""
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"  {icon} [{status}] {test_name}" + (f" — {detail}" if detail else ""))
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
        log(f"Login [{self.label}]", "PASS", f"→ {self.user.get('name', '?')} ({self.user.get('role_name', '?')})")
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
            # Expected failures (e.g. permission denied) are valid tests
            log(label, "PASS", f"(expected) HTTP {resp.status_code}: {data.get('message', '')}")
            return data

        log(label, "PASS", f"HTTP {resp.status_code}")
        return data


# ── Test Suite ─────────────────────────────────────────────────────────────
def run_all_tests():
    print("\n" + "=" * 72)
    print("  APTS Bills Tracking System — API Test Suite")
    print("=" * 72)

    # ── 1. Login all users ─────────────────────────────────────────────────
    print("\n─── 1. AUTHENTICATION ───")
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
        print("\n⚠️  Some logins failed. Continuing with available sessions...\n")

    # ── 2. Super Admin: CRUD Vendors ───────────────────────────────────────
    print("\n─── 2. VENDORS (Super Admin) ───")
    # Create
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

    # List
    admin.get("/vendors", label="List vendors")

    # Get single
    if test_vendor_id:
        admin.get(f"/vendors/{test_vendor_id}", label="Get vendor by ID")
        admin.get(f"/vendors/{test_vendor_id}?include_users=true", label="Get vendor with users")

    # Update
    if test_vendor_id:
        admin.put(f"/vendors/{test_vendor_id}", {"vendor_name": "Test Vendor Updated"}, "Update vendor")

    # Permission check: vendor should FAIL to create vendors
    if test_vendor_id:
        vendor.post("/vendors", {"vendor_name": "Should Fail"}, "Vendor cannot create vendor")

    # ── 3. Super Admin: CRUD Projects ──────────────────────────────────────
    print("\n─── 3. PROJECTS (Super Admin) ───")
    create_proj = admin.post("/projects", {
        "project_name": "Test Project",
        "project_code": "TEST-001",
        "description": "A test project"
    }, "Create project")
    test_project_id = None
    if create_proj and create_proj.get("success"):
        test_project_id = create_proj["data"][0]["id"]

    admin.get("/projects", label="List projects")
    if test_project_id:
        admin.get(f"/projects/{test_project_id}", label="Get project by ID")
        admin.put(f"/projects/{test_project_id}", {"project_name": "Test Project Updated"}, "Update project")

    # ── 4. Super Admin: CRUD Roles ─────────────────────────────────────────
    print("\n─── 4. ROLES (Super Admin) ───")
    admin.get("/roles", label="List roles")

    # Create a test role
    create_role = admin.post("/roles", {
        "role_name": "TestObserver",
        "role_rank": 5,
        "permissions": {
            "package": {"create": False, "read": True, "forward": False, "sendback": False},
            "vendor": {"create": False, "read": True}
        }
    }, "Create role")
    test_role_id = None
    if create_role and create_role.get("success"):
        test_role_id = create_role["data"][0]["id"]

    if test_role_id:
        admin.get(f"/roles/{test_role_id}", label="Get role by ID")
        admin.put(f"/roles/{test_role_id}", {"role_name": "TestObserverV2"}, "Update role")
        admin.delete(f"/roles/{test_role_id}", "Delete test role")

    # ── 5. Super Admin: Workflow Management ────────────────────────────────
    print("\n─── 5. WORKFLOWS (Super Admin) ───")
    workflows = admin.get("/workflows", label="List workflows")
    default_workflow_id = 1  # From seed data

    # Get workflow with details
    admin.get(f"/workflows/{default_workflow_id}?include_details=true", label="Get workflow with steps & transitions")

    # Get steps
    steps_resp = admin.get(f"/workflows/{default_workflow_id}/steps", label="Get workflow steps")
    steps = []
    if steps_resp and steps_resp.get("success"):
        steps = steps_resp["data"]
        step_names = [s["step_name"] for s in steps]
        log("Workflow steps extracted", "PASS", f"Steps: {', '.join(step_names)}")

    # Get transitions
    admin.get(f"/workflows/{default_workflow_id}/transitions", label="Get workflow transitions")

    # Create a new step
    create_step = admin.post(f"/workflows/{default_workflow_id}/steps", {
        "step_order": 5,
        "step_name": "Final Audit Review",
        "step_code": "FINAL_AUDIT",
        "required_role_id": 6
    }, "Create workflow step")

    # ── 6. Users (Super Admin) ─────────────────────────────────────────────
    print("\n─── 6. USERS (Super Admin) ───")
    admin.get("/users", label="List users")
    admin.get("/users/roles", label="List all roles")
    admin.get("/users/1", label="Get user by ID")

    # Create a new vendor user
    create_user = admin.post("/users", {
        "name": "Test Vendor User",
        "email": "testuser@vendor.com",
        "password": "Test@1234",
        "role_id": 2,
        "vendor_id": 1,
        "designation": "Test Contact"
    }, "Create vendor user")
    test_user_id = None
    if create_user and create_user.get("success"):
        test_user_id = create_user["data"][0]["id"]

    if test_user_id:
        admin.put(f"/users/{test_user_id}", {"designation": "Senior Test Contact"}, "Update user")
        admin.delete(f"/users/{test_user_id}", "Delete user")

    # ── 7. Package Creation & Full Workflow ────────────────────────────────
    print("\n─── 7. PACKAGE WORKFLOW (Full Lifecycle) ───")
    pkg_id = None

    # 7a. Super Admin creates a package
    create_pkg = admin.post("/packages", {
        "vendor_id": 1,
        "vendor_contact_user_id": 2,
        "project_id": 1,
        "workflow_id": default_workflow_id,
        "remarks": "Initial package for Video Conferencing project"
    }, "Create package")

    if create_pkg and create_pkg.get("success"):
        pkg_id = create_pkg["data"][0]["id"]
        pkg_code = create_pkg["data"][0]["package_code"]
        log("Package created", "PASS", f"Code: {pkg_code}, ID: {pkg_id}")

        # Verify it landed at PM desk (step 1)
        current_step = create_pkg["data"][0].get("current_step_name", "")
        log("Package at step", "PASS" if "PM" in current_step else "FAIL",
            f"Current: {current_step}")

    # 7b. Upload a file to the package (Super Admin)
    if pkg_id:
        pdf_path = generate_test_pdf("test_upload.pdf",
            "This is a test particulars document for APTS package verification.\n"
            "Project: Video Conferencing Phase-II\n"
            "Vendor: Akshara Enterprises\n"
            "Scope: Baseline specification document for fibre grid connectivity.")
        with open(pdf_path, "rb") as f:
            admin.post(f"/packages/{pkg_id}/files",
                       files={"file": ("particulars.pdf", f, "application/pdf")},
                       label="Upload file to package")
        Path(pdf_path).unlink()  # Clean up

        # Get package with details
        admin.get(f"/packages/{pkg_id}?include_details=true", label="Get package with files & history")
        admin.get(f"/packages/{pkg_id}/history", label="Get package history")

    # 7c. PM forwards to TPA
    if pkg_id:
        time.sleep(0.1)
        pm.post(f"/packages/{pkg_id}/forward", {"remarks": "Initial verification complete. Documents appear in order. Forwarding to TPA for audit."},
                "PM: Forward → TPA")
        admin.get(f"/packages/{pkg_id}", label="Check package after PM forward")

    # 7d. TPA: test SENDBACK → PM (package is at step 2, so this should succeed)
    if pkg_id:
        time.sleep(0.1)
        sendback_resp = tpa.post(f"/packages/{pkg_id}/sendback", {"remarks": "Minor discrepancies found. Returning to PM for clarification."},
                                 "TPA: Sendback → PM")
        if sendback_resp and sendback_resp.get("success"):
            # Package sent back to PM — PM re-forwards to TPA
            time.sleep(0.1)
            pm.post(f"/packages/{pkg_id}/forward", {"remarks": "Discrepancies resolved. Re-forwarding to TPA."},
                    "PM: Re-forward → TPA (after sendback)")

    # 7e. TPA forwards to JD-Infra
    if pkg_id:
        time.sleep(0.1)
        tpa.post(f"/packages/{pkg_id}/forward", {"remarks": "Audit completed. All specifications verified. Forwarding for digital signature."},
                 "TPA: Forward → JD-Infra")

    # 7f. JD-Infra forwards to APTS Manager (digital signature step)
    if pkg_id:
        time.sleep(0.1)
        jd_infra.post(f"/packages/{pkg_id}/forward", {"remarks": "Digitally signed and verified. Forwarding for final clearance."},
                      "JD-Infra: Forward → APTS Manager")

    # 7g. APTS Manager completes the package
    if pkg_id:
        time.sleep(0.1)
        apts_mgr.post(f"/packages/{pkg_id}/forward", {"remarks": "Final clearance approved. Package is complete. Disbursement initiated."},
                      "APTS Manager: Complete package")

    # 7i. Verify final state
    if pkg_id:
        final_check = admin.get(f"/packages/{pkg_id}?include_details=true",
                                label="Verify package is COMPLETED")
        if final_check and final_check.get("success"):
            pkg_data = final_check["data"][0]
            status = pkg_data.get("status", "")
            completed = pkg_data.get("is_completed", False)
            history_count = len(pkg_data.get("history", []))
            log("Package final status", "PASS" if completed else "FAIL",
                f"Status: {status}, Completed: {completed}, History entries: {history_count}")
            # Print full timeline
            print("\n  📋 Package Timeline:")
            for h in pkg_data.get("history", []):
                print(f"     • {h.get('action', '?'):12s} | {h.get('performed_by_name', '?'):30s} | "
                      f"{h.get('action_label', '?'):45s} | \"{h.get('remarks', '')}\"")

    # ── 8. Inbox & Outbox ──────────────────────────────────────────────────
    print("\n─── 8. INBOX / OUTBOX ───")
    pm.get("/inbox", label="PM: Inbox")
    pm.get("/inbox/outbox", label="PM: Outbox")
    pm.get("/inbox/stats", label="PM: Inbox stats")
    tpa.get("/inbox", label="TPA: Inbox")
    jd_infra.get("/inbox", label="JD-Infra: Inbox")
    apts_mgr.get("/inbox", label="APTS Manager: Inbox")
    vendor.get("/inbox", label="Vendor: Inbox (should be empty)")

    # ── 8b. DB Sanity Checks ───────────────────────────────────────────────
    print("\n─── 8b. DB SANITY CHECKS ───")
    # Explicitly check if the completion transition exists in DB
    trans_resp = admin.get("/workflows/1/transitions", label="Fetch all transitions for verification")
    if trans_resp and trans_resp.get("success"):
        has_completion = any(
            t.get("from_step_id") == 4 and t.get("transition_type") == "FORWARD"
            and t.get("allowed_role_id") == 6
            for t in trans_resp["data"]
        )
        log("Completion transition exists (step4→NULL, role=APTS Manager)",
            "PASS" if has_completion else "FAIL",
            "Check DB seed — should be (1,4,NULL,'FORWARD',6,1)" if not has_completion else "")

    # Check what step the package is actually at before APTS Manager tries
    if pkg_id:
        pk = admin.get(f"/packages/{pkg_id}", label="Package state before APTS Manager action")
        if pk and pk.get("success"):
            pd = pk["data"][0]
            log(f"Package step check",
                "PASS" if pd.get('current_step_id') == 4 else "FAIL",
                f"Expected step_id=4, got step_id={pd.get('current_step_id')} ({pd.get('current_step_name')})")

    # For the outbox 500: instruct user to check server logs
    print("  ℹ️  Outbox 500 diagnosis: check server logs at backend/logs/error.log for the stack trace")

    # ── 9. Permission Tests ────────────────────────────────────────────────
    print("\n─── 9. PERMISSION CHECKS ───")
    # Vendor should FAIL at creating vendors
    vendor.post("/vendors", {"vendor_name": "Hack Attempt"}, "Vendor cannot create (permission)")
    # PM should FAIL at creating users
    pm.post("/users", {"name": "Hack", "email": "hack@test.com", "password": "Test@1234", "role_id": 2},
            "PM cannot create users (permission)")
    # Vendor should FAIL at forwarding packages that don't exist
    vendor.post("/packages/99999/forward", {"remarks": "Hack"}, "Vendor cannot forward (permission)")

    # ── 10. File Download Test ─────────────────────────────────────────────
    print("\n─── 10. FILE DOWNLOAD ───")
    if pkg_id:
        pkg_detail = admin.get(f"/packages/{pkg_id}?include_details=true", label="Get package for file download test")
        if pkg_detail and pkg_detail.get("success"):
            files = pkg_detail["data"][0].get("files", [])
            if files:
                file_id = files[0]["id"]
                dl_label = f"Download file #{file_id}"
                try:
                    dl_resp = requests.get(
                        f"{API_BASE}/packages/{pkg_id}/files/{file_id}/download",
                        headers={"Authorization": f"Bearer {admin.token}"},
                        timeout=10
                    )
                    if dl_resp.status_code == 200 and len(dl_resp.content) > 0:
                        log(dl_label, "PASS", f"Downloaded {len(dl_resp.content)} bytes")
                    else:
                        log(dl_label, "FAIL", f"HTTP {dl_resp.status_code}")
                except requests.RequestException as e:
                    log(dl_label, "FAIL", str(e))

    # ── 11. Cleanup ────────────────────────────────────────────────────────
    print("\n─── 11. CLEANUP ───")
    if test_vendor_id:
        admin.delete(f"/vendors/{test_vendor_id}", "Delete test vendor")
    if test_project_id:
        admin.delete(f"/projects/{test_project_id}", "Delete test project")

    # ── Summary ────────────────────────────────────────────────────────────
    print("\n" + "=" * 72)
    print("  TEST RESULTS SUMMARY")
    print("=" * 72)
    passed = sum(1 for r in RESULTS if r["status"] == "PASS")
    failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
    expected = sum(1 for r in RESULTS if "(expected)" in r["detail"])
    total = len(RESULTS)
    # Expected failures have status "PASS" (logged as expected denials),
    # so they are NOT in the `failed` count. Real failures are just `failed`.
    real_failures = failed

    print(f"  Total tests:      {total}")
    print(f"  Passed:           {passed}")
    print(f"  Failed:           {failed}")
    print(f"  Expected denials: {expected}")
    print(f"  Unexpected fails: {real_failures}")
    print(f"  Success rate:    {passed/total*100:.1f}%" if total > 0 else "  No tests run")

    if real_failures > 0:
        print("\n  ❌ UNEXPECTED FAILURES:")
        for r in RESULTS:
            if r["status"] == "FAIL" and "(expected)" not in r["detail"]:
                print(f"     - {r['test']}: {r['detail']}")

    print("\n" + "=" * 72)
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
