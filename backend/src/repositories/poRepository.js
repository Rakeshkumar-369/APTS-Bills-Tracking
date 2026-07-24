const pool = require('../config/db');

class PORepository {
  async getAll({ limit = 50, offset = 0, project_id, vendor_id, status, search, is_active } = {}) {
    let conditions = [];
    let params = [];

    if (project_id) { conditions.push('po.project_id = ?'); params.push(project_id); }
    if (vendor_id) { conditions.push('po.vendor_id = ?'); params.push(vendor_id); }
    if (status) { conditions.push('po.status = ?'); params.push(status); }
    if (is_active !== undefined) { conditions.push('po.is_active = ?'); params.push(is_active); }
    if (search) {
      conditions.push('(po.po_number LIKE ? OR pr.project_name LIKE ? OR v.vendor_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(`
      SELECT po.*, pr.project_name, v.vendor_name, u.name AS created_by_name
      FROM purchase_orders po
      JOIN projects pr ON po.project_id = pr.id
      JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN users u ON po.created_by = u.id
      ${whereClause}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM purchase_orders po
       JOIN projects pr ON po.project_id = pr.id
       JOIN vendors v ON po.vendor_id = v.id
       ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  async getById(id) {
    const [rows] = await pool.query(`
      SELECT po.*, pr.project_name, v.vendor_name, u.name AS created_by_name
      FROM purchase_orders po
      JOIN projects pr ON po.project_id = pr.id
      JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = ?
    `, [id]);
    return rows[0];
  }

  async getVendorPOs(vendorId) {
    const [rows] = await pool.query(`
      SELECT po.*, pr.project_name
      FROM purchase_orders po
      JOIN projects pr ON po.project_id = pr.id
      WHERE po.vendor_id = ? AND po.status = 'ACTIVE' AND po.is_active = 1
      ORDER BY po.created_at DESC
    `, [vendorId]);
    return rows;
  }

  async create({ po_number, project_id, vendor_id, description, amount, created_by }) {
    const [result] = await pool.query(
      `INSERT INTO purchase_orders (po_number, project_id, vendor_id, description, amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [po_number, project_id, vendor_id, description || null, amount || null, created_by]
    );
    return result.insertId;
  }

  async update(id, { project_id, vendor_id, description, amount, status, is_active }) {
    const updates = [];
    const params = [];

    if (project_id !== undefined) { updates.push('project_id = ?'); params.push(project_id); }
    if (vendor_id !== undefined) { updates.push('vendor_id = ?'); params.push(vendor_id); }
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
    await pool.query('UPDATE purchase_orders SET is_active = 0, status = "CANCELLED" WHERE id = ?', [id]);
  }

  async getLastPONumber() {
    const [rows] = await pool.query(
      'SELECT po_number FROM purchase_orders ORDER BY id DESC LIMIT 1'
    );
    return rows[0]?.po_number || null;
  }

  // ── PO Files ──

  async getFiles(poId) {
    const [rows] = await pool.query(`
      SELECT pf.*, u.name AS uploaded_by_name
      FROM po_files pf
      LEFT JOIN users u ON pf.uploaded_by = u.id
      WHERE pf.po_id = ?
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
    const [rows] = await pool.query('SELECT * FROM po_files WHERE id = ?', [fileId]);
    await pool.query('DELETE FROM po_files WHERE id = ?', [fileId]);
    return rows[0];
  }
}

module.exports = new PORepository();
