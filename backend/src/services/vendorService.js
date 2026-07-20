const vendorRepository = require('../repositories/vendorRepository');
const userRepository = require('../repositories/userRepository');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');

class VendorService {
  async getAll(params) {
    return vendorRepository.getAll(params);
  }

  async getById(id) {
    const vendor = await vendorRepository.getById(id);
    if (!vendor) throw new ApiError(404, 'Vendor not found');
    return vendor;
  }

  async getWithUsers(id) {
    const vendor = await this.getById(id);
    vendor.users = await userRepository.findVendorUsers(id);
    return vendor;
  }

  async create(data, performedBy, ipAddress) {
    const id = await vendorRepository.create(data);

    await auditService.log({
      table_name: 'vendors',
      record_id: id,
      action: 'CREATE',
      new_value: data,
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return vendorRepository.getById(id);
  }

  async update(id, data, performedBy, ipAddress) {
    const existing = await this.getById(id);

    await vendorRepository.update(id, data);

    await auditService.log({
      table_name: 'vendors',
      record_id: id,
      action: 'UPDATE',
      old_value: { vendor_name: existing.vendor_name },
      new_value: data,
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return vendorRepository.getById(id);
  }

  async delete(id, performedBy, ipAddress) {
    const existing = await this.getById(id);

    await vendorRepository.delete(id);

    await auditService.log({
      table_name: 'vendors',
      record_id: id,
      action: 'DELETE',
      old_value: { vendor_name: existing.vendor_name },
      performed_by: performedBy,
      ip_address: ipAddress
    });
  }
}

module.exports = new VendorService();
