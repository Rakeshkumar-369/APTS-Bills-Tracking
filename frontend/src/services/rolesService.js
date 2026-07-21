// src/services/rolesService.js
import api from './apiClient';

export const rolesService = {
  async list() {
    const response = await api.get('/roles');
    return response || [];
  },
  
  async get(id) {
    const response = await api.get(`/roles/${id}`);
    return response || null;
  },
  
  async create({ role_name, role_rank, permissions, description }) {
    return api.post('/roles', { role_name, role_rank, permissions, description });
  },
  
  async update(id, payload) {
    return api.put(`/roles/${id}`, payload);
  },
  
  async remove(id) {
    return api.delete(`/roles/${id}`);
  },
};

export default rolesService;