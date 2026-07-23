// src/services/usersService.js
import api from './apiClient';
import { toQueryString } from './queryString';

export const usersService = {
  async list({ search, role_id, is_active, vendor_id, limit, offset } = {}) {
    const response = await api.get(`/users${toQueryString({ search, role_id, is_active, vendor_id, limit, offset })}`);
    // Response is already extracted
    return response || [];
  },
  
  async roles() {
    const response = await api.get('/users/roles');
    return response || [];
  },
  
  async get(id) {
    const response = await api.get(`/users/${id}`);
    return response || null;
  },
  
  async create({ name, email, password, role_id, vendor_id, designation, phone }) {
    return api.post('/users', { name, email, password, role_id, vendor_id: vendor_id || null, designation, phone });
  },
  
  async update(id, { name, role_id, vendor_id, is_active, has_digital_signature, phone }) {
    return api.put(`/users/${id}`, { name, role_id, vendor_id: vendor_id || null, is_active, has_digital_signature, phone });
  },
  
  async remove(id) {
    return api.delete(`/users/${id}`);
  },
};

export default usersService;