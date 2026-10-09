CREATE DATABASE  IF NOT EXISTS `apts_bills_tracking` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `apts_bills_tracking`;
-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: apts_bills_tracking
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'CREATE, UPDATE, DELETE, LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, FORWARD, SENDBACK, etc.',
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `performed_by` int DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_table_record` (`table_name`,`record_id`),
  KEY `idx_action` (`action`),
  KEY `idx_performed_by` (`performed_by`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocked_users`
--

DROP TABLE IF EXISTS `blocked_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocked_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int DEFAULT '1',
  `blocked_until` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `claim_files`
--

DROP TABLE IF EXISTS `claim_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `claim_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `claim_id` int NOT NULL,
  `original_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID-based name on disk',
  `file_path` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Relative path from uploads root',
  `file_size` bigint NOT NULL COMMENT 'Size in bytes',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'application/pdf',
  `document_type` enum('INVOICE','CERTIFICATION') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INVOICE' COMMENT 'INVOICE = bill/invoice documents, CERTIFICATION = optional certification documents',
  `uploaded_by` int NOT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `claim_id` (`claim_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `claim_files_ibfk_1` FOREIGN KEY (`claim_id`) REFERENCES `claims` (`id`) ON DELETE CASCADE,
  CONSTRAINT `claim_files_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `claim_history`
--

DROP TABLE IF EXISTS `claim_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `claim_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `claim_id` int NOT NULL,
  `from_step_id` int DEFAULT NULL COMMENT 'NULL for CREATE action — which workflow step it came FROM',
  `to_step_id` int DEFAULT NULL COMMENT 'NULL for COMPLETE/REJECT action — which workflow step it went TO',
  `from_user_id` int DEFAULT NULL COMMENT 'USER who sent/initiated this action — always filled',
  `to_user_id` int DEFAULT NULL COMMENT 'USER who received it — null for workflow step forwards, filled for manual assign',
  `forwarded_to_user_id` int DEFAULT NULL COMMENT 'Deprecated: use from_user_id/to_user_id instead',
  `action` enum('CREATE','FORWARD','SENDBACK','COMPLETE','REJECT','RESUBMIT','PULL_BACK') COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User-facing label, e.g. "Approved & Forwarded to TPA"',
  `performed_by` int NOT NULL,
  `performed_by_role_id` int NOT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mandatory remarks at every transition',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `claim_id` (`claim_id`),
  KEY `from_step_id` (`from_step_id`),
  KEY `to_step_id` (`to_step_id`),
  KEY `forwarded_to_user_id` (`forwarded_to_user_id`),
  KEY `performed_by` (`performed_by`),
  KEY `performed_by_role_id` (`performed_by_role_id`),
  KEY `idx_history_from_user` (`from_user_id`),
  KEY `idx_history_to_user` (`to_user_id`),
  CONSTRAINT `claim_history_ibfk_1` FOREIGN KEY (`claim_id`) REFERENCES `claims` (`id`) ON DELETE CASCADE,
  CONSTRAINT `claim_history_ibfk_2` FOREIGN KEY (`from_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE SET NULL,
  CONSTRAINT `claim_history_ibfk_3` FOREIGN KEY (`to_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE SET NULL,
  CONSTRAINT `claim_history_ibfk_4` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `claim_history_ibfk_5` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `claim_history_ibfk_6` FOREIGN KEY (`forwarded_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `claim_history_ibfk_7` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `claim_history_ibfk_8` FOREIGN KEY (`performed_by_role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `claims`
--

DROP TABLE IF EXISTS `claims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `claims` (
  `id` int NOT NULL AUTO_INCREMENT,
  `claim_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Human-readable tracking code, e.g. APTS-2024-0001',
  `vendor_id` int NOT NULL,
  `vendor_contact_user_id` int DEFAULT NULL COMMENT 'Specific contact person at the vendor for this claim',
  `project_id` int NOT NULL,
  `po_id` int DEFAULT NULL COMMENT 'Purchase Order this claim belongs to',
  `workflow_id` int DEFAULT NULL COMMENT 'NULL = non-workflow project (manual officer assignment)',
  `current_step_id` int DEFAULT NULL COMMENT 'NULL = not started or completed (workflow mode)',
  `current_step_order` int DEFAULT '0' COMMENT 'Denormalised for fast queries',
  `current_assigned_user_id` int DEFAULT NULL COMMENT 'Current officer holding this claim (non-workflow mode)',
  `status` enum('PENDING','IN_PROGRESS','SENT_BACK','COMPLETED','REJECTED') COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `is_completed` tinyint(1) DEFAULT '0',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  `active_claim_code` varchar(50) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`deleted_at` is null),`claim_code`,NULL)) STORED COMMENT 'claim_code while active; NULL once deleted so the code can be reused',
  `created_by` int NOT NULL COMMENT 'Vendor user who created this claim',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_claim_code_active` (`active_claim_code`),
  KEY `vendor_id` (`vendor_id`),
  KEY `vendor_contact_user_id` (`vendor_contact_user_id`),
  KEY `project_id` (`project_id`),
  KEY `po_id` (`po_id`),
  KEY `workflow_id` (`workflow_id`),
  KEY `current_step_id` (`current_step_id`),
  KEY `current_assigned_user_id` (`current_assigned_user_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `claims_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `claims_ibfk_2` FOREIGN KEY (`vendor_contact_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `claims_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `claims_ibfk_4` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`),
  CONSTRAINT `claims_ibfk_5` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_master` (`id`),
  CONSTRAINT `claims_ibfk_6` FOREIGN KEY (`current_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE SET NULL,
  CONSTRAINT `claims_ibfk_7` FOREIGN KEY (`current_assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `claims_ibfk_8` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice_submissions`
--

DROP TABLE IF EXISTS `invoice_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `claim_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `invoice_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_amount` decimal(15,2) NOT NULL,
  `invoice_file_path` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','MATCHED','DISBURSED','REJECTED') COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `processed_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `claim_id` (`claim_id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `processed_by` (`processed_by`),
  CONSTRAINT `invoice_submissions_ibfk_1` FOREIGN KEY (`claim_id`) REFERENCES `claims` (`id`),
  CONSTRAINT `invoice_submissions_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `invoice_submissions_ibfk_3` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `po_files`
--

DROP TABLE IF EXISTS `po_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `po_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_id` int NOT NULL,
  `original_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID-based name on disk',
  `file_path` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Relative path from uploads root',
  `file_size` bigint NOT NULL COMMENT 'Size in bytes',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'application/pdf',
  `uploaded_by` int NOT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `po_id` (`po_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `po_files_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `po_files_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `po_vendors`
--

DROP TABLE IF EXISTS `po_vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `po_vendors` (
  `po_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `vendor_delivery_date` date DEFAULT NULL COMMENT 'Delivery date entered manually by the vendor',
  `installation_date` date DEFAULT NULL COMMENT 'Installation date entered manually by the vendor',
  `dates_updated_at` datetime DEFAULT NULL,
  `dates_updated_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`po_id`,`vendor_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `po_vendors_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `po_vendors_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `workflow_id` int DEFAULT NULL COMMENT 'NULL = no workflow (manual officer assignment)',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  `active_project_code` varchar(50) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`deleted_at` is null),`project_code`,NULL)) STORED COMMENT 'project_code while active; NULL once deleted so the code can be reused',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_code_active` (`active_project_code`),
  KEY `workflow_id` (`workflow_id`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_master` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Auto-generated: PO-YYYY-NNNN',
  `project_id` int NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `amount` decimal(15,2) DEFAULT NULL,
  `delivery_start_date` date DEFAULT NULL COMMENT 'Date from which delivery is expected to begin',
  `delivery_end_date` date DEFAULT NULL COMMENT 'Committed / expected delivery deadline',
  `delivered_on` date DEFAULT NULL COMMENT 'Actual delivery completion date (NULL = not yet delivered)',
  `status` enum('ACTIVE','CLOSED','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  `active_po_number` varchar(50) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`deleted_at` is null),`po_number`,NULL)) STORED COMMENT 'po_number while active; NULL once deleted so the number can be reused',
  `created_by` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_po_number_active` (`active_po_number`),
  KEY `project_id` (`project_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `purchase_orders_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SHA-256 hash of the actual JWT',
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_token` (`token`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `role_rank` int NOT NULL DEFAULT '0' COMMENT 'Higher number = higher authority. Admin=100, Vendor=10.',
  `permissions` json DEFAULT NULL COMMENT 'JSON object with module->action->boolean, e.g. {"vendor":{"create":true}}',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  `active_role_name` varchar(100) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`deleted_at` is null),`role_name`,NULL)) STORED COMMENT 'role_name while active; NULL once deleted so the name can be reused',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_name_active` (`active_role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` int NOT NULL,
  `vendor_id` int DEFAULT NULL COMMENT 'NULL for staff/officers; set for vendor employees',
  `designation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  `active_email` varchar(255) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`deleted_at` is null),`email`,NULL)) STORED COMMENT 'email while active; NULL once deleted so the email can be reused',
  `has_digital_signature` tinyint(1) DEFAULT '0',
  `last_login_time` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_version` int DEFAULT '0' COMMENT 'Incremented on logout/password-change to invalidate JWTs',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email_active` (`active_email`),
  KEY `role_id` (`role_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_projects`
--

DROP TABLE IF EXISTS `vendor_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_projects` (
  `vendor_id` int NOT NULL,
  `project_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vendor_id`,`project_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `vendor_projects_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_projects_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vendor_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional short code for reference',
  `contact_person` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  `active_vendor_code` varchar(50) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`deleted_at` is null),`vendor_code`,NULL)) STORED COMMENT 'vendor_code while active; NULL once deleted so the code can be reused',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_code_active` (`active_vendor_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow_master`
--

DROP TABLE IF EXISTS `workflow_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_master` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Set to NOW() when soft-deleted; NULL = not deleted',
  `active_workflow_name` varchar(255) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`deleted_at` is null),`workflow_name`,NULL)) STORED COMMENT 'workflow_name while active; NULL once deleted so the name can be reused',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_name_active` (`active_workflow_name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow_step_transitions`
--

DROP TABLE IF EXISTS `workflow_step_transitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_step_transitions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_id` int NOT NULL,
  `from_step_id` int DEFAULT NULL COMMENT 'NULL = transition from "start" (claim creation)',
  `to_step_id` int DEFAULT NULL COMMENT 'NULL = send back to vendor (no specific destination step)',
  `transition_type` enum('FORWARD','SENDBACK') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FORWARD',
  `allowed_role_id` int NOT NULL COMMENT 'Which role is allowed to perform this transition',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `workflow_id` (`workflow_id`),
  KEY `from_step_id` (`from_step_id`),
  KEY `to_step_id` (`to_step_id`),
  KEY `allowed_role_id` (`allowed_role_id`),
  CONSTRAINT `workflow_step_transitions_ibfk_1` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_master` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workflow_step_transitions_ibfk_2` FOREIGN KEY (`from_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workflow_step_transitions_ibfk_3` FOREIGN KEY (`to_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workflow_step_transitions_ibfk_4` FOREIGN KEY (`allowed_role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow_steps`
--

DROP TABLE IF EXISTS `workflow_steps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_id` int NOT NULL,
  `step_order` int NOT NULL COMMENT '1, 2, 3 ... determines sequence',
  `step_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name, e.g. "PM Verification", "TPA Audit"',
  `step_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Programmatic code, e.g. PM_VERIFY, TPA_AUDIT',
  `is_optional` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `required_role_id` int DEFAULT NULL COMMENT 'Which role handles this step',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `workflow_id` (`workflow_id`),
  KEY `required_role_id` (`required_role_id`),
  CONSTRAINT `workflow_steps_ibfk_1` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_master` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workflow_steps_ibfk_2` FOREIGN KEY (`required_role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping events for database 'apts_bills_tracking'
--

--
-- Dumping routines for database 'apts_bills_tracking'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 14:48:08
