-- =============================================================================
-- APTS Bills Tracking System — Database Schema
-- =============================================================================
DROP DATABASE IF EXISTS `apts_bills_tracking`;

CREATE DATABASE IF NOT EXISTS `apts_bills_tracking`;

USE `apts_bills_tracking`;

DROP TABLE IF EXISTS user_sub_departments;
DROP TABLE IF EXISTS user_departments;
DROP TABLE IF EXISTS sub_departments;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS user_scopes;
DROP TABLE IF EXISTS role_scopes;

-- Drop all tables (in reverse dependency order — children before parents)
DROP TABLE IF EXISTS invoice_submissions;
DROP TABLE IF EXISTS claim_history;
DROP TABLE IF EXISTS claim_files;
DROP TABLE IF EXISTS claims;
DROP TABLE IF EXISTS workflow_step_transitions;
DROP TABLE IF EXISTS workflow_steps;
DROP TABLE IF EXISTS vendor_projects;
DROP TABLE IF EXISTS po_vendors;
DROP TABLE IF EXISTS po_files;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS workflow_master;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS blocked_users;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

-- =============================================================================
-- 1. ROLES — Configurable roles with JSON permissions
-- =============================================================================
CREATE TABLE roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  role_name   VARCHAR(100) NOT NULL,
  description TEXT NULL,
  role_rank   INT NOT NULL DEFAULT 0 COMMENT 'Higher number = higher authority. Admin=100, Vendor=10.',
  permissions JSON NULL COMMENT 'JSON object with module->action->boolean, e.g. {"vendor":{"create":true}}',
  is_active   BOOLEAN DEFAULT TRUE,
  is_deleted  BOOLEAN DEFAULT FALSE,
  deleted_at  DATETIME NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  active_role_name VARCHAR(100) GENERATED ALWAYS AS (IF(deleted_at IS NULL, role_name, NULL)) STORED COMMENT 'role_name while active; NULL once deleted so the name can be reused',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_role_name_active (active_role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. VENDORS — Vendor companies (separate from login users)
-- =============================================================================
CREATE TABLE vendors (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name    VARCHAR(255) NOT NULL,
  vendor_code    VARCHAR(50)  NULL COMMENT 'Optional short code for reference',
  contact_person VARCHAR(255) NULL,
  email          VARCHAR(255) NULL,
  phone          VARCHAR(20)  NULL,
  address        TEXT         NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  is_deleted     BOOLEAN DEFAULT FALSE,
  deleted_at     DATETIME NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  active_vendor_code VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, vendor_code, NULL)) STORED COMMENT 'vendor_code while active; NULL once deleted so the code can be reused',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vendor_code_active (active_vendor_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. USERS — All login accounts (officers, vendor employees, admins)
-- =============================================================================
CREATE TABLE users (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(255) NOT NULL,
  email                VARCHAR(255) NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  role_id              INT NOT NULL,
  vendor_id            INT NULL COMMENT 'NULL for staff/officers; set for vendor employees',
  designation          VARCHAR(255) NULL,
  phone                VARCHAR(20)  NULL,
  is_active            BOOLEAN DEFAULT TRUE,
  is_deleted           BOOLEAN DEFAULT FALSE,
  deleted_at           DATETIME NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  active_email         VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED COMMENT 'email while active; NULL once deleted so the email can be reused',
  has_digital_signature BOOLEAN DEFAULT FALSE,
  last_login_time      DATETIME NULL,
  last_login_ip        VARCHAR(45) NULL,
  session_version      INT DEFAULT 0 COMMENT 'Incremented on logout/password-change to invalidate JWTs',
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (role_id)   REFERENCES roles(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
  UNIQUE KEY uq_email_active (active_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. WORKFLOW MASTER — A named, ordered sequence of steps
-- =============================================================================
CREATE TABLE workflow_master (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  workflow_name VARCHAR(255) NOT NULL,
  description   TEXT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  is_deleted    BOOLEAN DEFAULT FALSE,
  deleted_at    DATETIME NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  active_workflow_name VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, workflow_name, NULL)) STORED COMMENT 'workflow_name while active; NULL once deleted so the name can be reused',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workflow_name_active (active_workflow_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. PROJECTS — Infrastructure project classifications
-- =============================================================================
CREATE TABLE projects (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  project_name  VARCHAR(255) NOT NULL,
  project_code  VARCHAR(50)  NULL,
  description   TEXT NULL,
  workflow_id   INT NULL COMMENT 'NULL = no workflow (manual officer assignment)',
  is_active     BOOLEAN DEFAULT TRUE,
  is_deleted    BOOLEAN DEFAULT FALSE,
  deleted_at    DATETIME NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  active_project_code VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, project_code, NULL)) STORED COMMENT 'project_code while active; NULL once deleted so the code can be reused',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (workflow_id) REFERENCES workflow_master(id),
  UNIQUE KEY uq_project_code_active (active_project_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. WORKFLOW STEPS — Individual steps within a workflow
-- =============================================================================
CREATE TABLE workflow_steps (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id      INT NOT NULL,
  step_order       INT NOT NULL COMMENT '1, 2, 3 ... determines sequence',
  step_name        VARCHAR(255) NOT NULL COMMENT 'Display name, e.g. "PM Verification", "TPA Audit"',
  step_code        VARCHAR(50)  NULL COMMENT 'Programmatic code, e.g. PM_VERIFY, TPA_AUDIT',
  is_optional      BOOLEAN DEFAULT FALSE,
  is_active        BOOLEAN DEFAULT TRUE,
  is_deleted       BOOLEAN DEFAULT FALSE,
  required_role_id INT NULL COMMENT 'Which role handles this step',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (workflow_id)      REFERENCES workflow_master(id) ON DELETE CASCADE,
  FOREIGN KEY (required_role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 7. WORKFLOW STEP TRANSITIONS — Who can move from which step to which
-- =============================================================================
CREATE TABLE workflow_step_transitions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id     INT NOT NULL,
  from_step_id    INT NULL COMMENT 'NULL = transition from "start" (claim creation)',
  to_step_id      INT NULL COMMENT 'NULL = send back to vendor (no specific destination step)',
  transition_type ENUM('FORWARD', 'SENDBACK') NOT NULL DEFAULT 'FORWARD',
  allowed_role_id INT NOT NULL COMMENT 'Which role is allowed to perform this transition',
  is_active       BOOLEAN DEFAULT TRUE,
  is_deleted      BOOLEAN DEFAULT FALSE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (workflow_id)      REFERENCES workflow_master(id) ON DELETE CASCADE,
  FOREIGN KEY (from_step_id)     REFERENCES workflow_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (to_step_id)       REFERENCES workflow_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (allowed_role_id)  REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8. PURCHASE ORDERS — Admin-managed POs (can be assigned to multiple vendors)
-- =============================================================================
CREATE TABLE purchase_orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  po_number      VARCHAR(50) NOT NULL COMMENT 'Auto-generated: PO-YYYY-NNNN',
  project_id     INT NOT NULL,
  description    TEXT NULL,
  amount         DECIMAL(15,2) NULL,
  status         ENUM('ACTIVE', 'CLOSED', 'CANCELLED') DEFAULT 'ACTIVE',
  is_active      BOOLEAN DEFAULT TRUE,
  is_deleted     BOOLEAN DEFAULT FALSE,
  deleted_at     DATETIME NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  active_po_number VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, po_number, NULL)) STORED COMMENT 'po_number while active; NULL once deleted so the number can be reused',
  created_by     INT NOT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uq_po_number_active (active_po_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8a. PO-VENDORS — Many-to-many: which vendors are assigned to a Purchase Order
-- =============================================================================
CREATE TABLE po_vendors (
  po_id      INT NOT NULL,
  vendor_id  INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (po_id, vendor_id),
  FOREIGN KEY (po_id)     REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8b. PO FILES — Documents attached to a Purchase Order
-- =============================================================================
CREATE TABLE po_files (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  po_id          INT NOT NULL,
  original_name  VARCHAR(500) NOT NULL,
  stored_name    VARCHAR(255) NOT NULL COMMENT 'UUID-based name on disk',
  file_path      VARCHAR(1000) NOT NULL COMMENT 'Relative path from uploads root',
  file_size      BIGINT NOT NULL COMMENT 'Size in bytes',
  mime_type      VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  uploaded_by    INT NOT NULL,
  is_deleted     BOOLEAN DEFAULT FALSE,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (po_id)        REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9. CLAIMS — The core entity: a submission flowing through a workflow
--         or manually assigned between officers
-- =============================================================================
CREATE TABLE claims (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  claim_code            VARCHAR(50) NOT NULL COMMENT 'Human-readable tracking code, e.g. APTS-2024-0001',
  vendor_id             INT NOT NULL,
  vendor_contact_user_id INT NULL COMMENT 'Specific contact person at the vendor for this claim',
  project_id            INT NOT NULL,
  po_id                 INT NULL COMMENT 'Purchase Order this claim belongs to',
  workflow_id           INT NULL COMMENT 'NULL = non-workflow project (manual officer assignment)',
  current_step_id       INT NULL COMMENT 'NULL = not started or completed (workflow mode)',
  current_step_order    INT DEFAULT 0 COMMENT 'Denormalised for fast queries',
  current_assigned_user_id INT NULL COMMENT 'Current officer holding this claim (non-workflow mode)',
  status                ENUM('PENDING','IN_PROGRESS','SENT_BACK','COMPLETED','REJECTED') DEFAULT 'PENDING',
  remarks               TEXT NULL,
  is_completed          BOOLEAN DEFAULT FALSE,
  is_deleted            BOOLEAN DEFAULT FALSE,
  deleted_at            DATETIME NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  active_claim_code     VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, claim_code, NULL)) STORED COMMENT 'claim_code while active; NULL once deleted so the code can be reused',
  created_by            INT NOT NULL COMMENT 'Vendor user who created this claim',
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at          DATETIME NULL,

  FOREIGN KEY (vendor_id)               REFERENCES vendors(id),
  FOREIGN KEY (vendor_contact_user_id)  REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id)              REFERENCES projects(id),
  FOREIGN KEY (po_id)                   REFERENCES purchase_orders(id),
  FOREIGN KEY (workflow_id)             REFERENCES workflow_master(id),
  FOREIGN KEY (current_step_id)         REFERENCES workflow_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (current_assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)              REFERENCES users(id),
  UNIQUE KEY uq_claim_code_active (active_claim_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 10. CLAIM FILES — Documents attached to a claim
-- =============================================================================
CREATE TABLE claim_files (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  claim_id       INT NOT NULL,
  original_name  VARCHAR(500) NOT NULL,
  stored_name    VARCHAR(255) NOT NULL COMMENT 'UUID-based name on disk',
  file_path      VARCHAR(1000) NOT NULL COMMENT 'Relative path from uploads root',
  file_size      BIGINT NOT NULL COMMENT 'Size in bytes',
  mime_type      VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  uploaded_by    INT NOT NULL,
  is_deleted     BOOLEAN DEFAULT FALSE,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (claim_id)   REFERENCES claims(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 11. CLAIM HISTORY — Immutable timeline of every claim movement
-- =============================================================================
CREATE TABLE claim_history (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  claim_id              INT NOT NULL,
  from_step_id          INT NULL COMMENT 'NULL for CREATE action — which workflow step it came FROM',
  to_step_id            INT NULL COMMENT 'NULL for COMPLETE/REJECT action — which workflow step it went TO',
  from_user_id          INT NULL COMMENT 'USER who sent/initiated this action — always filled',
  to_user_id            INT NULL COMMENT 'USER who received it — null for workflow step forwards, filled for manual assign',
  forwarded_to_user_id  INT NULL COMMENT 'Deprecated: use from_user_id/to_user_id instead',
  action                ENUM('CREATE','FORWARD','SENDBACK','COMPLETE','REJECT','RESUBMIT','PULL_BACK') NOT NULL,
  action_label          VARCHAR(255) NULL COMMENT 'User-facing label, e.g. "Approved & Forwarded to TPA"',
  performed_by          INT NOT NULL,
  performed_by_role_id  INT NOT NULL,
  remarks               TEXT NOT NULL COMMENT 'Mandatory remarks at every transition',
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (claim_id)              REFERENCES claims(id) ON DELETE CASCADE,
  FOREIGN KEY (from_step_id)          REFERENCES workflow_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (to_step_id)            REFERENCES workflow_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (from_user_id)          REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (to_user_id)            REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (forwarded_to_user_id)  REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (performed_by)          REFERENCES users(id),
  FOREIGN KEY (performed_by_role_id)  REFERENCES roles(id),
  INDEX idx_history_from_user (from_user_id),
  INDEX idx_history_to_user (to_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 12. REFRESH TOKENS — JWT refresh token storage (hashed)
-- =============================================================================
CREATE TABLE refresh_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(255) NOT NULL COMMENT 'SHA-256 hash of the actual JWT',
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 13. BLOCKED USERS — Brute-force protection tracking
-- =============================================================================
CREATE TABLE blocked_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  attempts      INT DEFAULT 1,
  blocked_until DATETIME NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 14. AUDIT LOGS — Immutable record of all data mutations
-- =============================================================================
CREATE TABLE audit_logs (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name     VARCHAR(100) NOT NULL,
  record_id      INT NULL,
  action         VARCHAR(50) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, FORWARD, SENDBACK, etc.',
  old_value      JSON NULL,
  new_value      JSON NULL,
  performed_by   INT NULL,
  ip_address     VARCHAR(45) NULL,
  user_agent     TEXT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_table_record (table_name, record_id),
  INDEX idx_action (action),
  INDEX idx_performed_by (performed_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 15. VENDOR PROJECTS — Many-to-many: which projects each vendor can access
-- =============================================================================
CREATE TABLE vendor_projects (
  vendor_id   INT NOT NULL,
  project_id  INT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (vendor_id, project_id),
  FOREIGN KEY (vendor_id)  REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 16. INVOICE SUBMISSIONS — Vendor submits invoice after completion
-- =============================================================================
CREATE TABLE invoice_submissions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  claim_id          INT NOT NULL,
  vendor_id         INT NOT NULL,
  invoice_number    VARCHAR(100) NOT NULL,
  invoice_amount    DECIMAL(15,2) NOT NULL,
  invoice_file_path VARCHAR(1000) NULL,
  status            ENUM('PENDING','MATCHED','DISBURSED','REJECTED') DEFAULT 'PENDING',
  remarks           TEXT NULL,
  submitted_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at      DATETIME NULL,
  processed_by      INT NULL,

  FOREIGN KEY (claim_id)    REFERENCES claims(id),
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id),
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
