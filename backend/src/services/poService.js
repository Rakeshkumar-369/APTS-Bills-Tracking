const poRepository = require('../repositories/poRepository');
const projectRepository = require('../repositories/projectRepository');
const vendorRepository = require('../repositories/vendorRepository');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/purchase-orders');

class POService {
  async getAll(params) {
    return poRepository.getAll(params);
  }

  async getById(id) {
    const po = await poRepository.getById(id);
    if (!po) throw new ApiError(404, 'Purchase Order not found');
    return po;
  }

  async getWithFiles(id) {
    const po = await this.getById(id);
    po.files = await poRepository.getFiles(id);
    return po;
  }

  async getVendorPOs(vendorId) {
    return poRepository.getVendorPOs(vendorId);
  }

  async create(data, performedBy, ipAddress) {
    const { project_id, vendor_id, description, amount } = data;

    // Validate project exists
    const project = await projectRepository.getById(project_id);
    if (!project) throw new ApiError(400, 'Project not found');

    // Validate vendor exists
    const vendor = await vendorRepository.getById(vendor_id);
    if (!vendor) throw new ApiError(400, 'Vendor not found');

    // Generate PO number
    const poNumber = await this.generatePONumber();

    const poId = await poRepository.create({
      po_number: poNumber,
      project_id,
      vendor_id,
      description: description || null,
      amount: amount || null,
      created_by: performedBy
    });

    await auditService.log({
      table_name: 'purchase_orders',
      record_id: poId,
      action: 'CREATE',
      new_value: { po_number: poNumber, project_id, vendor_id, amount },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return this.getById(poId);
  }

  async update(id, data, performedBy, ipAddress) {
    const existing = await this.getById(id);

    // If vendor changes, validate
    if (data.vendor_id) {
      const vendor = await vendorRepository.getById(data.vendor_id);
      if (!vendor) throw new ApiError(400, 'Vendor not found');
    }

    // If project changes, validate
    if (data.project_id) {
      const project = await projectRepository.getById(data.project_id);
      if (!project) throw new ApiError(400, 'Project not found');
    }

    await poRepository.update(id, data);

    await auditService.log({
      table_name: 'purchase_orders',
      record_id: id,
      action: 'UPDATE',
      old_value: { po_number: existing.po_number, project_id: existing.project_id, vendor_id: existing.vendor_id, status: existing.status },
      new_value: data,
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return this.getById(id);
  }

  async delete(id, performedBy, ipAddress) {
    const existing = await this.getById(id);

    await poRepository.softDelete(id);

    await auditService.log({
      table_name: 'purchase_orders',
      record_id: id,
      action: 'DELETE',
      old_value: { po_number: existing.po_number, status: existing.status },
      performed_by: performedBy,
      ip_address: ipAddress
    });
  }

  async generatePONumber() {
    const lastPONumber = await poRepository.getLastPONumber();
    const year = new Date().getFullYear();
    let nextNum = 1;

    if (lastPONumber) {
      const parts = lastPONumber.split('-');
      if (parts.length >= 2) {
        nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
    }

    return `PO-${year}-${String(nextNum).padStart(4, '0')}`;
  }

  // ── PO Files ──

  async uploadFile(poId, file, currentUser) {
    const po = await this.getById(poId);

    const uploadDir = path.join(UPLOADS_DIR, String(poId));
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(file.originalname);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, storedName);

    fs.writeFileSync(filePath, file.buffer);

    const fileId = await poRepository.createFile({
      po_id: poId,
      original_name: file.originalname,
      stored_name: storedName,
      file_path: path.join('uploads/purchase-orders', String(poId), storedName),
      file_size: file.size,
      mime_type: file.mimetype || 'application/octet-stream',
      uploaded_by: currentUser.user_id
    });

    return fileId;
  }

  async deleteFile(poId, fileId, currentUser) {
    const po = await this.getById(poId);
    const file = await poRepository.deleteFile(fileId);

    if (file) {
      const fullPath = path.join(__dirname, '../..', file.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    return file;
  }
}

module.exports = new POService();
