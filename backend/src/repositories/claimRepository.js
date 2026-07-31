const pool = require('../config/db');

class ClaimRepository {
  // ── Claims ──

  async getAll({ limit = 50, offset = 0, status, vendor_id, project_id, workflow_id, po_id, current_step_id, is_completed, search, involved_role_id, involved_user_id } = {}) {
    let conditions = ['c.is_deleted = false'];
    let params = [];

    if (status) { conditions.push('c.status = ?'); params.push(status); }
    if (vendor_id) { conditions.push('c.vendor_id = ?'); params.push(vendor_id); }
    if (project_id) { conditions.push('c.project_id = ?'); params.push(project_id); }
    if (workflow_id) { conditions.push('c.workflow_id = ?'); params.push(workflow_id); }
    if (po_id) { conditions.push('c.po_id = ?'); params.push(po_id); }
    if (current_step_id) { conditions.push('c.current_step_id = ?'); params.push(current_step_id); }
    if (is_completed !== undefined) { conditions.push('c.is_completed = ?'); params.push(is_completed ? 1 : 0); }
    if (search) {
      conditions.push('(c.claim_code LIKE ? OR v.vendor_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (involved_role_id && involved_user_id) {
      conditions.push(`(
        EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = c.workflow_id AND ws.required_role_id = ? AND ws.is_deleted = false)
        OR EXISTS (SELECT 1 FROM claim_history ch WHERE ch.claim_id = c.id AND ch.performed_by = ?)
        OR c.current_assigned_user_id = ?
      )`);
      params.push(involved_role_id, involved_user_id, involved_user_id);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(`
      SELECT c.*, v.vendor_name, pr.project_name, wm.workflow_name,
             COALESCE(ws.step_name, au.name) AS current_step_name, ws.step_code AS current_step_code,
             ws.required_role_id AS current_step_role_id,
             u.name AS created_by_name,
             cu.name AS contact_name,
             au.name AS assigned_user_name,
             po.po_number
      FROM claims c
      JOIN vendors v ON c.vendor_id = v.id
      JOIN projects pr ON c.project_id = pr.id
      LEFT JOIN workflow_master wm ON c.workflow_id = wm.id AND wm.is_deleted = false
      LEFT JOIN workflow_steps ws ON c.current_step_id = ws.id AND ws.is_deleted = false
      LEFT JOIN purchase_orders po ON c.po_id = po.id AND po.is_deleted = false
      LEFT JOIN users u ON c.created_by = u.id AND u.is_deleted = false
      LEFT JOIN users cu ON c.vendor_contact_user_id = cu.id AND cu.is_deleted = false
      LEFT JOIN users au ON c.current_assigned_user_id = au.id AND au.is_deleted = false
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM claims c
       JOIN vendors v ON c.vendor_id = v.id
       ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  async getById(id) {
    const [rows] = await pool.query(`
      SELECT c.*, v.vendor_name, pr.project_name, wm.workflow_name,
             COALESCE(ws.step_name, au.name) AS current_step_name, ws.step_code AS current_step_code,
             ws.required_role_id AS current_step_role_id,
             u.name AS created_by_name,
             cu.name AS contact_name, cu.email AS contact_email,
             au.name AS assigned_user_name,
             po.po_number
      FROM claims c
      JOIN vendors v ON c.vendor_id = v.id
      JOIN projects pr ON c.project_id = pr.id
      LEFT JOIN workflow_master wm ON c.workflow_id = wm.id AND wm.is_deleted = false
      LEFT JOIN workflow_steps ws ON c.current_step_id = ws.id AND ws.is_deleted = false
      LEFT JOIN purchase_orders po ON c.po_id = po.id AND po.is_deleted = false
      LEFT JOIN users u ON c.created_by = u.id AND u.is_deleted = false
      LEFT JOIN users cu ON c.vendor_contact_user_id = cu.id AND cu.is_deleted = false
      LEFT JOIN users au ON c.current_assigned_user_id = au.id AND au.is_deleted = false
      WHERE c.id = ? AND c.is_deleted = false
    `, [id]);
    return rows[0];
  }

  async create({ claim_code, vendor_id, vendor_contact_user_id, project_id, po_id, workflow_id, current_step_id, current_step_order, current_assigned_user_id, remarks, created_by }) {
    const [result] = await pool.query(
      `INSERT INTO claims (claim_code, vendor_id, vendor_contact_user_id, project_id, po_id, workflow_id,
        current_step_id, current_step_order, current_assigned_user_id, status, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?)`,
      [claim_code, vendor_id, vendor_contact_user_id || null, project_id, po_id || null, workflow_id || null,
       current_step_id || null, current_step_order || 0, current_assigned_user_id || null, remarks || null, created_by]
    );
    return result.insertId;
  }

  async updateCurrentStep(id, { current_step_id, current_step_order, status, is_completed, completed_at }) {
    const updates = [];
    const params = [];

    if (current_step_id !== undefined) { updates.push('current_step_id = ?'); params.push(current_step_id); }
    if (current_step_order !== undefined) { updates.push('current_step_order = ?'); params.push(current_step_order); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (is_completed !== undefined) { updates.push('is_completed = ?'); params.push(is_completed ? 1 : 0); }
    if (completed_at !== undefined) { updates.push('completed_at = ?'); params.push(completed_at); }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE claims SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  async updateCurrentAssignee(id, userId) {
    await pool.query(
      'UPDATE claims SET current_assigned_user_id = ?, updated_at = NOW() WHERE id = ?',
      [userId, id]
    );
  }

  // ── Claim Files ──

  async getFiles(claimId) {
    const [rows] = await pool.query(
      `SELECT cf.*, u.name AS uploaded_by_name
       FROM claim_files cf
       LEFT JOIN users u ON cf.uploaded_by = u.id AND u.is_deleted = false
       WHERE cf.claim_id = ? AND cf.is_deleted = false
       ORDER BY cf.created_at DESC`,
      [claimId]
    );
    return rows;
  }

  async createFile({ claim_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by }) {
    const [result] = await pool.query(
      `INSERT INTO claim_files (claim_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [claim_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by]
    );
    return result.insertId;
  }

  async deleteFile(fileId) {
    await pool.query('UPDATE claim_files SET is_deleted = 1 WHERE id = ?', [fileId]);
    return { id: fileId, is_deleted: 1 };
  }

  // ── Claim History ──

  async getHistory(claimId) {
    const [rows] = await pool.query(`
      SELECT ch.*,
             fs.step_name AS from_step_name,
             ts.step_name AS to_step_name,
             fu.name AS from_user_name,
             tu.name AS to_user_name,
             fwd.name AS forwarded_to_user_name,
             u.name AS performed_by_name,
             r.role_name AS performed_by_role_name
      FROM claim_history ch
      LEFT JOIN workflow_steps fs ON ch.from_step_id = fs.id AND fs.is_deleted = false
      LEFT JOIN workflow_steps ts ON ch.to_step_id = ts.id AND ts.is_deleted = false
      LEFT JOIN users fu ON ch.from_user_id = fu.id AND fu.is_deleted = false
      LEFT JOIN users tu ON ch.to_user_id = tu.id AND tu.is_deleted = false
      LEFT JOIN users fwd ON ch.forwarded_to_user_id = fwd.id AND fwd.is_deleted = false
      LEFT JOIN users u ON ch.performed_by = u.id AND u.is_deleted = false
      LEFT JOIN roles r ON ch.performed_by_role_id = r.id AND r.is_deleted = false
      WHERE ch.claim_id = ?
      ORDER BY ch.created_at ASC
    `, [claimId]);
    return rows;
  }

  async createHistory({ claim_id, from_step_id, to_step_id, from_user_id, to_user_id, forwarded_to_user_id, action, action_label, performed_by, performed_by_role_id, remarks }) {
    const [result] = await pool.query(
      `INSERT INTO claim_history (claim_id, from_step_id, to_step_id, from_user_id, to_user_id, forwarded_to_user_id,
        action, action_label, performed_by, performed_by_role_id, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [claim_id, from_step_id || null, to_step_id || null, from_user_id || null, to_user_id || null,
       forwarded_to_user_id || null, action, action_label || null,
       performed_by, performed_by_role_id, remarks]
    );
    return result.insertId;
  }

  /**
   * Find the latest forward history entry where a user forwarded to the current assignee.
   * Used by pull-back to verify the current user can pull back.
   *
   * Matches on the canonical `to_user_id` column (the officer who received the
   * assignment). Falls back to the deprecated `forwarded_to_user_id` for legacy
   * rows where `to_user_id` was never populated — so pull-back works for both
   * new and historical assign flows.
   */
  async findLatestForward(claimId, fromUserId, toUserId) {
    const [rows] = await pool.query(`
      SELECT ch.*, COALESCE(tu.name, fw.name) AS target_user_name
      FROM claim_history ch
      LEFT JOIN users tu ON ch.to_user_id = tu.id AND tu.is_deleted = false
      LEFT JOIN users fw ON ch.forwarded_to_user_id = fw.id AND fw.is_deleted = false
      WHERE ch.claim_id = ?
        AND ch.action = 'FORWARD'
        AND ch.performed_by = ?
        AND (ch.to_user_id = ? OR (ch.to_user_id IS NULL AND ch.forwarded_to_user_id = ?))
      ORDER BY ch.created_at DESC
      LIMIT 1
    `, [claimId, fromUserId, toUserId, toUserId]);
    return rows[0];
  }

  // ── Inbox Queries ──

  async getInbox(roleId, userId, { limit = 50, offset = 0 } = {}) {
    const [rows] = await pool.query(`
      SELECT c.*, v.vendor_name, pr.project_name, wm.workflow_name,
             COALESCE(ws.step_name, au.name) AS current_step_name, ws.step_code AS current_step_code,
             cu.name AS contact_name,
             au.name AS assigned_user_name,
             po.po_number,
             DATEDIFF(NOW(), c.updated_at) AS days_at_current_stage
      FROM claims c
      JOIN vendors v ON c.vendor_id = v.id
      JOIN projects pr ON c.project_id = pr.id
      LEFT JOIN workflow_master wm ON c.workflow_id = wm.id AND wm.is_deleted = false
      LEFT JOIN workflow_steps ws ON c.current_step_id = ws.id AND ws.is_deleted = false
      LEFT JOIN purchase_orders po ON c.po_id = po.id AND po.is_deleted = false
      LEFT JOIN users cu ON c.vendor_contact_user_id = cu.id AND cu.is_deleted = false
      LEFT JOIN users au ON c.current_assigned_user_id = au.id AND au.is_deleted = false
      WHERE (
        (c.workflow_id IS NOT NULL AND ws.required_role_id = ?)
        OR
        (c.workflow_id IS NULL AND c.current_assigned_user_id = ?)
      )
        AND c.is_completed = false
        AND c.status IN ('IN_PROGRESS', 'SENT_BACK')
      ORDER BY c.updated_at ASC
      LIMIT ? OFFSET ?
    `, [roleId, userId, limit, offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM claims c
      LEFT JOIN workflow_steps ws ON c.current_step_id = ws.id AND ws.is_deleted = false
      WHERE (
        (c.workflow_id IS NOT NULL AND ws.required_role_id = ?)
        OR
        (c.workflow_id IS NULL AND c.current_assigned_user_id = ?)
      )
        AND c.is_completed = false
        AND c.status IN ('IN_PROGRESS', 'SENT_BACK')
    `, [roleId, userId]);

    return { rows, total: countResult[0].total };
  }

  async getOutbox(userId, { limit = 50, offset = 0 } = {}) {
    const [rows] = await pool.query(`
      SELECT c.*, v.vendor_name, pr.project_name, wm.workflow_name,
             COALESCE(ws.step_name, au.name) AS current_step_name,
             (SELECT ch2.action_label FROM claim_history ch2
              WHERE ch2.claim_id = c.id AND ch2.performed_by = ?
              ORDER BY ch2.created_at DESC LIMIT 1) AS last_action
      FROM claims c
      JOIN vendors v ON c.vendor_id = v.id
      JOIN projects pr ON c.project_id = pr.id
      LEFT JOIN workflow_master wm ON c.workflow_id = wm.id AND wm.is_deleted = false
      LEFT JOIN workflow_steps ws ON c.current_step_id = ws.id AND ws.is_deleted = false
      LEFT JOIN users au ON c.current_assigned_user_id = au.id AND au.is_deleted = false
      WHERE c.id IN (
        SELECT claim_id FROM claim_history WHERE performed_by = ?
      )
      ORDER BY c.updated_at DESC
      LIMIT ? OFFSET ?
    `, [userId, userId, limit, offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM claims c
      JOIN claim_history ch ON c.id = ch.claim_id
      WHERE ch.performed_by = ?
    `, [userId]);

    return { rows, total: countResult[0].total };
  }

  async getInboxStats(roleId, userId) {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN c.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN c.status = 'SENT_BACK' THEN 1 ELSE 0 END) AS returned
      FROM claims c
      LEFT JOIN workflow_steps ws ON c.current_step_id = ws.id AND ws.is_deleted = false
      WHERE (
        (c.workflow_id IS NOT NULL AND ws.required_role_id = ?)
        OR
        (c.workflow_id IS NULL AND c.current_assigned_user_id = ?)
      )
        AND c.is_completed = false
    `, [roleId, userId]);
    return rows[0];
  }

  async getLastClaimCode() {
    const [rows] = await pool.query(
      'SELECT claim_code FROM claims ORDER BY id DESC LIMIT 1'
    );
    return rows[0]?.claim_code || null;
  }
}

module.exports = new ClaimRepository();
