// src/repositories/auditRepository.js
const pool = require('../config/db');

class AuditRepository {
  /**
   * Create an audit log entry
   * @param {Object} params
   * @param {string} params.table_name - Affected table name
   * @param {number|null} params.record_id - Affected record ID
   * @param {string} params.action - CREATE, UPDATE, DELETE, ADVANCE, LOGIN, etc.
   * @param {object|null} params.old_value - Previous state (JSON)
   * @param {object|null} params.new_value - New state (JSON)
   * @param {number|null} params.performed_by - User ID
   * @param {string|null} params.ip_address
   * @param {string|null} params.user_agent
   */
  async createAuditLog({ table_name, record_id, action, old_value, new_value, performed_by, ip_address, user_agent }) {
    const [result] = await pool.query(
      `INSERT INTO audit_logs
       (table_name, record_id, action, old_value, new_value, performed_by, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        table_name,
        record_id || null,
        action,
        old_value ? JSON.stringify(old_value) : null,
        new_value ? JSON.stringify(new_value) : null,
        performed_by || null,
        ip_address || null,
        user_agent || null
      ]
    );
    return result.insertId;
  }

  /**
   * Get audit logs for a specific record
   */
  async getAuditLogs(table_name, record_id, { limit = 50, offset = 0 } = {}) {
    const [rows] = await pool.query(
      `SELECT al.*, u.name as performed_by_name
       FROM audit_logs al
       LEFT JOIN users u ON al.performed_by = u.id
       WHERE al.table_name = ? AND al.record_id = ?
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [table_name, record_id, limit, offset]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM audit_logs WHERE table_name = ? AND record_id = ?',
      [table_name, record_id]
    );

    return {
      rows,
      total: countResult[0].total
    };
  }
}

module.exports = new AuditRepository();