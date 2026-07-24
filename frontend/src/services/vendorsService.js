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
};

export default vendorsService;