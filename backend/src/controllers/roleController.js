const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const auditService = require('../services/auditService');

const getAllRoles = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, role_name, description, role_rank, permissions, is_active FROM roles ORDER BY role_rank DESC'
    );
    res.json(ApiResponse.success('Roles fetched successfully', rows));
  } catch (error) {
    next(error);
  }
};

const getRoleById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, role_name, description, role_rank, permissions, is_active FROM roles WHERE id = ?',
      [req.params.id]
    );
    if (!rows[0]) throw new ApiError(404, 'Role not found');
    res.json(ApiResponse.success('Role fetched successfully', [rows[0]]));
  } catch (error) {
    next(error);
  }
};

const createRole = async (req, res, next) => {
  try {
    const { role_name, description, role_rank, permissions } = req.body;

    const [existing] = await pool.query('SELECT id FROM roles WHERE role_name = ?', [role_name]);
    if (existing[0]) throw new ApiError(409, 'Role name already exists');

    const permissionsJson = typeof permissions === 'string' ? permissions : JSON.stringify(permissions || {});

    const [result] = await pool.query(
      'INSERT INTO roles (role_name, description, role_rank, permissions) VALUES (?, ?, ?, ?)',
      [role_name, description || null, role_rank || 0, permissionsJson]
    );

    await auditService.log({
      table_name: 'roles',
      record_id: result.insertId,
      action: 'CREATE',
      new_value: { role_name, role_rank },
      performed_by: req.user.user_id,
      ip_address: req.ip
    });

    const [created] = await pool.query('SELECT * FROM roles WHERE id = ?', [result.insertId]);
    res.status(201).json(ApiResponse.success('Role created successfully', [created[0]]));
  } catch (error) {
    next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const { role_name, description, role_rank, permissions, is_active } = req.body;

    const [existing] = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!existing[0]) throw new ApiError(404, 'Role not found');

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

    if (updates.length > 0) {
      params.push(req.params.id);
      await pool.query(
        `UPDATE roles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
    }

    await auditService.log({
      table_name: 'roles',
      record_id: Number(req.params.id),
      action: 'UPDATE',
      old_value: { role_name: existing[0].role_name },
      new_value: req.body,
      performed_by: req.user.user_id,
      ip_address: req.ip
    });

    const [updated] = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    res.json(ApiResponse.success('Role updated successfully', [updated[0]]));
  } catch (error) {
    next(error);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!existing[0]) throw new ApiError(404, 'Role not found');

    // Check if role is in use
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role_id = ?', [req.params.id]);
    if (userCount[0].count > 0) {
      throw new ApiError(400, `Cannot delete role "${existing[0].role_name}" — ${userCount[0].count} user(s) are assigned to it`);
    }

    await pool.query('UPDATE roles SET is_active = 0 WHERE id = ?', [req.params.id]);

    await auditService.log({
      table_name: 'roles',
      record_id: Number(req.params.id),
      action: 'DELETE',
      old_value: { role_name: existing[0].role_name },
      performed_by: req.user.user_id,
      ip_address: req.ip
    });

    res.json(ApiResponse.success('Role deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllRoles, getRoleById, createRole, updateRole, deleteRole };
