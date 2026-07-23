// src/services/workflowsService.js
import api from './apiClient';
import { toQueryString } from './queryString';

export const workflowsService = {
  // --- Workflow master ---
  async list({ includeDetails = false } = {}) {
    const response = await api.get(`/workflows${toQueryString({ include_details: includeDetails })}`);
    return response || [];
  },

  async get(id, { includeDetails = true } = {}) {
    const response = await api.get(`/workflows/${id}${toQueryString({ include_details: includeDetails })}`);
    return response || null;
  },

  async create({ workflow_name, description }) {
    return api.post('/workflows', { workflow_name, description });
  },

  async update(id, payload) {
    // Backend: PUT /workflows/:id
    return api.put(`/workflows/${id}`, payload);
  },

  // --- Steps ---
  async getSteps(workflowId) {
    // Backend: GET /workflows/:id/steps
    const response = await api.get(`/workflows/${workflowId}/steps`);
    return response || [];
  },

  async createStep(workflowId, { step_order, step_name, step_code, required_role_id }) {
    // Backend: POST /workflows/:id/steps
    return api.post(`/workflows/${workflowId}/steps`, {
      step_order,
      step_name,
      step_code,
      required_role_id,
    });
  },

  async updateStep(stepId, payload) {
    // Backend: PUT /workflow-steps/:id
    return api.put(`/workflows/workflow-steps/${stepId}`, payload);
  },

  async removeStep(stepId) {
    // Backend: DELETE /workflow-steps/:id
    return api.delete(`/workflows/workflow-steps/${stepId}`);
  },

  // --- Transitions ---
  async getTransitions(workflowId) {
    // Backend: GET /workflows/:id/transitions
    const response = await api.get(`/workflows/${workflowId}/transitions`);
    return response || [];
  },

  async createTransition(workflowId, { from_step_id, to_step_id, transition_type, allowed_role_id }) {
    // Backend: POST /workflows/:id/transitions
    return api.post(`/workflows/${workflowId}/transitions`, {
      from_step_id,
      to_step_id,
      transition_type,
      allowed_role_id,
    });
  },

  async removeTransition(transitionId) {
    // Backend: DELETE /transitions/:id
    return api.delete(`/workflows/transitions/${transitionId}`);
  },
};

export default workflowsService;