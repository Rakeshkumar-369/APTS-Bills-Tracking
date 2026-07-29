import api from './apiClient';
import { toQueryString } from './queryString';

export const vendorsService = {
  async list({ search, is_active, limit, offset } = {}) {
    const response = await api.get(`/vendors${toQueryString({ search, is_active, limit, offset })}`);
    return response || [];
  },

  /**
   * Get a single vendor by ID.
   * @param {number} id
   * @param {Object} options – { includeUsers, includeProjects }
   * @returns {Object|null} The vendor object (not wrapped in array).
   */
  async get(id, { includeUsers = false, includeProjects = false } = {}) {
    const params = {};
    if (includeUsers) params.include_users = true;
    if (includeProjects) params.include_projects = true;
    const query = toQueryString(params);
    const response = await api.get(`/vendors/${id}${query}`);
    // The backend wraps the vendor in an array, so extract the first item.
    if (Array.isArray(response)) return response[0] || null;
    return response || null;
  },

  async create({ vendor_name, vendor_code, contact_person, email, phone, address }) {
    return api.post('/vendors', { vendor_name, vendor_code, contact_person, email, phone, address });
  },

  async update(id, payload) {
    return api.put(`/vendors/${id}`, payload);
  },

  async remove(id) {
    return api.delete(`/vendors/${id}`);
  },

  /**
   * Fetch all active vendors with their assigned projects.
   * Returns an array of vendor objects, each with a `projectIds` array.
   */
  async listWithProjects() {
    // 1. Get all active vendors
    const vendors = await this.list({ is_active: 1 });

    // 2. For each vendor, fetch its projects in parallel
    const vendorsWithProjects = await Promise.all(
      vendors.map(async (vendor) => {
        try {
          const detail = await this.get(vendor.id, { includeProjects: true });
          const projects = detail?.projects || [];
          return {
            ...vendor,
            projectIds: projects.map(p => p.id),
          };
        } catch (err) {
          // Fallback: no projects
          return { ...vendor, projectIds: [] };
        }
      })
    );
    return vendorsWithProjects;
  },

  // ---- Vendor <-> Project assignment ----

  /**
   * List all projects assigned to a vendor.
   * @param {number} id vendor id
   * @returns {Array} array of project objects
   */
  async getProjects(id) {
    const response = await api.get(`/vendors/${id}/projects`);
    return response || [];
  },

  /**
   * Assign a single project to a vendor.
   * @param {number} id vendor id
   * @param {number} projectId
   */
  async assignProject(id, projectId) {
    return api.post(`/vendors/${id}/projects`, { project_id: projectId });
  },

  /**
   * Remove a project assignment from a vendor.
   * @param {number} id vendor id
   * @param {number} projectId
   */
  async removeProject(id, projectId) {
    return api.delete(`/vendors/${id}/projects/${projectId}`);
  },

  /**
   * Sync a vendor's project assignments to match `desiredProjectIds`.
   * Diffs against `currentProjectIds` and issues only the necessary
   * assign/remove calls in parallel.
   * @param {number} id vendor id
   * @param {number[]} currentProjectIds projects currently assigned (before edit)
   * @param {number[]} desiredProjectIds projects that should be assigned (after edit)
   */
  async syncProjects(id, currentProjectIds = [], desiredProjectIds = []) {
    const current = new Set(currentProjectIds.map(Number));
    const desired = new Set(desiredProjectIds.map(Number));

    const toAdd = [...desired].filter(pid => !current.has(pid));
    const toRemove = [...current].filter(pid => !desired.has(pid));

    await Promise.all([
      ...toAdd.map(pid => this.assignProject(id, pid)),
      ...toRemove.map(pid => this.removeProject(id, pid)),
    ]);
  },
};

export default vendorsService;