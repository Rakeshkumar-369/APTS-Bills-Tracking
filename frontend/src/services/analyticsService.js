// src/services/analyticsService.js
import { api } from './apiClient';

const analyticsService = {
  // from / to: 'YYYY-MM-DD'; granularity: 'auto' | 'day' | 'week' | 'month'
  async getOverview({ from, to, granularity } = {}, options = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (granularity && granularity !== 'auto') params.set('granularity', granularity);
    const qs = params.toString();
    const res = await api.get(`/analytics/overview${qs ? `?${qs}` : ''}`, options);
    return Array.isArray(res) ? res[0] : res;
  },
};

export default analyticsService;