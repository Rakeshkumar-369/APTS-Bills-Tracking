const pool = require('../config/db');
const crypto = require('crypto');
const { parsePermissions } = require('../utils/permissionHelper');

class UserRepository {
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ── AUTH ──

  async findByEmail(email) {
    const [rows] = await pool.query(`
      SELECT u.*, r.role_name, r.permissions, r.role_rank,
             v.vendor_name AS vendor_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN vendors v ON u.vendor_id = v.id
      WHERE u.email = ? AND u.is_active = true AND u.is_deleted = false
        AND r.is_active = true
    `, [email]);

    if (rows[0]) {
      rows[0].permissions = parsePermissions(rows[0].permissions);
    }

    return rows[0];
  }

  async findById(id) {
    const [rows] = await pool.query(`
      SELECT u.*, r.role_name, r.permissions, r.role_rank,
             v.vendor_name AS vendor_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN vendors v ON u.vendor_id = v.id
      WHERE u.id = ? AND u.is_active = true AND u.is_deleted = false
    `, [id]);

    if (rows[0]) {
      rows[0].permissions = parsePermissions(rows[0].permissions);
    }

    return rows[0];
  }

  async getBlockedStatus(email) {
    const [rows] = await pool.query(
      'SELECT * FROM blocked_users WHERE email = ?',
      [email]
    );
    return rows[0];
  }

  async updateFailedLogin(email, isBlocked, blockTime) {
    const existing = await this.getBlockedStatus(email);

    if (existing) {
      if (isBlocked) {
        await pool.query(
          'UPDATE blocked_users SET attempts = attempts + 1, blocked_until = ? WHERE email = ?',
          [blockTime, email]
        );
      } else {
        await pool.query(
          'UPDATE blocked_users SET attempts = attempts + 1 WHERE email = ?',
          [email]
        );
      }
    } else {
      await pool.query(
        'INSERT INTO blocked_users (email, attempts) VALUES (?, 1)',
        [email]
      );
    }
  }

  async resetLoginAttempts(email) {
    await pool.query('DELETE FROM blocked_users WHERE email = ?', [email]);
  }

  async incrementSessionVersion(userId) {
    await pool.query(
      'UPDATE users SET session_version = session_version + 1 WHERE id = ?',
      [userId]
    );
  }

  async getSessionVersion(userId) {
    const [rows] = await pool.query(
      'SELECT session_version FROM users WHERE id = ?',
      [userId]
    );
    return rows[0]?.session_version;
  }

  async updateLastLoginTime(userId, ipAddress) {
    await pool.query(
      'UPDATE users SET last_login_time = NOW(), last_login_ip = ? WHERE id = ?',
      [ipAddress, userId]
    );
  }

  // ── REFRESH TOKENS ──

  async saveRefreshToken(userId, token, expiresAt) {
    const tokenHash = this.hashToken(token);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt]
    );
  }

  async findRefreshToken(token) {
    const tokenHash = this.hashToken(token);
    const [rows] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = ?',
      [tokenHash]
    );
    return rows[0];
  }

  async deleteRefreshToken(token) {
    const tokenHash = this.hashToken(token);
    await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [tokenHash]);
  }

  async deleteUserRefreshTokens(userId) {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }

  // ── PASSWORD ──

  async verifyPassword(userId) {
    const [rows] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );
    return rows[0]?.password_hash;
  }

  async updatePassword(userId, newPasswordHash) {
    await pool.query(
      `UPDATE users
       SET password_hash = ?, session_version = session_version + 1, updated_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, userId]
    );

    const newSessionVersion = await this.getSessionVersion(userId);
    return newSessionVersion;
  }

  // ── USER MANAGEMENT ──

  /**
   * Find user by email regardless of is_deleted status.
   * Used for checking duplicates on create — excludes only is_deleted=1 so
   * users CAN register with an email that belonged to a deleted account.
   */
  async findByEmailAll(email) {
    const [rows] = await pool.query(
      'SELECT id, email, is_active, is_deleted FROM users WHERE email = ? AND is_deleted = false',
      [email]
    );
    return rows[0];
  }

  async createUser({ name, email, password_hash, role_id, designation, phone, vendor_id }) {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id, designation, phone, vendor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, password_hash, role_id, designation || null, phone || null, vendor_id || null]
    );
    return result.insertId;
  }

  async getAllUsers({ limit, offset, search, role_id, is_active, vendor_id } = {}) {
    let whereConditions = ['u.is_deleted = false'];
    let params = [];

    if (search) {
      whereConditions.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role_id) {
      whereConditions.push('u.role_id = ?');
      params.push(role_id);
    }
    if (is_active !== undefined) {
      whereConditions.push('u.is_active = ?');
      params.push(is_active);
    }
    if (vendor_id) {
      whereConditions.push('u.vendor_id = ?');
      params.push(vendor_id);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, u.role_id, r.role_name, r.role_rank,
             u.designation, u.phone, u.is_active, u.vendor_id, u.has_digital_signature,
             u.last_login_time, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY r.role_rank DESC, u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM users u
       JOIN roles r ON u.role_id = r.id
       ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  /**
   * Find all officers available for manual claim assignment.
   * Excludes: Super Admin, Admin, and Vendor users.
   */
  async findOfficers() {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = true AND u.is_deleted = false
        AND r.is_active = true
        AND r.role_name NOT IN ('Super Admin', 'Admin', 'Vendor')
      ORDER BY r.role_rank ASC, u.name ASC
    `);
    return rows;
  }

  async updateUser(id, { name, role_id, designation, phone, is_active, vendor_id, has_digital_signature }) {
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (role_id !== undefined) { updates.push('role_id = ?'); params.push(role_id); }
    if (designation !== undefined) { updates.push('designation = ?'); params.push(designation); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (vendor_id !== undefined) { updates.push('vendor_id = ?'); params.push(vendor_id); }
    if (has_digital_signature !== undefined) { updates.push('has_digital_signature = ?'); params.push(has_digital_signature ? 1 : 0); }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
    }
  }

  async deleteUser(id) {
    await pool.query('UPDATE users SET is_deleted = 1 WHERE id = ?', [id]);
  }

  async findVendorUsers(vendorId) {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, u.designation, u.phone
      FROM users u
      WHERE u.vendor_id = ? AND u.is_active = true AND u.is_deleted = false
    `, [vendorId]);
    return rows;
  }
}

module.exports = new UserRepository();
