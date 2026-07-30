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

  async getVendorIds(poId) {
    return poRepository.getVendorIds(poId);
  }

  async create(data, files, performedBy, ipAddress) {
    const { project_id, vendor_ids, description, amount } = data;

    // Parse vendor_ids — could be a single value, array, or comma-separated string
    let vendorIdList = [];
    if (vendor_ids !== undefined && vendor_ids !== null && vendor_ids !== '') {
      if (Array.isArray(vendor_ids)) {
        vendorIdList = vendor_ids.map(Number);
      } else if (typeof vendor_ids === 'string') {
        vendorIdList = vendor_ids.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
      } else {
        vendorIdList = [Number(vendor_ids)];
      }
    }

    if (vendorIdList.length === 0) {
      throw new ApiError(400, 'At least one vendor must be assigned to the Purchase Order');
    }

    // Validate project exists
    const project = await projectRepository.getById(project_id);
    if (!project) throw new ApiError(400, 'Project not found');

    // Validate all vendors exist
    for (const vId of vendorIdList) {
      const vendor = await vendorRepository.getById(vId);
      if (!vendor) throw new ApiError(400, `Vendor with ID ${vId} not found`);
    }

    // Generate PO number
    const poNumber = await this.generatePONumber();

    const poId = await poRepository.create({
      po_number: poNumber,
      project_id,
      description: description || null,
      amount: amount || null,
      created_by: performedBy
    });

    // Assign all vendors to the PO (bulk sync)
    await poRepository.syncVendors(poId, vendorIdList);

    await auditService.log({
      table_name: 'purchase_orders',
      record_id: poId,
      action: 'CREATE',
      new_value: { po_number: poNumber, project_id, vendor_ids: vendorIdList, amount },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    if (files && files.length > 0) {
      const uploadDir = path.join(UPLOADS_DIR, String(poId));
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of files) {
        const ext = path.extname(file.originalname);
        const storedName = `${crypto.randomUUID()}${ext}`;
        const filePath = path.join(uploadDir, storedName);

        fs.writeFileSync(filePath, file.buffer);

        await poRepository.createFile({
          po_id: poId,
          original_name: file.originalname,
          stored_name: storedName,
          file_path: path.join('uploads/purchase-orders', String(poId), storedName),
          file_size: file.size,
          mime_type: file.mimetype || 'application/octet-stream',
          uploaded_by: performedBy
        });
      }
    }
    
    return this.getWithFiles(poId);
  }

  async update(id, data, performedBy, ipAddress) {
    const existing = await this.getById(id);

    // Handle vendor_ids sync if provided
    if (data.vendor_ids !== undefined) {
      let vendorIdList = [];
      if (Array.isArray(data.vendor_ids)) {
        vendorIdList = data.vendor_ids.map(Number);
      } else if (typeof data.vendor_ids === 'string' && data.vendor_ids !== '') {
        vendorIdList = data.vendor_ids.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
      }

      if (vendorIdList.length === 0) {
        throw new ApiError(400, 'At least one vendor must be assigned to the Purchase Order');
      }

      // Validate all vendors exist
      for (const vId of vendorIdList) {
        const vendor = await vendorRepository.getById(vId);
        if (!vendor) throw new ApiError(400, `Vendor with ID ${vId} not found`);
      }

      // Sync the junction table
      await poRepository.syncVendors(id, vendorIdList);
    }

    // If project changes, validate
    if (data.project_id) {
      const project = await projectRepository.getById(data.project_id);
      if (!project) throw new ApiError(400, 'Project not found');
    }

    await poRepository.update(id, {
      project_id: data.project_id,
      description: data.description,
      amount: data.amount,
      status: data.status,
      is_active: data.is_active
    });

    await auditService.log({
      table_name: 'purchase_orders',
      record_id: id,
      action: 'UPDATE',
      old_value: { po_number: existing.po_number, project_id: existing.project_id, status: existing.status },
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
    return poRepository.deleteFile(fileId);
  }
}

module.exports = new POService();
