const pool = require('../config/db');

class PORepository {
  async getAll({ limit = 50, offset = 0, project_id, vendor_id, status, search, is_active } = {}) {
    let conditions = ['po.is_deleted = false'];
    let params = [];

    if (project_id) { conditions.push('po.project_id = ?'); params.push(project_id); }
    if (vendor_id) { conditions.push('EXISTS (SELECT 1 FROM po_vendors pv WHERE pv.po_id = po.id AND pv.vendor_id = ?)'); params.push(vendor_id); }
    if (status) { conditions.push('po.status = ?'); params.push(status); }
    if (is_active !== undefined) { conditions.push('po.is_active = ?'); params.push(is_active); }
    if (search) {
      conditions.push('(po.po_number LIKE ? OR pr.project_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const [rows] = await pool.query(`
      SELECT po.*, pr.project_name,
             GROUP_CONCAT(DISTINCT v.vendor_name SEPARATOR ', ') AS vendor_names,
             GROUP_CONCAT(DISTINCT v.id SEPARATOR ',') AS vendor_ids,
             u.name AS created_by_name
      FROM purchase_orders po
      JOIN projects pr ON po.project_id = pr.id
      LEFT JOIN po_vendors pv ON po.id = pv.po_id
      LEFT JOIN vendors v ON pv.vendor_id = v.id AND v.is_deleted = false
      LEFT JOIN users u ON po.created_by = u.id
      ${whereClause}
      GROUP BY po.id, pr.project_name, u.name
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [countResult] = await pool.query(
      `SELECT COUNT(DISTINCT po.id) as total FROM purchase_orders po
       JOIN projects pr ON po.project_id = pr.id
       ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  async getById(id) {
    const [rows] = await pool.query(`
      SELECT po.*, pr.project_name,
             GROUP_CONCAT(DISTINCT v.vendor_name SEPARATOR ', ') AS vendor_names,
             GROUP_CONCAT(DISTINCT v.id SEPARATOR ',') AS vendor_ids,
             u.name AS created_by_name
      FROM purchase_orders po
      JOIN projects pr ON po.project_id = pr.id
      LEFT JOIN po_vendors pv ON po.id = pv.po_id
      LEFT JOIN vendors v ON pv.vendor_id = v.id AND v.is_deleted = false
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = ? AND po.is_deleted = false
      GROUP BY po.id, pr.project_name, u.name
    `, [id]);
    return rows[0];
  }

  async getVendorPOs(vendorId) {
    const [rows] = await pool.query(`
      SELECT po.*, pr.project_name
      FROM purchase_orders po
      JOIN projects pr ON po.project_id = pr.id
      JOIN po_vendors pv ON po.id = pv.po_id
      WHERE pv.vendor_id = ? AND po.status = 'ACTIVE' AND po.is_active = 1 AND po.is_deleted = false
      ORDER BY po.created_at DESC
    `, [vendorId]);
    return rows;
  }

  async create({ po_number, project_id, description, amount, created_by }) {
    const [result] = await pool.query(
      `INSERT INTO purchase_orders (po_number, project_id, description, amount, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [po_number, project_id, description || null, amount || null, created_by]
    );
    return result.insertId;
  }

  async update(id, { project_id, description, amount, status, is_active }) {
    const updates = [];
    const params = [];

    if (project_id !== undefined) { updates.push('project_id = ?'); params.push(project_id); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (amount !== undefined) { updates.push('amount = ?'); params.push(amount); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE purchase_orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  async softDelete(id) {
    await pool.query('UPDATE purchase_orders SET is_deleted = 1, status = "CANCELLED", deleted_at = NOW() WHERE id = ?', [id]);
  }

  async getLastPONumber() {
    const [rows] = await pool.query(
      'SELECT po_number FROM purchase_orders WHERE is_deleted = false ORDER BY id DESC LIMIT 1'
    );
    return rows[0]?.po_number || null;
  }

  // ── PO-Vendor Assignment ──

  async getVendorIds(poId) {
    const [rows] = await pool.query(
      'SELECT vendor_id FROM po_vendors WHERE po_id = ?',
      [poId]
    );
    return rows.map(r => r.vendor_id);
  }

  async assignVendor(poId, vendorId) {
    await pool.query(
      'INSERT IGNORE INTO po_vendors (po_id, vendor_id) VALUES (?, ?)',
      [poId, vendorId]
    );
  }

  async removeVendor(poId, vendorId) {
    await pool.query(
      'DELETE FROM po_vendors WHERE po_id = ? AND vendor_id = ?',
      [poId, vendorId]
    );
  }

  async syncVendors(poId, vendorIds) {
    // Remove all existing, then insert new
    await pool.query('DELETE FROM po_vendors WHERE po_id = ?', [poId]);
    if (vendorIds && vendorIds.length > 0) {
      const values = vendorIds.map(vId => [poId, vId]);
      await pool.query(
        'INSERT INTO po_vendors (po_id, vendor_id) VALUES ?',
        [values]
      );
    }
  }

  // ── PO Files ──

  async getFiles(poId) {
    const [rows] = await pool.query(`
      SELECT pf.*, u.name AS uploaded_by_name
      FROM po_files pf
      LEFT JOIN users u ON pf.uploaded_by = u.id
      WHERE pf.po_id = ? AND pf.is_deleted = false
      ORDER BY pf.created_at DESC
    `, [poId]);
    return rows;
  }

  async createFile({ po_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by }) {
    const [result] = await pool.query(
      `INSERT INTO po_files (po_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [po_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by]
    );
    return result.insertId;
  }

  async deleteFile(fileId) {
    await pool.query('UPDATE po_files SET is_deleted = 1 WHERE id = ?', [fileId]);
    return { id: fileId, is_deleted: 1 };
  }
}

module.exports = new PORepository();
