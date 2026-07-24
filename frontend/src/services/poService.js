import api, { getAccessToken } from './apiClient';
import buildQuery from './queryString';

const BASE = '/purchase-orders';

// ---------- helpers ----------

/** Build a fetch URL from the BASE_URL + path and add auth header. */
async function customFetch(path, options = {}) {
  const token = getAccessToken();
  const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}${path}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const res = await fetch(url, {
    credentials: 'include',
    headers,
    ...options,
  });

  if (!res.ok) {
    let msg = `Request failed with status ${res.status}`;
    try {
      const errBody = await res.json();
      msg = errBody.message || msg;
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  return res;
}

// ---------- service ----------

export const poService = {
  /**
   * List POs – returns { data: [...], meta: {...} }
   * Needs the full response wrapper, so we use a custom fetch.
   */
  list: async (params = {}) => {
    const query = buildQuery(params);
    const res = await customFetch(`${BASE}?${query}`);
    const body = await res.json();           // { success, data, meta }
    return {
      data: body.data || [],
      meta: body.meta || { total: 0 },
    };
  },

  /**
   * Get a single PO – returns the PO object (or null).
   */
  get: async (id, options = {}) => {
    const query = options.includeFiles ? '?include_files=true' : '';
    // api.get already extracts the `data` field, which is the PO itself
    return await api.get(`${BASE}/${id}${query}`);
  },

  /**
   * Create a new PO – always multipart/form-data.
   * Uses api.postForm so the body isn't stringified.
   */
  create: async (data, files = []) => {
    const formData = new FormData();
    formData.append('project_id', data.project_id);
    formData.append('vendor_id', data.vendor_id);
    if (data.description) formData.append('description', data.description);
    if (data.amount) formData.append('amount', data.amount);
    files.forEach(file => formData.append('files', file));

    // api.postForm will return the extracted data (the created PO)
    return await api.postForm(BASE, formData);
  },

  /**
   * Update a PO – JSON.
   */
  update: async (id, data) => {
    return await api.put(`${BASE}/${id}`, data);
  },

  /**
   * Soft-delete a PO.
   */
  delete: async (id) => {
    return await api.delete(`${BASE}/${id}`);
  },

  /**
   * Upload file to existing PO – multipart.
   */
  uploadFile: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return await api.postForm(`${BASE}/${id}/files`, formData);
  },

  /**
   * Delete a file from a PO.
   */
  deleteFile: async (poId, fileId) => {
    return await api.delete(`${BASE}/${poId}/files/${fileId}`);
  },

  /**
   * Download a PO file – triggers browser download.
   */
  downloadFile: async (poId, fileId, filename = 'file') => {
    const res = await customFetch(`${BASE}/${poId}/files/${fileId}/download`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export default poService;