-- =============================================================================
-- Migration v5: Delivery timelines on Purchase Orders
-- =============================================================================
USE `apts_bills_tracking`;

ALTER TABLE purchase_orders
  ADD COLUMN delivery_start_date DATE NULL COMMENT 'Date from which delivery is expected to begin' AFTER amount,
  ADD COLUMN delivery_end_date   DATE NULL COMMENT 'Committed / expected delivery deadline' AFTER delivery_start_date,
  ADD COLUMN delivered_on        DATE NULL COMMENT 'Actual delivery completion date (NULL = not yet delivered)' AFTER delivery_end_date;