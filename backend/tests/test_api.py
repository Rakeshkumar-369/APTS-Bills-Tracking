#!/usr/bin/env python3
"""
APTS Bills Tracking System -- End-to-End API Test Suite
======================================================

Drives the REAL claim lifecycle through every role against a running backend:

  * Auth: login, refresh rotation, logout invalidation, forged-token logout
  * Setup: Super Admin creates vendors, vendor users, projects; Admin creates POs
  * Workflow claim: Vendor -> PM -> TPA -> JD-Infra -> APTS Manager, including
    internal send-back, send-back to vendor, document revision and re-submit
  * Workflow pull-back by the vendor and re-submission
  * Manual (no-workflow) claim: assign, pull-back, forward, send-back,
    re-submit and approval by the APTS Manager
  * Security regressions: object-level access (IDOR), file upload validation,
    content-type spoofing, parameter pollution, built-in role protection,
    privilege escalation, concurrent double-actions, security headers

Each run creates its own uniquely named data, so it can be run repeatedly
against the same database (seed.sql must have been loaded once).

Usage:
    pip install requests fpdf2
    # start the backend first (npm run dev); for repeated runs raise the login
    # rate limit, e.g.  RATE_LIMIT_AUTH_MAX=1000 npm run dev
    python tests/test_api.py [--base http://localhost:5000/api]
"""

import argparse
import io
import random
import string
import sys
import threading

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

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stdout.reconfigure(line_buffering=True)

parser = argparse.ArgumentParser()
parser.add_argument("--base", default="http://localhost:5000/api")
ARGS = parser.parse_args()
API = ARGS.base.rstrip("/")

SEED_PASSWORD = "password123"
NEW_PASSWORD = "Test@12345"
RUN = "".join(random.choices(string.ascii_uppercase, k=5))  # unique per run
RUN_ALPHA = "".join(random.choices(string.ascii_lowercase, k=6))

PASSED, FAILED = [], []


# ── helpers ────────────────────────────────────────────────────────────────
def check(name, condition, detail=""):
    if condition:
        PASSED.append(name)
        print(f"  ✅ {name}")
    else:
        FAILED.append(f"{name} {detail}")
        print(f"  ❌ {name}  {detail}")
    return condition


def section(title):
    print(f"\n─── {title} ───")


def make_png(w=4, h=4):
    """Minimal valid RGB PNG built with the standard library."""
    import struct, zlib
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def make_pdf(text="APTS test document"):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.cell(200, 10, text=text)
    return bytes(pdf.output())


class Client:
    def __init__(self, label):
        self.label = label
        self.s = requests.Session()
        self.token = None
        self.user = None

    def call(self, method, path, **kw):
        headers = kw.pop("headers", {})
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return self.s.request(method, f"{API}{path}", headers=headers, timeout=30, **kw)

    def get(self, path, **kw):
        return self.call("GET", path, **kw)

    def post(self, path, **kw):
        return self.call("POST", path, **kw)

    def put(self, path, **kw):
        return self.call("PUT", path, **kw)

    def delete(self, path, **kw):
        return self.call("DELETE", path, **kw)


def login(email, password, label=None):
    c = Client(label or email)
    r = c.post("/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        raise SystemExit(f"Login failed for {email}: {r.status_code} {r.text}")
    body = r.json()["data"][0]
    c.token, c.user = body["accessToken"], body["user"]
    return c


def data(r):
    try:
        return r.json().get("data", [])
    except ValueError:
        return []


def first(r):
    d = data(r)
    return d[0] if isinstance(d, list) and d else d


def expect(name, r, status):
    msg = ""
    if r.status_code != status:
        try:
            msg = f"(got {r.status_code}: {r.json().get('message')})"
        except ValueError:
            msg = f"(got {r.status_code})"
    return check(name, r.status_code == status, msg)


def claim_state(client, claim_id):
    return first(client.get(f"/claims/{claim_id}", params={"include_details": "false"}))


def inbox_ids(client):
    return {c["id"] for c in data(client.get("/inbox"))}


# ── tests ──────────────────────────────────────────────────────────────────
def main():
    print(f"API: {API}   run id: {RUN}")
    try:
        requests.get(f"{API}/nope", timeout=5)
    except requests.RequestException:
        raise SystemExit(f"Backend is not reachable at {API}. Start it first (npm run dev).")

    # ── 1. Authentication ──
    section("1. AUTHENTICATION")
    sa = login("admin@apts.gov.in", "Admin@123", "Super Admin")
    check("Super Admin login returns role", sa.user["role_name"] == "Super Admin")

    bad = Client("bad")
    r = bad.post("/auth/login", json={"email": f"nobody.{RUN_ALPHA}@apts.gov.in", "password": "x"})
    expect("Unknown email rejected with 401", r, 401)
    r = bad.post("/auth/login", json={"email": "admin@apts.gov.in", "password": "wrong"})
    expect("Wrong password rejected with 401", r, 401)
    # Successful login resets the failed counter. Single-session policy: the new
    # login invalidates the earlier Super Admin session.
    old_sa_token = sa.token
    sa = login("admin@apts.gov.in", "Admin@123", "Super Admin")
    stale = Client("stale")
    stale.token = old_sa_token
    expect("Earlier session invalidated by new login (single session)", stale.get("/claims"), 401)

    pm = login("pm_user@apts.gov.in", SEED_PASSWORD, "PM")
    r = pm.post("/auth/refresh")
    check("Refresh cookie rotates access token", r.status_code == 200 and first(r).get("accessToken"))
    pm.token = first(r)["accessToken"]
    expect("Rotated access token works", pm.get("/inbox"), 200)

    # Forged (unsigned) token must NOT be able to log another user out
    import base64, json as _json
    def b64(o):
        return base64.urlsafe_b64encode(_json.dumps(o).encode()).rstrip(b"=").decode()
    forged = f"{b64({'alg': 'HS256', 'typ': 'JWT'})}.{b64({'sub': pm.user['id'], 'sv': 1})}.invalidsig"
    requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {forged}"}, timeout=10)
    expect("Forged-token logout does not kill the real session", pm.get("/inbox"), 200)

    temp = login("tpa_user@apts.gov.in", SEED_PASSWORD, "TPA-temp")
    old_token = temp.token
    temp.post("/auth/logout")
    temp.token = old_token
    expect("Access token rejected after logout", temp.get("/inbox"), 401)

    expect("Missing token -> 401", Client("anon").get("/claims"), 401)

    lock_email = f"locktest.{RUN_ALPHA}@apts.gov.in"
    codes = [bad.post("/auth/login", json={"email": lock_email, "password": "wrong"}).status_code for _ in range(6)]
    check("Account locked after 5 failed attempts", codes[:4] == [401] * 4 and codes[4] == 403 and codes[5] == 403, codes)

    # ── 2. Setup by Super Admin / Admin ──
    section("2. SETUP (Super Admin + Admin)")
    roles = {r_["role_name"]: r_["id"] for r_ in data(sa.get("/roles"))}
    check("Seed roles present", all(k in roles for k in ["Vendor", "PM", "TPA", "JD-Infra", "APTS Manager", "Admin"]))

    def create_vendor(code, name):
        r = sa.post("/vendors", json={"vendor_name": name, "vendor_code": code})
        expect(f"Create vendor {code}", r, 201)
        return first(r)["id"]

    v1 = create_vendor(f"VA{RUN}", f"Alpha Supplies {RUN}")
    v2 = create_vendor(f"VB{RUN}", f"Beta Traders {RUN}")

    def create_user(prefix, role, vendor_id=None, name="Test User"):
        email = f"{prefix}.{RUN_ALPHA}@example.com"
        body = {"name": name, "email": email, "password": NEW_PASSWORD, "role_id": roles[role]}
        if vendor_id:
            body["vendor_id"] = vendor_id
        r = sa.post("/users", json=body)
        expect(f"Create {role} user {prefix}", r, 201)
        return email

    va_email = create_user("vendora", "Vendor", v1, "Alpha Contact")
    vb_email = create_user("vendorb", "Vendor", v2, "Beta Contact")
    admin_email = create_user("poadmin", "Admin", None, "Po Admin")

    wf = data(sa.get("/workflows"))
    wf_id = next(w["id"] for w in wf if w["workflow_name"] == "Standard Vendor Package Clearance")

    r = sa.post("/projects", json={"project_name": f"Workflow Project {RUN}", "project_code": f"WF-{RUN}", "workflow_id": wf_id})
    expect("Create workflow project", r, 201)
    p_wf = first(r)["id"]
    r = sa.post("/projects", json={"project_name": f"Manual Project {RUN}", "project_code": f"MN-{RUN}"})
    expect("Create manual (no-workflow) project", r, 201)
    p_mn = first(r)["id"]

    for vid, pid in [(v1, p_wf), (v1, p_mn), (v2, p_wf)]:
        expect(f"Assign project {pid} to vendor {vid}", sa.post(f"/vendors/{vid}/projects", json={"project_id": pid}), 201)

    adm = login(admin_email, NEW_PASSWORD, "Admin")
    r = adm.post("/users", json={"name": "Sneaky", "email": f"sneaky.{RUN_ALPHA}@example.com",
                                 "password": NEW_PASSWORD, "role_id": roles["Super Admin"]})
    expect("Admin cannot create a Super Admin (privilege escalation)", r, 403)

    def create_po(project, vendor_ids, amount):
        r = adm.post("/purchase-orders", data={"project_id": project, "vendor_ids": ",".join(map(str, vendor_ids)),
                                                "amount": amount, "description": "E2E PO"},
                     files=[("files", ("po.pdf", make_pdf("PO"), "application/pdf"))])
        expect(f"Admin creates PO for project {project}", r, 201)
        return first(r)

    po1 = create_po(p_wf, [v1], 100000)
    po2 = create_po(p_mn, [v1], 50000)
    po3 = create_po(p_wf, [v2], 75000)
    check("PO has attached file", len(po1.get("files") or []) == 1)

    va = login(va_email, NEW_PASSWORD, "Vendor A")
    vb = login(vb_email, NEW_PASSWORD, "Vendor B")
    tpa = login("tpa_user@apts.gov.in", SEED_PASSWORD, "TPA")
    jd = login("jd_infra@apts.gov.in", SEED_PASSWORD, "JD-Infra")
    mgr = login("apts_manager@apts.gov.in", SEED_PASSWORD, "APTS Manager")

    po_ids_vb = {p["id"] for p in data(vb.get("/purchase-orders"))}
    check("Vendor B only sees own POs", po3["id"] in po_ids_vb and po1["id"] not in po_ids_vb)
    r = va.put(f"/purchase-orders/{po1['id']}/vendor-dates", json={"vendor_delivery_date": "2026-11-01", "installation_date": "2026-11-05"})
    expect("Vendor sets delivery / installation dates", r, 200)

    def create_claim(client, vendor_id, project, po, remarks="Claim for completed work"):
        r = client.post("/claims", data={"vendor_id": vendor_id, "project_id": project, "po_id": po, "remarks": remarks},
                        files=[("files", ("invoice.pdf", make_pdf("Invoice"), "application/pdf")),
                               ("certification_files", ("cert.pdf", make_pdf("Cert"), "application/pdf"))])
        return r

    # ── 3. Workflow claim lifecycle ──
    section("3. WORKFLOW CLAIM LIFECYCLE")
    r = create_claim(va, v1, p_wf, po1["id"])
    expect("Vendor creates workflow claim with invoice + certificate", r, 201)
    c1 = first(r)
    cid = c1["id"]
    check("Claim starts at PM step", c1["current_step_name"] == "PM Verification", c1.get("current_step_name"))
    check("Invoice and certification files stored",
          sorted(f["document_type"] for f in c1["files"]) == ["CERTIFICATION", "INVOICE"])
    check("Claim appears in PM inbox", cid in inbox_ids(pm))
    check("Claim not in TPA inbox yet", cid not in inbox_ids(tpa))

    expect("TPA cannot forward a claim at PM step", tpa.post(f"/claims/{cid}/forward", json={"remarks": "skip"}), 403)
    expect("Forward without remarks rejected", pm.post(f"/claims/{cid}/forward", json={}), 400)
    expect("PM forwards to TPA", pm.post(f"/claims/{cid}/forward", json={"remarks": "Verified by PM"}), 200)
    expect("Vendor cannot pull back after an officer processed it",
           va.post(f"/claims/{cid}/pull-back", json={"remarks": "oops"}), 400)
    expect("TPA sends back to PM", tpa.post(f"/claims/{cid}/sendback", json={"remarks": "Recheck quantities"}), 200)
    st = claim_state(pm, cid)
    check("Internal send-back returns claim to PM step", st["current_step_name"] == "PM Verification" and st["status"] == "IN_PROGRESS")
    expect("PM sends back to vendor", pm.post(f"/claims/{cid}/sendback", json={"remarks": "Attach signed invoice"}), 200)
    st = claim_state(va, cid)
    check("Claim is SENT_BACK", st["status"] == "SENT_BACK")
    check("Returned claim leaves PM inbox", cid not in inbox_ids(pm))
    check("Returned claim appears in vendor inbox", cid in inbox_ids(va))
    expect("PM cannot forward a claim that is with the vendor",
           pm.post(f"/claims/{cid}/forward", json={"remarks": "forward anyway"}), 400)

    r = va.post(f"/claims/{cid}/files", files={"file": ("revised.pdf", make_pdf("Revised"), "application/pdf")})
    expect("Vendor uploads revised document while claim is returned", r, 201)
    expect("Vendor cannot pull back a claim that is already returned",
           va.post(f"/claims/{cid}/pull-back", json={"remarks": "Already mine"}), 400)
    expect("Vendor B cannot re-submit Vendor A's claim", vb.post(f"/claims/{cid}/resubmit", json={"remarks": "hijack"}), 404)
    expect("Vendor re-submits", va.post(f"/claims/{cid}/resubmit", json={"remarks": "Signed invoice attached"}), 200)
    st = claim_state(pm, cid)
    check("Re-submitted claim returns to PM step", st["status"] == "IN_PROGRESS" and st["current_step_name"] == "PM Verification")
    expect("Vendor cannot upload once claim is back with officers",
           va.post(f"/claims/{cid}/files", files={"file": ("late.pdf", make_pdf("Late"), "application/pdf")}), 403)

    expect("PM forwards to TPA", pm.post(f"/claims/{cid}/forward", json={"remarks": "Verified OK"}), 200)
    expect("TPA forwards to JD-Infra", tpa.post(f"/claims/{cid}/forward", json={"remarks": "Audited"}), 200)
    expect("TPA cannot approve (APTS Manager only)", tpa.post(f"/claims/{cid}/approve", json={"remarks": "approve"}), 403)
    expect("JD-Infra forwards to APTS Manager", jd.post(f"/claims/{cid}/forward", json={"remarks": "Signed off"}), 200)
    check("Claim in APTS Manager inbox", cid in inbox_ids(mgr))
    expect("APTS Manager approves & completes", mgr.post(f"/claims/{cid}/approve", json={"remarks": "Cleared for payment"}), 200)
    st = first(mgr.get(f"/claims/{cid}"))
    check("Claim COMPLETED", st["status"] == "COMPLETED" and st["is_completed"] in (1, True))
    actions = [h["action"] for h in st["history"]]
    check("History records full trail",
          actions == ["CREATE", "FORWARD", "SENDBACK", "SENDBACK", "RESUBMIT", "FORWARD", "FORWARD", "FORWARD", "COMPLETE"], actions)
    expect("Completed claim cannot be approved again", mgr.post(f"/claims/{cid}/approve", json={"remarks": "again"}), 400)
    expect("Documents locked on completed claim",
           va.post(f"/claims/{cid}/files", files={"file": ("x.pdf", make_pdf(), "application/pdf")}), 400)
    check("Completed claim in PM outbox", cid in {c["id"] for c in data(pm.get("/inbox/outbox"))})

    # ── 4. Workflow pull-back ──
    section("4. WORKFLOW PULL-BACK")
    c2 = first(create_claim(va, v1, p_wf, po1["id"]))
    expect("Vendor pulls back an unprocessed claim", va.post(f"/claims/{c2['id']}/pull-back", json={"remarks": "Wrong invoice"}), 200)
    st = claim_state(va, c2["id"])
    check("Pulled-back claim is with the vendor", st["status"] == "SENT_BACK" and c2["id"] not in inbox_ids(pm))
    expect("Vendor re-submits pulled-back claim", va.post(f"/claims/{c2['id']}/resubmit", json={"remarks": "Correct invoice"}), 200)
    st = claim_state(pm, c2["id"])
    check("Re-submitted pulled-back claim restarts at PM", st["current_step_name"] == "PM Verification" and st["status"] == "IN_PROGRESS")
    expect("PM cannot pull back (vendor only)", pm.post(f"/claims/{c2['id']}/pull-back", json={"remarks": "Valid remarks text"}), 403)

    # ── 5. Concurrency ──
    section("5. CONCURRENT DOUBLE-ACTION")
    results = []

    def fwd():
        results.append(pm.post(f"/claims/{c2['id']}/forward", json={"remarks": "double click"}).status_code)

    threads = [threading.Thread(target=fwd) for _ in range(3)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    check("Only one of three simultaneous forwards succeeds", sorted(results) == [200, 403, 403], results)
    st = claim_state(pm, c2["id"])
    check("Claim moved exactly one step (TPA)", st["current_step_name"] == "TPA Audit", st.get("current_step_name"))

    # ── 6. Manual (no-workflow) claim ──
    section("6. MANUAL ASSIGNMENT CLAIM")
    r = create_claim(va, v1, p_mn, po2["id"])
    expect("Vendor creates manual claim", r, 201)
    c3 = first(r)
    mid = c3["id"]
    check("Manual claim starts with the vendor", c3["current_assigned_user_id"] == va.user["id"])
    officers = {o["role_name"]: o["id"] for o in data(va.get("/users/officers"))}
    check("Officer list excludes vendors/admins", "Vendor" not in officers and "Admin" not in officers)
    expect("Cannot assign to a vendor user",
           va.post(f"/claims/{mid}/assign", json={"target_user_id": vb.user["id"], "remarks": "to vendor"}), 400)
    expect("Vendor assigns to PM", va.post(f"/claims/{mid}/assign", json={"target_user_id": pm.user["id"], "remarks": "Please verify"}), 200)
    check("Manual claim in PM inbox", mid in inbox_ids(pm))
    expect("Vendor pulls back from PM", va.post(f"/claims/{mid}/pull-back", json={"remarks": "Add document"}), 200)
    expect("Vendor re-assigns to PM", va.post(f"/claims/{mid}/assign", json={"target_user_id": pm.user["id"], "remarks": "Updated"}), 200)
    expect("PM forwards to TPA", pm.post(f"/claims/{mid}/assign", json={"target_user_id": officers["TPA"], "remarks": "Over to TPA"}), 200)
    expect("Vendor cannot pull back two steps away", va.post(f"/claims/{mid}/pull-back", json={"remarks": "Valid remarks text"}), 400)
    expect("PM cannot act on claim no longer with them",
           pm.post(f"/claims/{mid}/assign", json={"target_user_id": officers["JD-Infra"], "remarks": "Not mine anymore"}), 403)
    expect("TPA sends back to vendor", tpa.post(f"/claims/{mid}/sendback", json={"remarks": "GST missing"}), 200)
    check("Manual returned claim in vendor inbox", mid in inbox_ids(va))
    expect("Vendor re-submits", va.post(f"/claims/{mid}/resubmit", json={"remarks": "GST added"}), 200)
    st = claim_state(tpa, mid)
    check("Re-submitted manual claim returns to TPA", st["current_assigned_user_id"] == officers["TPA"] and st["status"] == "IN_PROGRESS")
    expect("TPA cannot approve", tpa.post(f"/claims/{mid}/approve", json={"remarks": "Valid remarks text"}), 403)
    expect("TPA assigns to APTS Manager",
           tpa.post(f"/claims/{mid}/assign", json={"target_user_id": officers["APTS Manager"], "remarks": "For clearance"}), 200)
    expect("APTS Manager approves manual claim", mgr.post(f"/claims/{mid}/approve", json={"remarks": "Approved"}), 200)
    check("Manual claim COMPLETED", claim_state(mgr, mid)["status"] == "COMPLETED")

    # ── 7. Object-level access control (IDOR) ──
    section("7. ACCESS CONTROL (IDOR)")
    file_id = c1["files"][0]["id"]
    expect("Vendor B cannot view Vendor A's claim", vb.get(f"/claims/{cid}"), 404)
    expect("Vendor B cannot view Vendor A's claim history", vb.get(f"/claims/{cid}/history"), 404)
    expect("Vendor B cannot download Vendor A's document", vb.get(f"/claims/{cid}/files/{file_id}/download"), 404)
    expect("Vendor B cannot view Vendor A's PO", vb.get(f"/purchase-orders/{po1['id']}"), 404)
    po_file = po1["files"][0]["id"]
    expect("Vendor B cannot download Vendor A's PO file", vb.get(f"/purchase-orders/{po1['id']}/files/{po_file}/download"), 404)
    expect("Vendor B cannot read Vendor A's company record", vb.get(f"/vendors/{v1}?include_users=true"), 404)
    expect("Vendor B cannot list Vendor A's projects", vb.get(f"/vendors/{v1}/projects"), 404)
    vlist = data(vb.get("/vendors"))
    check("Vendor list shows only own company", [v["id"] for v in vlist] == [v2])
    vb_claims = {c["id"] for c in data(vb.get("/claims"))}
    check("Vendor B claim list excludes Vendor A claims", cid not in vb_claims and mid not in vb_claims)
    expect("Vendor B cannot delete Vendor A's file", vb.delete(f"/claims/{cid}/files/{file_id}"), 404)
    expect("Vendor A can download own document", va.get(f"/claims/{cid}/files/{file_id}/download"), 200)
    expect("Officer in the chain can view claim", tpa.get(f"/claims/{cid}"), 200)
    expect("Vendor cannot list roles with permissions", va.get("/users/roles"), 403)

    # ── 8. Upload validation ──
    section("8. FILE UPLOAD VALIDATION")
    c4 = first(create_claim(va, v1, p_mn, po2["id"]))
    r = va.post(f"/claims/{c4['id']}/files", files={"file": ("evil.pdf", b"<html><script>alert(1)</script></html>", "application/pdf")})
    expect("HTML disguised as PDF rejected", r, 400)
    r = va.post(f"/claims/{c4['id']}/files", files={"file": ("evil.html", b"<html></html>", "text/html")})
    expect("Disallowed extension rejected", r, 400)
    r = va.post(f"/claims/{c4['id']}/files", files={"file": ("doc.pdf", make_pdf(), "text/html")})
    expect("Valid PDF with spoofed MIME accepted", r, 201)
    fid = first(r)["id"]
    d = va.get(f"/claims/{c4['id']}/files/{fid}/download")
    check("Download served as application/pdf (not attacker MIME)", d.headers.get("Content-Type", "").startswith("application/pdf"),
          d.headers.get("Content-Type"))
    check("Download carries sandbox CSP", "sandbox" in d.headers.get("Content-Security-Policy", ""))
    r = va.post(f"/claims/{c4['id']}/files", files={"file": ("photo.png", make_png(), "image/png")})
    expect("Valid PNG image accepted (re-encoded, metadata stripped)", r, 201)
    img = va.get(f"/claims/{c4['id']}/files/{first(r)['id']}/download")
    check("Image served as image/png", img.status_code == 200 and img.headers.get("Content-Type", "").startswith("image/png"))
    r = va.post(f"/claims/{c4['id']}/files", files={"file": ("fake.png", b"GIF89a not really", "image/png")})
    expect("Corrupt image rejected", r, 400)
    r = va.post("/claims", data={"vendor_id": v1, "project_id": p_mn, "po_id": po2["id"]},
                files=[("files", ("bad.pdf", b"not a pdf", "application/pdf"))])
    expect("Claim with invalid document rejected before creation", r, 400)
    pdf_part = [("files", ("inv.pdf", make_pdf(), "application/pdf"))]
    r = va.post("/claims", data={"vendor_id": v2, "project_id": p_wf, "po_id": po3["id"]}, files=pdf_part)
    expect("Vendor cannot create a claim for another vendor", r, 403)
    r = va.post("/claims", data={"vendor_id": v1, "project_id": p_wf, "po_id": po3["id"]}, files=pdf_part)
    expect("Vendor cannot claim against a PO not assigned to them", r, 403)

    # ── 9. Hardening ──
    section("9. HARDENING")
    r = sa.get("/claims?status=IN_PROGRESS&status=COMPLETED")
    expect("Repeated query parameters rejected", r, 400)
    r = sa.get("/does-not-exist")
    check("Unknown API route -> JSON 404", r.status_code == 404 and r.headers.get("Content-Type", "").startswith("application/json"))
    h = sa.get("/inbox").headers
    for header in ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]:
        check(f"Header {header} present", header in h)
    check("X-Powered-By hidden", "X-Powered-By" not in h)
    check("API responses not cached", "no-store" in h.get("Cache-Control", ""))
    expect("Built-in role cannot be renamed", sa.put(f"/roles/{roles['Vendor']}", json={"role_name": "Supplier"}), 400)
    expect("Built-in role cannot be deleted", sa.delete(f"/roles/{roles['PM']}"), 400)
    r = sa.post("/roles", json={"role_name": f"Temp{RUN}", "role_rank": 100, "permissions": {}})
    expect("Rank 100 reserved for Super Admin", r, 400)
    r = sa.post("/users", json={"name": "Long Pass", "email": f"long.{RUN_ALPHA}@example.com",
                                "password": "Aa1!" + "x" * 30, "role_id": roles["PM"]})
    expect("Long passphrases (34 chars) accepted", r, 201)

    # ── 10. Claimed amount & PO balance ──
    section("10. CLAIM AMOUNT / PO BALANCE")

    def amount_claim(amount, inv="INV/2026/001", date="2026-10-01"):
        return vb.post("/claims", data={"vendor_id": v2, "project_id": p_wf, "po_id": po3["id"], "remarks": "Amount claim",
                                        "claimed_amount": amount, "invoice_number": inv, "invoice_date": date},
                       files=[("files", ("inv.pdf", make_pdf(), "application/pdf"))])

    r = amount_claim(50000)
    expect("Claim with amount and invoice reference created", r, 201)
    created = first(r)
    check("Claim stores amount / invoice number / date",
          float(created["claimed_amount"]) == 50000 and created["invoice_number"] == "INV/2026/001" and created["invoice_date"] == "2026-10-01")
    expect("Claim exceeding remaining PO balance rejected", amount_claim(30000), 400)
    expect("Claim within remaining balance accepted", amount_claim(25000, "INV/2026/002"), 201)
    po3_now = first(vb.get(f"/purchase-orders/{po3['id']}"))
    check("PO reports claimed total", float(po3_now["claimed_total"]) == 75000, po3_now.get("claimed_total"))
    expect("Future invoice date rejected", amount_claim(1, "INV/9", "2999-01-01"), 400)
    expect("Invalid invoice number rejected", amount_claim(1, "<script>"), 400)
    expect("Negative amount rejected", amount_claim(-5), 400)

    # ── summary ──
    print("\n" + "=" * 72)
    print(f"  PASSED: {len(PASSED)}   FAILED: {len(FAILED)}")
    for f in FAILED:
        print(f"   ✗ {f}")
    print("=" * 72)
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
