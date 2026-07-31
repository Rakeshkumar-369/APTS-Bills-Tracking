// src/services/claimsService.js
import apiClient from './apiClient';
import buildQuery from './queryString';

const BASE = '/claims';

export const claimsService = {
  list: async (params = {}) => {
    const query = buildQuery(params);
    const response = await apiClient.get(`${BASE}${query}`);
    return response;
  },

  get: async (id, options = {}) => {
    const query = options.includeDetails ? '?include_details=true' : '';
    const response = await apiClient.get(`${BASE}/${id}${query}`);
    if (Array.isArray(response) && response.length === 1) {
      return response[0];
    }
    return response;
  },

  create: async (data, files = []) => {
    const formData = new FormData();
    formData.append('vendor_id', data.vendor_id);
    formData.append('project_id', data.project_id);
    formData.append('po_id', data.po_id);
    if (data.vendor_contact_user_id) {
      formData.append('vendor_contact_user_id', data.vendor_contact_user_id);
    }
    if (data.remarks) {
      formData.append('remarks', data.remarks);
    }
    files.forEach(file => formData.append('files', file));

    const response = await apiClient.postForm(BASE, formData);
    return response;
  },

  forward: async (claimId, remarks) => {
    const response = await apiClient.post(`${BASE}/${claimId}/forward`, { remarks });
    return response;
  },

  // NEW: APTS Manager final approval – marks claim COMPLETED in both manual and workflow modes.
  approve: async (claimId, remarks) => {
    const response = await apiClient.post(`${BASE}/${claimId}/approve`, { remarks });
    return response;
  },

  // Manual-mode completion (alternative to approve – kept for backward compatibility, but not used in new flow)
  complete: async (claimId, remarks) => {
    const response = await apiClient.post(`${BASE}/${claimId}/complete`, { remarks });
    return response;
  },

  sendback: async (claimId, remarks) => {
    const response = await apiClient.post(`${BASE}/${claimId}/sendback`, { remarks });
    return response;
  },

  resubmit: async (claimId, remarks) => {
    const response = await apiClient.post(`${BASE}/${claimId}/resubmit`, { remarks });
    return response;
  },

  assign: async (claimId, targetUserId, remarks) => {
    const response = await apiClient.post(`${BASE}/${claimId}/assign`, {
      target_user_id: targetUserId,
      remarks,
    });
    return response;
  },

  pullBack: async (claimId, remarks) => {
    const response = await apiClient.post(`${BASE}/${claimId}/pull-back`, { remarks });
    return response;
  },

  uploadFile: async (claimId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.postForm(`${BASE}/${claimId}/files`, formData);
    return response;
  },

  deleteFile: async (claimId, fileId) => {
    const response = await apiClient.delete(`${BASE}/${claimId}/files/${fileId}`);
    return response;
  },

  downloadFile: async (claimId, fileId, filename = 'file') => {
    const response = await apiClient.get(`${BASE}/${claimId}/files/${fileId}/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([response], { type: response.headers['content-type'] });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  getHistory: async (claimId) => {
    const response = await apiClient.get(`${BASE}/${claimId}/history`);
    return response;
  },
};

export default claimsService;