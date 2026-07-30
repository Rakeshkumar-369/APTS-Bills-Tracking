const pool = require('../config/db');

class ProjectRepository {
  async getAll({ limit = 50, offset = 0, search, is_active, vendor_id } = {}) {
    let conditions = ['p.is_deleted = false'];
    let joins = [];
    let params = [];

    if (search) {
      conditions.push('(p.project_name LIKE ? OR p.project_code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (is_active !== undefined) {
      conditions.push('p.is_active = ?');
      params.push(is_active);
    }
    if (vendor_id) {
      joins.push('JOIN vendor_projects vp ON p.id = vp.project_id AND vp.vendor_id = ?');
      params.push(vendor_id);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');
    const joinClause = joins.join(' ');

    const [rows] = await pool.query(
      `SELECT p.*, wm.workflow_name
       FROM projects p
       LEFT JOIN workflow_master wm ON p.workflow_id = wm.id AND wm.is_deleted = false
       ${joinClause}
       ${whereClause}
       ORDER BY p.project_name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM projects p
       ${joinClause}
       ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  async getById(id) {
    const [rows] = await pool.query(
      `SELECT p.*, wm.workflow_name
       FROM projects p
       LEFT JOIN workflow_master wm ON p.workflow_id = wm.id AND wm.is_deleted = false
       WHERE p.id = ? AND p.is_deleted = false`,
      [id]
    );
    return rows[0];
  }

  async create({ project_name, project_code, description, workflow_id }) {
    const [result] = await pool.query(
      'INSERT INTO projects (project_name, project_code, description, workflow_id) VALUES (?, ?, ?, ?)',
      [project_name, project_code || null, description || null, workflow_id || null]
    );
    return result.insertId;
  }

  async update(id, { project_name, project_code, description, workflow_id, is_active }) {
    const updates = [];
    const params = [];

    if (project_name !== undefined) { updates.push('project_name = ?'); params.push(project_name); }
    if (project_code !== undefined) { updates.push('project_code = ?'); params.push(project_code); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (workflow_id !== undefined) { updates.push('workflow_id = ?'); params.push(workflow_id); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE projects SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  async delete(id) {
    await pool.query('UPDATE projects SET is_deleted = 1 WHERE id = ?', [id]);
  }

  // ── Vendor-Project Assignment ──

  async getProjectsByVendor(vendorId) {
    const [rows] = await pool.query(
      `SELECT p.*, wm.workflow_name
       FROM projects p
       LEFT JOIN workflow_master wm ON p.workflow_id = wm.id AND wm.is_deleted = false
       JOIN vendor_projects vp ON p.id = vp.project_id
       WHERE vp.vendor_id = ? AND p.is_active = 1 AND p.is_deleted = false
       ORDER BY p.project_name ASC`,
      [vendorId]
    );
    return rows;
  }

  async assignVendorProject(vendorId, projectId) {
    await pool.query(
      'INSERT IGNORE INTO vendor_projects (vendor_id, project_id) VALUES (?, ?)',
      [vendorId, projectId]
    );
  }

  async removeVendorProject(vendorId, projectId) {
    await pool.query(
      'DELETE FROM vendor_projects WHERE vendor_id = ? AND project_id = ?',
      [vendorId, projectId]
    );
  }

  async getVendorProjectIds(vendorId) {
    const [rows] = await pool.query(
      'SELECT project_id FROM vendor_projects WHERE vendor_id = ?',
      [vendorId]
    );
    return rows.map(r => r.project_id);
  }
}

module.exports = new ProjectRepository();
