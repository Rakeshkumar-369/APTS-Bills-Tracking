const pool = require('../config/db');

class VendorRepository {
  async getAll({ limit = 50, offset = 0, search, is_active } = {}) {
    let conditions = [];
    let params = [];

    if (search) {
      conditions.push('(vendor_name LIKE ? OR vendor_code LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(is_active);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT * FROM vendors ${whereClause} ORDER BY vendor_name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM vendors ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [id]);
    return rows[0];
  }

  async create({ vendor_name, vendor_code, contact_person, email, phone, address }) {
    const [result] = await pool.query(
      `INSERT INTO vendors (vendor_name, vendor_code, contact_person, email, phone, address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [vendor_name, vendor_code || null, contact_person || null, email || null, phone || null, address || null]
    );
    return result.insertId;
  }

  async update(id, { vendor_name, vendor_code, contact_person, email, phone, address, is_active }) {
    const updates = [];
    const params = [];

    if (vendor_name !== undefined) { updates.push('vendor_name = ?'); params.push(vendor_name); }
    if (vendor_code !== undefined) { updates.push('vendor_code = ?'); params.push(vendor_code); }
    if (contact_person !== undefined) { updates.push('contact_person = ?'); params.push(contact_person); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE vendors SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  async delete(id) {
    await pool.query('UPDATE vendors SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = new VendorRepository();
