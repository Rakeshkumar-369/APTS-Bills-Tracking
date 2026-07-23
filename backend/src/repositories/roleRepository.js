// src/repositories/roleRepository.js
const pool = require('../config/db');

class RoleRepository {
  async getAll() {
    const [rows] = await pool.query(
      'SELECT id, role_name, description, role_rank, permissions, is_active FROM roles ORDER BY role_rank DESC'
    );
    return rows;
  }

  async getById(id) {
    const [rows] = await pool.query(
      'SELECT id, role_name, description, role_rank, permissions, is_active FROM roles WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  async getByName(name) {
    const [rows] = await pool.query(
      'SELECT id FROM roles WHERE role_name = ?',
      [name]
    );
    return rows[0];
  }

  async getByNameExcludingId(name, excludeId) {
    const [rows] = await pool.query(
      'SELECT id FROM roles WHERE role_name = ? AND id != ?',
      [name, excludeId]
    );
    return rows[0];
  }

  async create({ role_name, description, role_rank, permissions }) {
    const permissionsJson = typeof permissions === 'string' ? permissions : JSON.stringify(permissions || {});
    const [result] = await pool.query(
      'INSERT INTO roles (role_name, description, role_rank, permissions) VALUES (?, ?, ?, ?)',
      [role_name, description || null, role_rank || 0, permissionsJson]
    );
    return result.insertId;
  }

  async update(id, { role_name, description, role_rank, permissions, is_active }) {
    const updates = [];
    const params = [];

    if (role_name !== undefined) { updates.push('role_name = ?'); params.push(role_name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (role_rank !== undefined) { updates.push('role_rank = ?'); params.push(role_rank); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (permissions !== undefined) {
      updates.push('permissions = ?');
      params.push(typeof permissions === 'string' ? permissions : JSON.stringify(permissions));
    }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE roles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  async delete(id) {
    await pool.query('UPDATE roles SET is_active = 0 WHERE id = ?', [id]);
  }

  async getUserCountByRoleId(roleId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role_id = ?',
      [roleId]
    );
    return rows[0].count;
  }
}

module.exports = new RoleRepository();
