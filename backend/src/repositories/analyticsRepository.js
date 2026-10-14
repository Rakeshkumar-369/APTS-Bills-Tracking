// src/repositories/analyticsRepository.js
// Read-only aggregate queries for the MD analytics dashboard.
const pool = require('../config/db');

// Whitelisted SQL expressions — never built from user input.
const BUCKET_EXPR = {
  day: (col) => `DATE_FORMAT(${col}, '%Y-%m-%d')`,
  week: (col) => `DATE_FORMAT(DATE_SUB(DATE(${col}), INTERVAL WEEKDAY(${col}) DAY), '%Y-%m-%d')`,
  month: (col) => `DATE_FORMAT(${col}, '%Y-%m-01')`,
};

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

class AnalyticsRepository {
  // `from` inclusive, `toExclusive` exclusive (both 'YYYY-MM-DD')

  async claimSummary(from, toExclusive) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS submitted,
              COALESCE(SUM(claimed_amount), 0) AS claimed_amount,
              COALESCE(SUM(status = 'REJECTED'), 0) AS rejected,
              COALESCE(SUM(status = 'SENT_BACK'), 0) AS sent_back,
              COALESCE(SUM(status IN ('PENDING', 'IN_PROGRESS')), 0) AS in_progress
       FROM claims
       WHERE is_deleted = 0 AND created_at >= ? AND created_at < ?`,
      [from, toExclusive]
    );
    return {
      submitted: num(row.submitted), claimed_amount: num(row.claimed_amount),
      rejected: num(row.rejected), sent_back: num(row.sent_back), in_progress: num(row.in_progress),
    };
  }

  async completedSummary(from, toExclusive) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS completed,
              COALESCE(SUM(claimed_amount), 0) AS completed_amount,
              AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) / 24 AS avg_days
       FROM claims
       WHERE is_deleted = 0 AND status = 'COMPLETED'
         AND completed_at >= ? AND completed_at < ?`,
      [from, toExclusive]
    );
    return {
      completed: num(row.completed), completed_amount: num(row.completed_amount),
      avg_days: row.avg_days === null ? null : Number(Number(row.avg_days).toFixed(1)),
    };
  }

  async submittedSeries(from, toExclusive, granularity) {
    const bucket = BUCKET_EXPR[granularity]('created_at');
    const [rows] = await pool.query(
      `SELECT ${bucket} AS bucket, COUNT(*) AS count, COALESCE(SUM(claimed_amount), 0) AS amount
       FROM claims
       WHERE is_deleted = 0 AND created_at >= ? AND created_at < ?
       GROUP BY bucket`,
      [from, toExclusive]
    );
    return rows.map(r => ({ bucket: r.bucket, count: num(r.count), amount: num(r.amount) }));
  }

  async completedSeries(from, toExclusive, granularity) {
    const bucket = BUCKET_EXPR[granularity]('completed_at');
    const [rows] = await pool.query(
      `SELECT ${bucket} AS bucket, COUNT(*) AS count, COALESCE(SUM(claimed_amount), 0) AS amount
       FROM claims
       WHERE is_deleted = 0 AND status = 'COMPLETED'
         AND completed_at >= ? AND completed_at < ?
       GROUP BY bucket`,
      [from, toExclusive]
    );
    return rows.map(r => ({ bucket: r.bucket, count: num(r.count), amount: num(r.amount) }));
  }

  async statusBreakdown(from, toExclusive) {
    const [rows] = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM claims
       WHERE is_deleted = 0 AND created_at >= ? AND created_at < ?
       GROUP BY status`,
      [from, toExclusive]
    );
    return rows.map(r => ({ status: r.status, count: num(r.count) }));
  }

  // Current snapshot: where open claims are sitting right now and for how long
  async pendingByStage() {
    const lastAction = `COALESCE((SELECT MAX(h.created_at) FROM claim_history h WHERE h.claim_id = c.id), c.created_at)`;
    const [steps] = await pool.query(
      `SELECT ws.step_name AS stage, ws.step_order AS step_order, COUNT(*) AS count,
              COALESCE(SUM(c.claimed_amount), 0) AS amount,
              AVG(TIMESTAMPDIFF(HOUR, ${lastAction}, NOW())) / 24 AS avg_days
       FROM claims c
       JOIN workflow_steps ws ON c.current_step_id = ws.id
       WHERE c.is_deleted = 0 AND c.status IN ('PENDING', 'IN_PROGRESS')
       GROUP BY ws.id, ws.step_name, ws.step_order
       ORDER BY ws.step_order`
    );
    const [[manual]] = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(c.claimed_amount), 0) AS amount,
              AVG(TIMESTAMPDIFF(HOUR, ${lastAction}, NOW())) / 24 AS avg_days
       FROM claims c
       WHERE c.is_deleted = 0 AND c.current_step_id IS NULL AND c.is_completed = 0
         AND c.status IN ('PENDING', 'IN_PROGRESS')`
    );
    const [[sentBack]] = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(c.claimed_amount), 0) AS amount,
              AVG(TIMESTAMPDIFF(HOUR, ${lastAction}, NOW())) / 24 AS avg_days
       FROM claims c
       WHERE c.is_deleted = 0 AND c.status = 'SENT_BACK'`
    );
    const fmt = (r, stage) => ({
      stage, count: num(r.count), amount: num(r.amount),
      avg_days: r.avg_days === null ? 0 : Number(Number(r.avg_days).toFixed(1)),
    });
    const result = steps.map(s => fmt(s, s.stage));
    if (num(manual.count) > 0) result.push(fmt(manual, 'Manual assignment'));
    if (num(sentBack.count) > 0) result.push(fmt(sentBack, 'Sent back to vendor'));
    return result;
  }

  async topVendors(from, toExclusive, limit = 5) {
    const [rows] = await pool.query(
      `SELECT v.id, v.vendor_name AS name, COUNT(*) AS claims,
              COALESCE(SUM(c.claimed_amount), 0) AS amount,
              COALESCE(SUM(c.status = 'COMPLETED'), 0) AS completed
       FROM claims c
       JOIN vendors v ON c.vendor_id = v.id
       WHERE c.is_deleted = 0 AND c.created_at >= ? AND c.created_at < ?
       GROUP BY v.id, v.vendor_name
       ORDER BY amount DESC, claims DESC
       LIMIT ?`,
      [from, toExclusive, limit]
    );
    return rows.map(r => ({ id: r.id, name: r.name, claims: num(r.claims), amount: num(r.amount), completed: num(r.completed) }));
  }

  async topProjects(from, toExclusive, limit = 5) {
    const [rows] = await pool.query(
      `SELECT p.id, p.project_name AS name, COUNT(*) AS claims,
              COALESCE(SUM(c.claimed_amount), 0) AS amount,
              COALESCE(SUM(c.status = 'COMPLETED'), 0) AS completed
       FROM claims c
       JOIN projects p ON c.project_id = p.id
       WHERE c.is_deleted = 0 AND c.created_at >= ? AND c.created_at < ?
       GROUP BY p.id, p.project_name
       ORDER BY amount DESC, claims DESC
       LIMIT ?`,
      [from, toExclusive, limit]
    );
    return rows.map(r => ({ id: r.id, name: r.name, claims: num(r.claims), amount: num(r.amount), completed: num(r.completed) }));
  }

  async poSummary(from, toExclusive) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS created, COALESCE(SUM(amount), 0) AS value
       FROM purchase_orders
       WHERE is_deleted = 0 AND created_at >= ? AND created_at < ?`,
      [from, toExclusive]
    );
    return { created: num(row.created), value: num(row.value) };
  }

  // Current snapshot of delivery timelines across live purchase orders
  async deliverySnapshot() {
    const [[row]] = await pool.query(
      `SELECT
         COALESCE(SUM(delivered_on IS NOT NULL AND (delivery_end_date IS NULL OR delivered_on <= delivery_end_date)), 0) AS delivered_on_time,
         COALESCE(SUM(delivered_on IS NOT NULL AND delivery_end_date IS NOT NULL AND delivered_on > delivery_end_date), 0) AS delivered_late,
         COALESCE(SUM(delivered_on IS NULL AND delivery_end_date IS NOT NULL AND delivery_end_date < CURDATE()), 0) AS overdue,
         COALESCE(SUM(delivered_on IS NULL AND delivery_end_date IS NOT NULL
                      AND delivery_end_date >= CURDATE() AND delivery_end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)), 0) AS due_soon,
         COALESCE(SUM(delivered_on IS NULL AND delivery_end_date > DATE_ADD(CURDATE(), INTERVAL 7 DAY)), 0) AS on_track,
         COALESCE(SUM(delivered_on IS NULL AND delivery_end_date IS NULL), 0) AS not_set
       FROM purchase_orders
       WHERE is_deleted = 0 AND status <> 'CANCELLED'`
    );
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, num(v)]));
  }

  // Undelivered POs ordered by deadline (overdue first), with vendor-entered dates
  async deliveryTimeline(limit = 10) {
    const [rows] = await pool.query(
      `SELECT po.id, po.po_number, pr.project_name, po.amount,
              po.delivery_start_date, po.delivery_end_date,
              DATEDIFF(po.delivery_end_date, CURDATE()) AS days_left,
              GROUP_CONCAT(DISTINCT v.vendor_name SEPARATOR ', ') AS vendor_names,
              MAX(pv.vendor_delivery_date) AS vendor_delivery_date,
              MAX(pv.installation_date) AS installation_date
       FROM purchase_orders po
       JOIN projects pr ON po.project_id = pr.id
       LEFT JOIN po_vendors pv ON pv.po_id = po.id
       LEFT JOIN vendors v ON v.id = pv.vendor_id AND v.is_deleted = 0
       WHERE po.is_deleted = 0 AND po.status = 'ACTIVE'
         AND po.delivered_on IS NULL AND po.delivery_end_date IS NOT NULL
       GROUP BY po.id, pr.project_name
       ORDER BY po.delivery_end_date ASC
       LIMIT ?`,
      [limit]
    );
    return rows.map(r => ({
      id: r.id, po_number: r.po_number, project_name: r.project_name, amount: r.amount === null ? null : num(r.amount),
      delivery_start_date: r.delivery_start_date, delivery_end_date: r.delivery_end_date,
      days_left: num(r.days_left), vendor_names: r.vendor_names,
      vendor_delivery_date: r.vendor_delivery_date, installation_date: r.installation_date,
    }));
  }

  async recentActivity(from, toExclusive, limit = 10) {
    const [rows] = await pool.query(
      `SELECT h.id, c.claim_code, h.action, h.action_label, h.created_at,
              u.name AS performed_by_name, v.vendor_name
       FROM claim_history h
       JOIN claims c ON c.id = h.claim_id AND c.is_deleted = 0
       JOIN users u ON u.id = h.performed_by
       JOIN vendors v ON v.id = c.vendor_id
       WHERE h.created_at >= ? AND h.created_at < ?
       ORDER BY h.created_at DESC, h.id DESC
       LIMIT ?`,
      [from, toExclusive, limit]
    );
    return rows;
  }

  async activeVendorCount() {
    const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM vendors WHERE is_deleted = 0 AND is_active = 1');
    return num(row.count);
  }
}

module.exports = new AnalyticsRepository();