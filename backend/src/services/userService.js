const userRepository = require('../repositories/userRepository');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');
const bcrypt = require('bcryptjs');

class UserService {
  async getAll(params, currentUser) {
    const queryParams = { ...params };

    if (currentUser && currentUser.role_rank < 100) {
      queryParams.max_role_rank = currentUser.role_rank - 1;
    }

    return userRepository.getAllUsers(queryParams);
  }

  async getById(id, currentUser) {
    const user = await userRepository.findById(id);
    if (!user) throw new ApiError(404, 'User not found');

    if (currentUser && currentUser.role_rank < 100 && user.role_rank >= currentUser.role_rank) {
      throw new ApiError(403, 'Access denied: You can only view users with roles lower than your own');
    }

    return user;
  }

  async create(data, performedBy, ipAddress) {
    const { name, email, password, role_id, designation, phone, vendor_id } = data;

    // Check only non-deleted users to prevent duplicate email
    // Users can re-use an email from a deleted account
    const existing = await userRepository.findByEmailAll(email);
    if (existing) throw new ApiError(409, 'Email already in use');

    const currentUser = await this.getById(performedBy);
    const targetRole = await this.getRoleById(role_id);

    if (currentUser.role_rank < 100 && targetRole.role_rank >= currentUser.role_rank) {
      throw new ApiError(403,
        `Access denied: You can only create users with roles lower than your own (rank ${currentUser.role_rank}). ` +
        `Target role "${targetRole.role_name}" has rank ${targetRole.role_rank}.`
      );
    }

    const password_hash = await bcrypt.hash(password, 12);

    const userId = await userRepository.createUser({
      name, email, password_hash, role_id, designation, phone, vendor_id
    });

    await auditService.log({
      table_name: 'users',
      record_id: userId,
      action: 'CREATE',
      new_value: { name, email, role_id, vendor_id },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return this.getById(userId);
  }

  async update(id, data, performedBy, ipAddress) {
    const existing = await this.getById(id);
    const currentUser = await this.getById(performedBy);

    if (currentUser.role_rank < 100 && existing.role_rank >= currentUser.role_rank) {
      throw new ApiError(403,
        `Access denied: You can only update users with roles lower than your own (rank ${currentUser.role_rank}). ` +
        `Target user "${existing.name}" has role rank ${existing.role_rank}.`
      );
    }

    if (data.role_id) {
      const targetRole = await this.getRoleById(data.role_id);
      if (currentUser.role_rank < 100 && targetRole.role_rank >= currentUser.role_rank) {
        throw new ApiError(403,
          `Cannot assign a role ("${targetRole.role_name}") with equal or higher rank than your own`
        );
      }
    }

    const { name, role_id, designation, phone, is_active, vendor_id, has_digital_signature } = data;

    await userRepository.updateUser(id, {
      name, role_id, designation, phone, is_active, vendor_id, has_digital_signature
    });

    await auditService.log({
      table_name: 'users',
      record_id: id,
      action: 'UPDATE',
      old_value: { name: existing.name, role_id: existing.role_id, is_active: existing.is_active },
      new_value: { name, role_id, is_active, vendor_id },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return this.getById(id);
  }

  async delete(id, performedBy, ipAddress) {
    const existing = await this.getById(id);
    const currentUser = await this.getById(performedBy);

    if (Number(id) === performedBy) {
      throw new ApiError(400, 'You cannot delete your own account');
    }

    if (currentUser.role_rank < 100 && existing.role_rank >= currentUser.role_rank) {
      throw new ApiError(403,
        `Access denied: You can only delete users with roles lower than your own (rank ${currentUser.role_rank}). ` +
        `Target user "${existing.name}" has role rank ${existing.role_rank}.`
      );
    }

    await userRepository.deleteUser(id);

    await auditService.log({
      table_name: 'users',
      record_id: id,
      action: 'DELETE',
      old_value: { name: existing.name, email: existing.email },
      performed_by: performedBy,
      ip_address: ipAddress
    });
  }

  async getAllRoles() {
    const pool = require('../config/db');
    const [rows] = await pool.query(
      'SELECT id, role_name, description, role_rank, permissions, is_active FROM roles ORDER BY role_rank DESC'
    );
    return rows;
  }

  async getRoleById(roleId) {
    const pool = require('../config/db');
    const [rows] = await pool.query(
      'SELECT id, role_name, description, role_rank, permissions, is_active FROM roles WHERE id = ?',
      [roleId]
    );
    if (!rows[0]) throw new ApiError(404, 'Role not found');
    return rows[0];
  }

  async getOfficers() {
    return userRepository.findOfficers();
  }
}

module.exports = new UserService();
