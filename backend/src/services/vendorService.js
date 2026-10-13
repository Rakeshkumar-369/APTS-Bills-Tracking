const vendorRepository = require('../repositories/vendorRepository');
const projectRepository = require('../repositories/projectRepository');
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

  async getWithProjects(id) {
    const vendor = await this.getById(id);
    vendor.projects = await projectRepository.getProjectsByVendor(id);
    return vendor;
  }

  // Build a code prefix from the vendor name:
  //  - multi-word names -> initials (up to 4 words), e.g. "Acme Power Systems" -> APS
  //  - single-word names -> first 3 letters/digits, e.g. "Siemens" -> SIE
  buildCodePrefix(name = '') {
    const words = String(name).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    if (words.length === 0) return 'VND';
    if (words.length === 1) return words[0].slice(0, 3);
    return words.slice(0, 4).map(w => w[0]).join('');
  }

  // Unique code = prefix + 3-digit running number, e.g. APS001, APS002 ...
  async generateCode(name) {
    const prefix = this.buildCodePrefix(name);
    const existing = await vendorRepository.findCodesByPrefix(prefix);
    const pattern = new RegExp(`^${prefix}(\\d+)$`);
    let max = 0;
    existing.forEach(code => {
      const m = pattern.exec(code || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  }

  async create(data, performedBy, ipAddress) {
    // Safety net: auto-generate the code if none was supplied
    if (!data.vendor_code) {
      data = { ...data, vendor_code: await this.generateCode(data.vendor_name) };
    }
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

  // ── Vendor-Project Assignment ──

  async getProjects(vendorId) {
    const vendor = await this.getById(vendorId);
    return projectRepository.getProjectsByVendor(vendor.id);
  }

  async assignProject(vendorId, projectId, performedBy, ipAddress) {
    const vendor = await this.getById(vendorId);
    const project = await projectRepository.getById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    await projectRepository.assignVendorProject(vendor.id, project.id);

    await auditService.log({
      table_name: 'vendor_projects',
      record_id: null,
      action: 'CREATE',
      new_value: { vendor_id: vendor.id, vendor_name: vendor.vendor_name, project_id: project.id, project_name: project.project_name },
      performed_by: performedBy,
      ip_address: ipAddress
    });
  }

  async removeProject(vendorId, projectId, performedBy, ipAddress) {
    const vendor = await this.getById(vendorId);
    const project = await projectRepository.getById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    await projectRepository.removeVendorProject(vendor.id, project.id);

    await auditService.log({
      table_name: 'vendor_projects',
      record_id: null,
      action: 'DELETE',
      old_value: { vendor_id: vendor.id, vendor_name: vendor.vendor_name, project_id: project.id, project_name: project.project_name },
      performed_by: performedBy,
      ip_address: ipAddress
    });
  }
}

module.exports = new VendorService();