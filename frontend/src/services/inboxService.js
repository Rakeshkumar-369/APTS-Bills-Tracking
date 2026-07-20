// src/services/inboxService.js
import api from './apiClient';

export const inboxService = {
  async list() {
    const response = await api.get('/inbox');
    return response || [];
  },
  
  async outbox() {
    const response = await api.get('/inbox/outbox');
    return response || [];
  },
  
  async stats() {
    const response = await api.get('/inbox/stats');
    return response || { total: 0, pending: 0, returned: 0 };
  },
};

export default inboxService;