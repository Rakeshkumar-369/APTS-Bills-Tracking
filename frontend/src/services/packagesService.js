import apiClient from './apiClient';
import buildQuery from './queryString';

const BASE = '/packages';

export const packagesService = {
  list: async (params = {}) => {
    const query = buildQuery(params);
    const response = await apiClient.get(`${BASE}?${query}`);
    return response.data;
  },

  get: async (id, options = {}) => {
    const query = options.includeDetails ? '?include_details=true' : '';
    const response = await apiClient.get(`${BASE}/${id}${query}`);
    return response.data;
  },

  /**
   * Create a new claim (package)
   * @param {Object} data - { vendor_id, vendor_contact_user_id?, project_id, po_id, remarks? }
   * @param {Array<File>} files - Array of File objects (optional)
   */
  create: async (data, files = []) => {
    const formData = new FormData();
    formData.append('vendor_id', data.vendor_id);
    formData.append('project_id', data.project_id);
    formData.append('po_id', data.po_id);                     // <-- required by backend
    if (data.vendor_contact_user_id) {
      formData.append('vendor_contact_user_id', data.vendor_contact_user_id);
    }
    if (data.remarks) {
      formData.append('remarks', data.remarks);
    }
    // The backend expects files as the field name
    files.forEach(file => formData.append('files', file));

    // Use apiClient.postForm which sends raw FormData (no JSON‑stringify)
    const response = await apiClient.postForm(BASE, formData);
    return response.data;
  },

  forward: async (packageId, remarks) => {
    const response = await apiClient.post(`${BASE}/${packageId}/forward`, { remarks });
    return response.data;
  },

  sendback: async (packageId, remarks) => {
    const response = await apiClient.post(`${BASE}/${packageId}/sendback`, { remarks });
    return response.data;
  },

  resubmit: async (packageId, remarks) => {
    const response = await apiClient.post(`${BASE}/${packageId}/resubmit`, { remarks });
    return response.data;
  },

  assign: async (packageId, targetUserId, remarks) => {
    const response = await apiClient.post(`${BASE}/${packageId}/assign`, {
      target_user_id: targetUserId,
      remarks,
    });
    return response.data;
  },

  pullBack: async (packageId, remarks) => {
    const response = await apiClient.post(`${BASE}/${packageId}/pull-back`, { remarks });
    return response.data;
  },

  uploadFile: async (packageId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.postForm(`${BASE}/${packageId}/files`, formData);
    return response.data;
  },

  deleteFile: async (packageId, fileId) => {
    const response = await apiClient.delete(`${BASE}/${packageId}/files/${fileId}`);
    return response.data;
  },

  downloadFile: async (packageId, fileId, filename = 'file') => {
    const response = await apiClient.get(`${BASE}/${packageId}/files/${fileId}/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  getHistory: async (packageId) => {
    const response = await apiClient.get(`${BASE}/${packageId}/history`);
    return response.data;
  },
};

export default packagesService;