const projectRepository = require('../repositories/projectRepository');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');

class ProjectService {
  async getAll(params) {
    return projectRepository.getAll(params);
  }

  async getById(id) {
    const project = await projectRepository.getById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    return project;
  }

  async create(data, performedBy, ipAddress) {
    const id = await projectRepository.create(data);

    await auditService.log({
      table_name: 'projects',
      record_id: id,
      action: 'CREATE',
      new_value: data,
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return projectRepository.getById(id);
  }

  async update(id, data, performedBy, ipAddress) {
    const existing = await this.getById(id);

    await projectRepository.update(id, data);

    await auditService.log({
      table_name: 'projects',
      record_id: id,
      action: 'UPDATE',
      old_value: { project_name: existing.project_name },
      new_value: data,
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return projectRepository.getById(id);
  }

  async delete(id, performedBy, ipAddress) {
    const existing = await this.getById(id);

    await projectRepository.delete(id);

    await auditService.log({
      table_name: 'projects',
      record_id: id,
      action: 'DELETE',
      old_value: { project_name: existing.project_name },
      performed_by: performedBy,
      ip_address: ipAddress
    });
  }
}

module.exports = new ProjectService();
