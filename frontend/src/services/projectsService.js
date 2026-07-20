// src/services/projectsService.js
import api from './apiClient';

export const projectsService = {
  async list() {
    const response = await api.get('/projects');
    return response || [];
  },
  
  async get(id) {
    const response = await api.get(`/projects/${id}`);
    return response || null;
  },
  
  async create({ project_name, project_code, description }) {
    return api.post('/projects', { project_name, project_code, description });
  },
  
  async update(id, payload) {
    return api.put(`/projects/${id}`, payload);
  },
  
  async remove(id) {
    return api.delete(`/projects/${id}`);
  },
};

export default projectsService;