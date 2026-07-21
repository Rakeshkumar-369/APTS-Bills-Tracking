-- =============================================================================
-- APTS Bills Tracking System — Database Schema
-- =============================================================================
-- DROP tables that are no longer needed (from the original scaffold)
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
DROP TABLE IF EXISTS package_history;
DROP TABLE IF EXISTS package_files;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS workflow_step_transitions;
DROP TABLE IF EXISTS workflow_steps;
DROP TABLE IF EXISTS vendor_projects;
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
  role_name   VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  role_rank   INT NOT NULL DEFAULT 0 COMMENT 'Higher number = higher authority. Admin=100, Vendor=10.',
  permissions JSON NULL COMMENT 'JSON object with module→action→boolean, e.g. {"vendor":{"create":true}}',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. VENDORS — Vendor companies (separate from login users)
-- =============================================================================
CREATE TABLE vendors (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name    VARCHAR(255) NOT NULL,
  vendor_code    VARCHAR(50)  NULL UNIQUE COMMENT 'Optional short code for reference',
  contact_person VARCHAR(255) NULL,
  email          VARCHAR(255) NULL,
  phone          VARCHAR(20)  NULL,
  address        TEXT         NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. USERS — All login accounts (officers, vendor employees, admins)
-- =============================================================================
CREATE TABLE users (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(255) NOT NULL,
  email                VARCHAR(255) NOT NULL UNIQUE,
  password_hash        VARCHAR(255) NOT NULL,
  role_id              INT NOT NULL,
  vendor_id            INT NULL COMMENT 'NULL for staff/officers; set for vendor employees',
  designation          VARCHAR(255) NULL,
  phone                VARCHAR(20)  NULL,
  is_active            BOOLEAN DEFAULT TRUE,
  has_digital_signature BOOLEAN DEFAULT FALSE,
  last_login_time      DATETIME NULL,
  last_login_ip        VARCHAR(45) NULL,
  session_version      INT DEFAULT 0 COMMENT 'Incremented on logout/password-change to invalidate JWTs',
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (role_id)   REFERENCES roles(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. WORKFLOW MASTER — A named, ordered sequence of steps
-- =============================================================================
CREATE TABLE workflow_master (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  workflow_name VARCHAR(255) NOT NULL,
  description   TEXT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. PROJECTS — Infrastructure project classifications
-- =============================================================================
CREATE TABLE projects (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  project_name  VARCHAR(255) NOT NULL,
  project_code  VARCHAR(50)  NULL UNIQUE,
  description   TEXT NULL,
  workflow_id   INT NOT NULL COMMENT 'Each project is assigned a workflow',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (workflow_id) REFERENCES workflow_master(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. WORKFLOW STEPS — Individual steps within a workflow
-- =============================================================================
CREATE TABLE workflow_steps (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id      INT NOT NULL,
  step_order       INT NOT NULL COMMENT '1, 2, 3 … determines sequence',
  step_name        VARCHAR(255) NOT NULL COMMENT 'Display name, e.g. "PM Verification", "TPA Audit"',
  step_code        VARCHAR(50)  NULL COMMENT 'Programmatic code, e.g. PM_VERIFY, TPA_AUDIT',
  is_optional      BOOLEAN DEFAULT FALSE,
  is_active        BOOLEAN DEFAULT TRUE,
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
  from_step_id    INT NULL COMMENT 'NULL = transition from "start" (package creation)',
  to_step_id      INT NULL COMMENT 'NULL = send back to vendor (no specific destination step)',
  transition_type ENUM('FORWARD', 'SENDBACK') NOT NULL DEFAULT 'FORWARD',
  allowed_role_id INT NOT NULL COMMENT 'Which role is allowed to perform this transition',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (workflow_id)      REFERENCES workflow_master(id) ON DELETE CASCADE,
  FOREIGN KEY (from_step_id)     REFERENCES workflow_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (to_step_id)       REFERENCES workflow_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (allowed_role_id)  REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8. PACKAGES — The core entity: a submission flowing through a workflow
-- =============================================================================
CREATE TABLE packages (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  package_code          VARCHAR(50) NOT NULL UNIQUE COMMENT 'Human-readable tracking code, e.g. APTS-2024-0001',
  vendor_id             INT NOT NULL,
  vendor_contact_user_id INT NULL COMMENT 'Specific contact person at the vendor for this package',
  project_id            INT NOT NULL,
  workflow_id           INT NOT NULL,
  current_step_id       INT NULL COMMENT 'NULL = not started or completed',
  current_step_order    INT DEFAULT 0 COMMENT 'Denormalised for fast queries',
  status                ENUM('PENDING','IN_PROGRESS','SENT_BACK','COMPLETED','REJECTED') DEFAULT 'PENDING',
  remarks               TEXT NULL,
  is_completed          BOOLEAN DEFAULT FALSE,created_by          INT NOT NULL COMMENT 'Vendor user who created this package',
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at          DATETIME NULL,

  FOREIGN KEY (vendor_id)               REFERENCES vendors(id),
  FOREIGN KEY (vendor_contact_user_id)  REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id)              REFERENCES projects(id),
  FOREIGN KEY (workflow_id)             REFERENCES workflow_master(id),
  FOREIGN KEY (current_step_id)        REFERENCES workflow_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)              REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9. PACKAGE FILES — Documents attached to a package
-- =============================================================================
CREATE TABLE package_files (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  package_id     INT NOT NULL,
  original_name  VARCHAR(500) NOT NULL,
  stored_name    VARCHAR(255) NOT NULL COMMENT 'UUID-based name on disk',
  file_path      VARCHAR(1000) NOT NULL COMMENT 'Relative path from uploads root',
  file_size      BIGINT NOT NULL COMMENT 'Size in bytes',
  mime_type      VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  uploaded_by    INT NOT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (package_id)  REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 10. PACKAGE HISTORY — Immutable timeline of every package movement
-- =============================================================================
CREATE TABLE package_history (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  package_id          INT NOT NULL,
  from_step_id        INT NULL COMMENT 'NULL for CREATE action',
  to_step_id          INT NULL COMMENT 'NULL for COMPLETE/REJECT action',
  action              ENUM('CREATE','FORWARD','SENDBACK','COMPLETE','REJECT','RESUBMIT') NOT NULL,
  action_label        VARCHAR(255) NULL COMMENT 'User-facing label, e.g. "Approved & Forwarded to TPA"',
  performed_by        INT NOT NULL,
  performed_by_role_id INT NOT NULL,
  remarks             TEXT NOT NULL COMMENT 'Mandatory remarks at every transition',
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (package_id)           REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (from_step_id)         REFERENCES workflow_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (to_step_id)           REFERENCES workflow_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (performed_by)         REFERENCES users(id),
  FOREIGN KEY (performed_by_role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 11. REFRESH TOKENS — JWT refresh token storage (hashed)
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
-- 12. BLOCKED USERS — Brute-force protection tracking
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
-- 13. AUDIT LOGS — Immutable record of all data mutations
-- =============================================================================
-- Note: GET requests are NOT logged. Only CREATE / UPDATE / DELETE / LOGIN / LOGOUT / etc.
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
-- 14. VENDOR PROJECTS — Many-to-many: which projects each vendor can access
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
-- 15. INVOICE SUBMISSIONS — (Future) Vendor submits invoice after completion
-- =============================================================================
CREATE TABLE invoice_submissions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  package_id        INT NOT NULL,
  vendor_id         INT NOT NULL,
  invoice_number    VARCHAR(100) NOT NULL,
  invoice_amount    DECIMAL(15,2) NOT NULL,
  invoice_file_path VARCHAR(1000) NULL,
  status            ENUM('PENDING','MATCHED','DISBURSED','REJECTED') DEFAULT 'PENDING',
  remarks           TEXT NULL,
  submitted_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at      DATETIME NULL,
  processed_by      INT NULL,

  FOREIGN KEY (package_id)  REFERENCES packages(id),
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id),
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
