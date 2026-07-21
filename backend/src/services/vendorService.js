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
