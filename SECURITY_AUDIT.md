# Security Assessment — APTS Bills Tracking Portal

| | |
|---|---|
| **Application** | APTS Bills Tracking Portal (backend API + React SPA) |
| **Assessment date** | 13 October 2026 |
| **Assessment type** | Pre-audit self-assessment (white-box code review + dynamic testing) |
| **Reference standards** | OWASP Top 10 (2021), OWASP ASVS 4.0 L2, CERT-In Guidelines for Secure Application Design & Development, CERT-In Directions of 28 April 2022 (logging / time sync) |
| **Out of scope** | Digital-signature integration for the final officer (not yet built), hosting infrastructure, network / server hardening |

> **Important:** this is an internal pre-audit review done to prepare for a CERT-In empanelled audit.
> It does **not** replace the formal audit, and no "safe-to-host" certificate can be issued from it — only a
> CERT-In empanelled auditing organisation can do that. All issues found here have been fixed so the formal
> audit should start from a clean baseline. Re-test evidence: `backend/tests/test_api.py` (132 automated
> checks, all passing) plus browser tests of every role.

## Summary

| Severity | Found | Fixed |
|---|---|---|
| Critical | 2 | 2 |
| High | 7 | 7 |
| Medium | 10 | 10 |
| Low | 6 | 6 |

Dependency scan (`npm audit`): backend **0** vulnerabilities (was 12, incl. 1 critical); frontend **0** (after `npm audit fix`).

## Findings

### Critical

| ID | Finding | OWASP | Fix |
|---|---|---|---|
| C-1 | **Broken object-level authorisation (IDOR) on claims and documents.** Any logged-in user could read any claim, its history and download its invoice files by changing the ID in the URL (e.g. one vendor reading a competitor's bills). | A01 | Central object-level checks (`src/utils/accessControl.js`) on every claim view, history, file download, upload, delete and action. Vendors see only their company's claims; officers only claims in their chain. Unauthorised IDs return 404 (no enumeration). |
| C-2 | **Stored XSS via uploaded files.** Uploads were stored after an extension check only, and served with the *client-supplied* Content-Type — an HTML/JS payload named `bill.pdf` with type `text/html` would execute in the portal's origin when opened. | A03 | Every upload is now validated by content (PDF header / image decoding), images are re-encoded (metadata stripped), the stored MIME type is derived from the validated extension, and downloads are served with `X-Content-Type-Options: nosniff`, a sandboxing CSP and a safe `Content-Disposition`. |

### High

| ID | Finding | OWASP | Fix |
|---|---|---|---|
| H-1 | **IDOR on Purchase Orders and PO files** — vendors could read any PO and download its attachments. | A01 | Vendors limited to POs assigned to them; other vendors' delivery dates hidden. |
| H-2 | **Vendor data exposure** — vendor users could list all vendor companies and read other vendors' contact users and projects. | A01 | Vendor users see only their own company record and project list. |
| H-3 | **Forced logout of any user** — `/auth/logout` trusted an *unsigned* decode of the access token, so a forged token could invalidate any user's session (incl. Super Admin). | A07 | Token signature is verified before the session is revoked. |
| H-4 | **Any user could re-submit any returned claim** (`/claims/:id/resubmit` had no ownership check when no contact person was set). | A01 | Only users of the vendor that raised the claim can re-submit. |
| H-5 | **Hard-coded credentials shipped to production** — the login page bundled all demo accounts (incl. Super Admin password) into the production JavaScript. | A07 / A05 | Demo credentials are compiled only into development builds (verified absent from `dist/`). |
| H-6 | **Access token stored in `localStorage`** — readable by any injected script, enabling session theft. | A07 | Access token now kept in memory only; sessions restored via the HttpOnly, SameSite=Strict refresh cookie. |
| H-7 | **Vulnerable dependencies** — `sharp` (libvips/libheif CVEs, used on untrusted images), `exceljs`/`uuid` chain (critical), `brace-expansion`, `source-map-js`. | A06 | `sharp` upgraded to 0.35.5; unused `exceljs`, `pdf-parse`, `joi`, `bcrypt`, `nodemon` removed; remaining fixed via `npm audit fix`. |

### Medium

| ID | Finding | OWASP | Fix |
|---|---|---|---|
| M-1 | **No rate limiting** — unlimited login attempts per IP (credential stuffing across many accounts) and unlimited API calls. | A07 / A04 | Per-IP limits: 20 logins / 15 min, 600 API calls / min (configurable); proxy-aware via `TRUST_PROXY`. |
| M-2 | **User enumeration by timing** — unknown emails were compared against a weaker (cost-10, malformed) dummy hash, so responses were measurably faster than for real users. | A07 | Dummy hash generated with the same bcrypt cost (12) as real passwords. |
| M-3 | **No session timeout** — refresh tokens and cookies lived 7 days and slid forever. | A07 | Absolute session lifetime from `REFRESH_TOKEN_EXPIRES_IN` (recommended 8h, not extended by rotation) + 30-minute idle auto-logout in the browser. |
| M-4 | **Race conditions in the workflow** — two simultaneous "Forward" clicks could both pass validation and move a claim twice; claim/PO numbers could collide. | A04 | Actions on a claim are serialised; the second request re-validates and is rejected. Number generation is serialised too. (Tested with 3 parallel requests.) |
| M-5 | **Officers could act on a claim that was with the vendor** (forward / approve a `SENT_BACK` claim). | A01 | Rejected server-side until the vendor re-submits. |
| M-6 | **Uploads on any claim by anyone with `claim.update`**, and file deletion by file ID without checking it belonged to the claim / PO. | A01 | Files can be changed only by Admins or by the owning vendor while the claim is with them, never after completion; file IDs must belong to the parent record. |
| M-7 | **Memory exhaustion via uploads** — up to 70 files × 50 MB buffered in memory per request. | A04 | Max 20 files / request, 25 MB per file (configurable). |
| M-8 | **HTTP parameter pollution** — repeated query parameters (`?status=a&status=b`) reached SQL builders as arrays (500 errors). | A03 | Non-scalar query parameters rejected with 400; MySQL driver set to `stringifyObjects`, `multipleStatements: false`. |
| M-9 | **Built-in roles could be renamed / deleted / deactivated**, breaking authorisation logic that depends on role names; any role could be given rank 100. | A01 | Built-in roles protected; rank 100 reserved for Super Admin. |
| M-10 | **Role permission matrix exposed to all users** (`GET /users/roles`). | A01 | Requires `user_management.read`. |

### Low

| ID | Finding | Fix |
|---|---|---|
| L-1 | Stale role from JWT used for authorisation after a role change. | Role always read from the database on each request. |
| L-2 | Internal error messages could reach the client from the auth middleware. | Generic message; details only in server logs. |
| L-3 | Weak / inconsistent password limits (max 16 chars; UI accepted 6). | 8–64 chars with upper, lower, digit and special character, enforced in API and UI. |
| L-4 | Lockout never reset after expiry (one typo re-locked an account). | Fresh attempt counter after a lock expires. |
| L-5 | `Cache-Control: no-store` on static assets (slow) while `Expect-CT` (deprecated) and `require-corp` (breaks PDF worker) were set. | API/HTML `no-store`; fingerprinted assets cached 1 year; CSP extended with `frame-ancestors`, `object-src 'none'`, `upgrade-insecure-requests`; deprecated headers removed. |
| L-6 | Third-party CDN assets loaded without Subresource Integrity (and duplicated the bundled CSS). | CDN references removed — everything is served from the application origin. |

## Controls verified as already in place

Parameterised SQL everywhere · bcrypt (cost 12) password hashing · refresh-token rotation with hashed storage ·
single active session per user (session version) · account lockout after 5 failures · HttpOnly + SameSite=Strict
(+ Secure in production) refresh cookie · input validation with `express-validator` · audit log of all
create/update/delete, login, logout and token events with IP and user agent · soft deletes preserving evidence ·
no stack traces to clients · `X-Powered-By` removed · HSTS in production · CORS restricted to the frontend origin.

## Deployment checklist

These are infrastructure items the auditor will also check; they are outside the code:

- [ ] Serve only over **HTTPS (TLS 1.2/1.3)**, redirect HTTP→HTTPS, valid certificate; set `NODE_ENV=production`.
- [ ] Reverse proxy (Nginx) in front of Node; set `TRUST_PROXY=loopback`; hide the proxy version (`server_tokens off`).
- [ ] MySQL on a private network, `DB_SSL=true`, dedicated DB user with rights only on `apts_bills_tracking` (never root).
- [ ] Strong unique `JWT_SECRET` / `REFRESH_TOKEN_SECRET` (64+ random bytes); `.env` readable only by the service account.
- [ ] Remove or re-password the demo users from `seed.sql` before go-live.
- [ ] **Log retention ≥ 180 days** and **NTP time synchronisation** (CERT-In Directions, 28 April 2022) for `backend/logs/` and the `audit_logs` table; rotate log files.
- [ ] Back up the database and `backend/uploads/` daily; keep `uploads/` outside the web root (it is not served statically).
- [ ] Optional hardening: antivirus scan of uploaded files (e.g. ClamAV), WAF in front of the proxy, CAPTCHA on login if the auditor requires it.
- [ ] Re-run `npm audit` before every release.
