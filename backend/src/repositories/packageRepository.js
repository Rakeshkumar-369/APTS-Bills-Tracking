const pool = require('../config/db');

class PackageRepository {
  // ── Packages ──

  async getAll({ limit = 50, offset = 0, status, vendor_id, project_id, workflow_id, current_step_id, is_completed, search } = {}) {
    let conditions = [];
    let params = [];

    if (status) { conditions.push('p.status = ?'); params.push(status); }
    if (vendor_id) { conditions.push('p.vendor_id = ?'); params.push(vendor_id); }
    if (project_id) { conditions.push('p.project_id = ?'); params.push(project_id); }
    if (workflow_id) { conditions.push('p.workflow_id = ?'); params.push(workflow_id); }
    if (current_step_id) { conditions.push('p.current_step_id = ?'); params.push(current_step_id); }
    if (is_completed !== undefined) { conditions.push('p.is_completed = ?'); params.push(is_completed ? 1 : 0); }
    if (search) {
      conditions.push('(p.package_code LIKE ? OR v.vendor_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(`
      SELECT p.*, v.vendor_name, pr.project_name, wm.workflow_name,
             ws.step_name AS current_step_name, ws.step_code AS current_step_code,
             ws.required_role_id AS current_step_role_id,
             u.name AS created_by_name,
             cu.name AS contact_name
      FROM packages p
      JOIN vendors v ON p.vendor_id = v.id
      JOIN projects pr ON p.project_id = pr.id
      JOIN workflow_master wm ON p.workflow_id = wm.id
      LEFT JOIN workflow_steps ws ON p.current_step_id = ws.id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN users cu ON p.vendor_contact_user_id = cu.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM packages p
       JOIN vendors v ON p.vendor_id = v.id
       ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  async getById(id) {
    const [rows] = await pool.query(`
      SELECT p.*, v.vendor_name, pr.project_name, wm.workflow_name,
             ws.step_name AS current_step_name, ws.step_code AS current_step_code,
             ws.required_role_id AS current_step_role_id,
             u.name AS created_by_name,
             cu.name AS contact_name, cu.email AS contact_email
      FROM packages p
      JOIN vendors v ON p.vendor_id = v.id
      JOIN projects pr ON p.project_id = pr.id
      JOIN workflow_master wm ON p.workflow_id = wm.id
      LEFT JOIN workflow_steps ws ON p.current_step_id = ws.id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN users cu ON p.vendor_contact_user_id = cu.id
      WHERE p.id = ?
    `, [id]);
    return rows[0];
  }

  async create({ package_code, vendor_id, vendor_contact_user_id, project_id, workflow_id, current_step_id, current_step_order, remarks, created_by }) {
    const [result] = await pool.query(
      `INSERT INTO packages (package_code, vendor_id, vendor_contact_user_id, project_id, workflow_id,
        current_step_id, current_step_order, status, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?)`,
      [package_code, vendor_id, vendor_contact_user_id || null, project_id, workflow_id,
       current_step_id || null, current_step_order || 0, remarks || null, created_by]
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
      `UPDATE packages SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  // ── Package Files ──

  async getFiles(packageId) {
    const [rows] = await pool.query(
      `SELECT pf.*, u.name AS uploaded_by_name
       FROM package_files pf
       LEFT JOIN users u ON pf.uploaded_by = u.id
       WHERE pf.package_id = ?
       ORDER BY pf.created_at DESC`,
      [packageId]
    );
    return rows;
  }

  async createFile({ package_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by }) {
    const [result] = await pool.query(
      `INSERT INTO package_files (package_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [package_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by]
    );
    return result.insertId;
  }

  async deleteFile(fileId) {
    const [rows] = await pool.query('SELECT * FROM package_files WHERE id = ?', [fileId]);
    await pool.query('DELETE FROM package_files WHERE id = ?', [fileId]);
    return rows[0];
  }

  // ── Package History ──

  async getHistory(packageId) {
    const [rows] = await pool.query(`
      SELECT ph.*,
             fs.step_name AS from_step_name,
             ts.step_name AS to_step_name,
             u.name AS performed_by_name,
             r.role_name AS performed_by_role_name
      FROM package_history ph
      LEFT JOIN workflow_steps fs ON ph.from_step_id = fs.id
      LEFT JOIN workflow_steps ts ON ph.to_step_id = ts.id
      LEFT JOIN users u ON ph.performed_by = u.id
      LEFT JOIN roles r ON ph.performed_by_role_id = r.id
      WHERE ph.package_id = ?
      ORDER BY ph.created_at ASC
    `, [packageId]);
    return rows;
  }

  async createHistory({ package_id, from_step_id, to_step_id, action, action_label, performed_by, performed_by_role_id, remarks }) {
    const [result] = await pool.query(
      `INSERT INTO package_history (package_id, from_step_id, to_step_id, action, action_label,
        performed_by, performed_by_role_id, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [package_id, from_step_id || null, to_step_id || null, action, action_label || null,
       performed_by, performed_by_role_id, remarks]
    );
    return result.insertId;
  }

  // ── Inbox Queries ──

  async getInbox(roleId, { limit = 50, offset = 0 } = {}) {
    const [rows] = await pool.query(`
      SELECT p.*, v.vendor_name, pr.project_name, wm.workflow_name,
             ws.step_name AS current_step_name, ws.step_code AS current_step_code,
             cu.name AS contact_name,
             DATEDIFF(NOW(), p.updated_at) AS days_at_current_stage
      FROM packages p
      JOIN vendors v ON p.vendor_id = v.id
      JOIN projects pr ON p.project_id = pr.id
      JOIN workflow_master wm ON p.workflow_id = wm.id
      JOIN workflow_steps ws ON p.current_step_id = ws.id
      LEFT JOIN users cu ON p.vendor_contact_user_id = cu.id
      WHERE ws.required_role_id = ?
        AND p.is_completed = false
        AND p.status IN ('IN_PROGRESS', 'SENT_BACK')
      ORDER BY p.updated_at ASC
      LIMIT ? OFFSET ?
    `, [roleId, limit, offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM packages p
      JOIN workflow_steps ws ON p.current_step_id = ws.id
      WHERE ws.required_role_id = ? AND p.is_completed = false
        AND p.status IN ('IN_PROGRESS', 'SENT_BACK')
    `, [roleId]);

    return { rows, total: countResult[0].total };
  }

  async getOutbox(userId, { limit = 50, offset = 0 } = {}) {
    const [rows] = await pool.query(`
      SELECT p.*, v.vendor_name, pr.project_name, wm.workflow_name,
             ws.step_name AS current_step_name,
             (SELECT ph2.action_label FROM package_history ph2
              WHERE ph2.package_id = p.id AND ph2.performed_by = ?
              ORDER BY ph2.created_at DESC LIMIT 1) AS last_action
      FROM packages p
      JOIN vendors v ON p.vendor_id = v.id
      JOIN projects pr ON p.project_id = pr.id
      JOIN workflow_master wm ON p.workflow_id = wm.id
      LEFT JOIN workflow_steps ws ON p.current_step_id = ws.id
      WHERE p.id IN (
        SELECT package_id FROM package_history WHERE performed_by = ?
      )
      ORDER BY p.updated_at DESC
      LIMIT ? OFFSET ?
    `, [userId, userId, limit, offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as total
      FROM packages p
      JOIN package_history ph ON p.id = ph.package_id
      WHERE ph.performed_by = ?
    `, [userId]);

    return { rows, total: countResult[0].total };
  }

  async getInboxStats(roleId) {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN p.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN p.status = 'SENT_BACK' THEN 1 ELSE 0 END) AS returned
      FROM packages p
      JOIN workflow_steps ws ON p.current_step_id = ws.id
      WHERE ws.required_role_id = ? AND p.is_completed = false
    `, [roleId]);
    return rows[0];
  }

  async getLastPackageCode() {
    const [rows] = await pool.query(
      'SELECT package_code FROM packages ORDER BY id DESC LIMIT 1'
    );
    return rows[0]?.package_code || null;
  }
}

module.exports = new PackageRepository();
