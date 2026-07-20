const pool = require('../config/db');

class ProjectRepository {
  async getAll({ limit = 50, offset = 0, search, is_active } = {}) {
    let conditions = [];
    let params = [];

    if (search) {
      conditions.push('(project_name LIKE ? OR project_code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(is_active);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT * FROM projects ${whereClause} ORDER BY project_name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM projects ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    return rows[0];
  }

  async create({ project_name, project_code, description }) {
    const [result] = await pool.query(
      'INSERT INTO projects (project_name, project_code, description) VALUES (?, ?, ?)',
      [project_name, project_code || null, description || null]
    );
    return result.insertId;
  }

  async update(id, { project_name, project_code, description, is_active }) {
    const updates = [];
    const params = [];

    if (project_name !== undefined) { updates.push('project_name = ?'); params.push(project_name); }
    if (project_code !== undefined) { updates.push('project_code = ?'); params.push(project_code); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE projects SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  async delete(id) {
    await pool.query('UPDATE projects SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = new ProjectRepository();
