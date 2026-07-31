-- =============================================================================
-- APTS Bills Tracking System — Seed Data
-- =============================================================================
-- Pre-requisite: Run schema.sql first to create all tables.
-- Pre-computed bcrypt hashes (cost 12):
--   password123  → $2b$12$.TiUdeuTG9AM69okdwm0e.D7PgOCvblAE4aHIKR9a2q8hxQhySP76
--   Admin@123    → $2b$12$c8ZYIGMImVOhaU0T3IiAgOCtxa61ifkGEJAGXA./Cy5y9XS2R6As2
-- =============================================================================
USE `apts_bills_tracking`;

-- =============================================================================
-- 1. ROLES — Each role includes a JSON permissions object
-- =============================================================================
INSERT INTO roles (id, role_name, description, role_rank, permissions, is_active) VALUES
(1, 'Super Admin',  'Full system access -- can manage everything',          100, '{"procurement":{"create":true,"read":true,"update":true,"delete":true,"advance":true,"comment":true,"upload_document":true},"workflow":{"manage":true,"configure_steps":true},"user_management":{"create":true,"read":true,"update":true,"delete":true,"assign_role":true},"role_management":{"create":true,"read":true,"update":true,"delete":true,"assign_permissions":true},"vendor":{"create":true,"read":true,"update":true,"delete":true},"claim":{"create":false,"read":true,"update":true,"delete":true,"forward":true,"sendback":true,"approve":true},"po":{"create":true,"read":true,"update":true,"delete":true},"payment":{"create":true,"read":true},"report":{"view":true,"export":true},"audit":{"view":true}}', 1),
(2, 'Vendor',       'Vendor company employee -- can submit claims',        10,  '{"procurement":{"create":false,"read":true,"update":false,"delete":false,"advance":false,"comment":false,"upload_document":true},"workflow":{"manage":false,"configure_steps":false},"user_management":{"create":false,"read":false,"update":false,"delete":false,"assign_role":false},"role_management":{"create":false,"read":false,"update":false,"delete":false,"assign_permissions":false},"vendor":{"create":false,"read":true,"update":false,"delete":false},"claim":{"create":true,"read":true,"update":false,"delete":false,"forward":true,"sendback":false,"pull_back":true},"po":{"create":false,"read":true,"update":false,"delete":false},"payment":{"create":false,"read":true},"report":{"view":true,"export":false},"audit":{"view":false}}', 1),
(3, 'PM',           'Project Manager -- first verification desk',            30,  '{"procurement":{"create":false,"read":true,"update":false,"delete":false,"advance":true,"comment":true,"upload_document":true},"workflow":{"manage":false,"configure_steps":false},"user_management":{"create":false,"read":true,"update":false,"delete":false,"assign_role":false},"role_management":{"create":false,"read":false,"update":false,"delete":false,"assign_permissions":false},"vendor":{"create":false,"read":true,"update":false,"delete":false},"claim":{"create":false,"read":true,"update":false,"delete":false,"forward":true,"sendback":true},"po":{"create":false,"read":true,"update":false,"delete":false},"payment":{"create":false,"read":false},"report":{"view":true,"export":false},"audit":{"view":false}}', 1),
(4, 'TPA',          'Third Party Auditor -- audit and verification desk',    40,  '{"procurement":{"create":false,"read":true,"update":false,"delete":false,"advance":true,"comment":true,"upload_document":true},"workflow":{"manage":false,"configure_steps":false},"user_management":{"create":false,"read":true,"update":false,"delete":false,"assign_role":false},"role_management":{"create":false,"read":false,"update":false,"delete":false,"assign_permissions":false},"vendor":{"create":false,"read":true,"update":false,"delete":false},"claim":{"create":false,"read":true,"update":false,"delete":false,"forward":true,"sendback":true},"po":{"create":false,"read":true,"update":false,"delete":false},"payment":{"create":false,"read":false},"report":{"view":true,"export":false},"audit":{"view":false}}', 1),
(5, 'JD-Infra',     'Joint Director Infrastructure -- digital signatory',    50,  '{"procurement":{"create":false,"read":true,"update":false,"delete":false,"advance":true,"comment":true,"upload_document":true},"workflow":{"manage":false,"configure_steps":false},"user_management":{"create":false,"read":true,"update":false,"delete":false,"assign_role":false},"role_management":{"create":false,"read":false,"update":false,"delete":false,"assign_permissions":false},"vendor":{"create":false,"read":true,"update":false,"delete":false},"claim":{"create":false,"read":true,"update":false,"delete":false,"forward":true,"sendback":true},"po":{"create":false,"read":true,"update":false,"delete":false},"payment":{"create":false,"read":false},"report":{"view":true,"export":false},"audit":{"view":false}}', 1),
(6, 'APTS Manager', 'APTS Manager -- final clearance authority',             60,  '{"procurement":{"create":false,"read":true,"update":false,"delete":false,"advance":true,"comment":true,"upload_document":true},"workflow":{"manage":false,"configure_steps":false},"user_management":{"create":false,"read":true,"update":false,"delete":false,"assign_role":false},"role_management":{"create":false,"read":false,"update":false,"delete":false,"assign_permissions":false},"vendor":{"create":false,"read":true,"update":false,"delete":false},"claim":{"create":false,"read":true,"update":false,"delete":false,"forward":true,"sendback":true,"approve":true},"po":{"create":false,"read":true,"update":false,"delete":false},"payment":{"create":false,"read":false},"report":{"view":true,"export":false},"audit":{"view":false}}', 1),
(7, 'Admin',        'Purchase Order manager -- manages POs with RU on other modules', 80,
 '{"procurement":{"create":false,"read":true,"update":true,"delete":false,"advance":true,"comment":true,"upload_document":true},"workflow":{"manage":false,"configure_steps":false},"user_management":{"create":false,"read":true,"update":true,"delete":false,"assign_role":false},"role_management":{"create":false,"read":true,"update":false,"delete":false,"assign_permissions":false},"vendor":{"create":false,"read":true,"update":true,"delete":false},"claim":{"create":false,"read":true,"update":true,"delete":false,"forward":true,"sendback":true},"po":{"create":true,"read":true,"update":true,"delete":true},"payment":{"create":false,"read":true},"report":{"view":true,"export":false},"audit":{"view":true}}', 1);

-- =============================================================================
-- 2. VENDORS
-- =============================================================================
INSERT INTO vendors (id, vendor_name, vendor_code, contact_person, email, phone, address, is_active) VALUES
(1, 'Akshara Enterprises', 'AKSHARA', 'Akshara Rep', 'vendor@example.com', '9876543210', 'Hyderabad, Telangana', 1),
(2, 'TechSol India Pvt Ltd', 'TECHSOL', 'TechSol Rep', 'techsol@example.com', '9876543211', 'Visakhapatnam, AP', 1);

-- =============================================================================
-- 3. USERS -- bcrypt hashes pre-computed at cost 12
-- =============================================================================
INSERT INTO users (id, name, email, password_hash, role_id, vendor_id, designation, has_digital_signature, is_active) VALUES
(1, 'Admin User',          'admin@apts.gov.in',       '$2b$12$c8ZYIGMImVOhaU0T3IiAgOCtxa61ifkGEJAGXA./Cy5y9XS2R6As2', 1, NULL, 'System Administrator',       0, 1),
(2, 'Akshara Enterprises', 'vendor@example.com',      '$2b$12$.TiUdeuTG9AM69okdwm0e.D7PgOCvblAE4aHIKR9a2q8hxQhySP76', 2, 1,    'Vendor Contact',             0, 1),
(3, 'Sri K. Srinivasa Rao','pm_user@apts.gov.in',     '$2b$12$.TiUdeuTG9AM69okdwm0e.D7PgOCvblAE4aHIKR9a2q8hxQhySP76', 3, NULL, 'Project Manager',            0, 1),
(4, 'Vedic Systems Audit','tpa_user@apts.gov.in',     '$2b$12$.TiUdeuTG9AM69okdwm0e.D7PgOCvblAE4aHIKR9a2q8hxQhySP76', 4, NULL, 'TPA Auditor',                0, 1),
(5, 'Sri M. Ravi Kumar',   'jd_infra@apts.gov.in',    '$2b$12$.TiUdeuTG9AM69okdwm0e.D7PgOCvblAE4aHIKR9a2q8hxQhySP76', 5, NULL, 'Joint Director - Infra',     1, 1),
(6, 'Sri P. Venkataswamy', 'apts_manager@apts.gov.in','$2b$12$.TiUdeuTG9AM69okdwm0e.D7PgOCvblAE4aHIKR9a2q8hxQhySP76', 6, NULL, 'APTS Manager',               0, 1);

-- =============================================================================
-- 4. WORKFLOW MASTER
-- =============================================================================
INSERT INTO workflow_master (id, workflow_name, description, is_active) VALUES
(1, 'Standard Vendor Package Clearance', 'Default workflow: PM -> TPA -> JD-Infra -> APTS Manager (4-step clearance)', 1);

-- =============================================================================
-- 5. PROJECTS
--    workflow_id = 1 : Uses the configured workflow (automated step progression)
--    workflow_id = NULL : No workflow, claims require manual officer assignment
-- =============================================================================
INSERT INTO projects (id, project_name, project_code, description, workflow_id, is_active) VALUES
-- WITH workflow configured: claims auto-progress through PM -> TPA -> JD-Infra -> APTS Manager
(1, 'Video Conferencing', 'VC-001', 'Video Conferencing infrastructure setup  [Uses Standard Vendor Package Clearance workflow]', 1, 1),
(2, 'APSDWAN',            'APSDWAN-001', 'AP State Wide Area Network expansion  [Uses Standard Vendor Package Clearance workflow]', 1, 1),
-- WITHOUT workflow: claims require manual officer assignment (no automated steps)
(3, 'APSCAN',             'APSCAN-001', 'AP State Computerization Network  [NO workflow - manual officer assignment required]', NULL, 1);

-- =============================================================================
-- 6. WORKFLOW STEPS (for workflow_id = 1)
-- =============================================================================
INSERT INTO workflow_steps (id, workflow_id, step_order, step_name, step_code, is_optional, required_role_id, is_active) VALUES
(1, 1, 1, 'PM Verification',   'PM_VERIFY',  0, 3, 1),
(2, 1, 2, 'TPA Audit',        'TPA_AUDIT',  0, 4, 1),
(3, 1, 3, 'JD-Infra Sign-off', 'JD_SIGN',   0, 5, 1),
(4, 1, 4, 'APTS Clearance',    'APTS_CLEAR', 0, 6, 1);

-- =============================================================================
-- 7. WORKFLOW STEP TRANSITIONS (for workflow_id = 1)
-- =============================================================================
INSERT INTO workflow_step_transitions (workflow_id, from_step_id, to_step_id, transition_type, allowed_role_id, is_active) VALUES
-- Forward transitions: who can move the claim FORWARD and to which step
(1, NULL, 1, 'FORWARD',  2, 1),  -- Vendor creates claim -> starts at step 1 (PM)
(1, 1,    2, 'FORWARD',  3, 1),  -- PM -> TPA
(1, 2,    3, 'FORWARD',  4, 1),  -- TPA -> JD-Infra
(1, 3,    4, 'FORWARD',  5, 1),  -- JD-Infra -> APTS Manager
-- Completion: APTS Manager forwards from step 4 -> NULL (marks claim as COMPLETED)
(1, 4,   NULL, 'FORWARD',  6, 1),
-- Send-back transitions: who can SEND BACK a claim and to which step
(1, 4,    3, 'SENDBACK', 6, 1),  -- APTS Manager -> JD-Infra
(1, 3,    2, 'SENDBACK', 5, 1),  -- JD-Infra -> TPA
(1, 2,    1, 'SENDBACK', 4, 1),  -- TPA -> PM
(1, 1,   NULL, 'SENDBACK', 3, 1); -- PM -> Vendor (null to_step means send back to vendor)

-- =============================================================================
-- 8. VENDOR PROJECTS -- Assign vendors to projects
-- =============================================================================
INSERT INTO vendor_projects (vendor_id, project_id) VALUES
(1, 1), -- Akshara Enterprises -> Video Conferencing (with workflow)
(1, 2), -- Akshara Enterprises -> APSDWAN (with workflow)
(2, 2), -- TechSol India -> APSDWAN (with workflow)
(2, 3); -- TechSol India -> APSCAN (NO workflow - manual assignment)
