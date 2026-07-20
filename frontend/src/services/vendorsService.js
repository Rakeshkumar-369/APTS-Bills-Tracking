// src/services/vendorsService.js
import api from './apiClient';
import { toQueryString } from './queryString';

export const vendorsService = {
  async list({ search, is_active, limit, offset } = {}) {
    const response = await api.get(`/vendors${toQueryString({ search, is_active, limit, offset })}`);
    return response || [];
  },
  
  async get(id, { includeUsers = false } = {}) {
    const response = await api.get(`/vendors/${id}${toQueryString({ include_users: includeUsers })}`);
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
};

export default vendorsService;