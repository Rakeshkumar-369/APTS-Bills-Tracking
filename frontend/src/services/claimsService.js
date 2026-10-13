// src/services/claimsService.js
import apiClient, { saveBlob } from './apiClient';
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

  create: async (data, files = [], certificationFiles = []) => {
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
    ['claimed_amount', 'invoice_number', 'invoice_date'].forEach((key) => {
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') formData.append(key, data[key]);
    });
    files.forEach(file => formData.append('files', file));
    certificationFiles.forEach(file => formData.append('certification_files', file));

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

  uploadFile: async (claimId, file, documentType = 'INVOICE') => {
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);
    const response = await apiClient.postForm(`${BASE}/${claimId}/files`, formData);
    return response;
  },

  deleteFile: async (claimId, fileId) => {
    const response = await apiClient.delete(`${BASE}/${claimId}/files/${fileId}`);
    return response;
  },

  downloadFile: async (claimId, fileId, filename = 'file') => {
    const { blob, filename: serverName } = await apiClient.blob(`${BASE}/${claimId}/files/${fileId}/download`);
    saveBlob(blob, serverName || filename);
  },

  getHistory: async (claimId) => {
    const response = await apiClient.get(`${BASE}/${claimId}/history`);
    return response;
  },
};

export default claimsService;