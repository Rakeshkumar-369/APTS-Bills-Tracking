// src/controllers/roleController.js
const roleRepository = require('../repositories/roleRepository');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const auditService = require('../services/auditService');

const getAllRoles = async (req, res, next) => {
  try {
    const rows = await roleRepository.getAll();
    res.json(ApiResponse.success('Roles fetched successfully', rows));
  } catch (error) {
    next(error);
  }
};

const getRoleById = async (req, res, next) => {
  try {
    const role = await roleRepository.getById(req.params.id);
    if (!role) throw new ApiError(404, 'Role not found');
    res.json(ApiResponse.success('Role fetched successfully', [role]));
  } catch (error) {
    next(error);
  }
};

const createRole = async (req, res, next) => {
  try {
    const { role_name, description, role_rank, permissions } = req.body;

    const existing = await roleRepository.getByName(role_name);
    if (existing) throw new ApiError(409, 'A role with this name already exists');

    const roleId = await roleRepository.create({ role_name, description, role_rank, permissions });

    await auditService.log({
      table_name: 'roles',
      record_id: roleId,
      action: 'CREATE',
      new_value: { role_name, role_rank },
      performed_by: req.user.user_id,
      ip_address: req.ip
    });

    const created = await roleRepository.getById(roleId);
    res.status(201).json(ApiResponse.success('Role created successfully', [created]));
  } catch (error) {
    next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const { role_name, description, role_rank, permissions, is_active } = req.body;

    const existing = await roleRepository.getById(req.params.id);
    if (!existing) throw new ApiError(404, 'Role not found');

    // Check for duplicate role name if name is being changed
    if (role_name !== undefined && role_name.toLowerCase() !== existing.role_name.toLowerCase()) {
      const nameConflict = await roleRepository.getByNameExcludingId(role_name, req.params.id);
      if (nameConflict) throw new ApiError(409, 'A role with this name already exists');
    }

    await roleRepository.update(req.params.id, { role_name, description, role_rank, permissions, is_active });

    await auditService.log({
      table_name: 'roles',
      record_id: Number(req.params.id),
      action: 'UPDATE',
      old_value: { role_name: existing.role_name },
      new_value: req.body,
      performed_by: req.user.user_id,
      ip_address: req.ip
    });

    const updated = await roleRepository.getById(req.params.id);
    res.json(ApiResponse.success('Role updated successfully', [updated]));
  } catch (error) {
    next(error);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    const existing = await roleRepository.getById(req.params.id);
    if (!existing) throw new ApiError(404, 'Role not found');

    // Check if role is in use
    const userCount = await roleRepository.getUserCountByRoleId(req.params.id);
    if (userCount > 0) {
      throw new ApiError(400, `Cannot delete role "${existing.role_name}" — ${userCount} user(s) are assigned to it`);
    }

    await roleRepository.delete(req.params.id);

    await auditService.log({
      table_name: 'roles',
      record_id: Number(req.params.id),
      action: 'DELETE',
      old_value: { role_name: existing.role_name },
      performed_by: req.user.user_id,
      ip_address: req.ip
    });

    res.json(ApiResponse.success('Role deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllRoles, getRoleById, createRole, updateRole, deleteRole };
