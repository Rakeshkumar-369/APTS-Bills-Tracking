import api, { getAccessToken } from './apiClient';
import buildQuery from './queryString';

const BASE = '/purchase-orders';

// Configuration for how to send different field types
const FIELD_CONFIG = {
  // Fields that should always be sent as single values
  scalar: ['project_id', 'description', 'amount', 'status', 'po_number'],
  
  // Fields that should be sent as arrays
  array: ['vendor_ids', 'tag_ids', 'category_ids'],
  
  // Fields that should be comma-separated
  commaSeparated: ['vendor_ids'],
  
  // Fields that should be JSON stringified
  jsonStringified: [],
};

// ---------- helpers ----------

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
  list: async (params = {}) => {
    const query = buildQuery(params);
    const res = await customFetch(`${BASE}${query}`);
    const body = await res.json();
    return {
      data: body.data || [],
      meta: body.meta || { total: 0 },
    };
  },

  get: async (id, options = {}) => {
    const query = options.includeFiles ? '?include_files=true' : '';
    return await api.get(`${BASE}/${id}${query}`);
  },

  /**
   * Create a new PO – Fully dynamic with configuration
   */
  create: async (data, files = []) => {
    const formData = new FormData();
    
    // Process each field in the data object
    Object.keys(data).forEach(key => {
      const value = data[key];
      
      // Skip null, undefined, empty strings (except for specific fields)
      if (value === undefined || value === null) return;
      if (value === '' && !['description'].includes(key)) return;
      
      // Handle based on field configuration
      if (FIELD_CONFIG.commaSeparated.includes(key) && Array.isArray(value)) {
        // Send as comma-separated string
        if (value.length > 0) {
          formData.append(key, value.join(','));
        }
      } 
      else if (FIELD_CONFIG.jsonStringified.includes(key)) {
        // Send as JSON string
        formData.append(key, JSON.stringify(value));
      }
      else if (FIELD_CONFIG.array.includes(key) && Array.isArray(value)) {
        // Send each array item individually
        if (value.length > 0) {
          value.forEach((item, index) => {
            formData.append(`${key}[]`, item);
          });
        }
      }
      else if (FIELD_CONFIG.scalar.includes(key) || typeof value !== 'object') {
        // Send as simple scalar value
        formData.append(key, value);
      }
      else if (Array.isArray(value) && !FIELD_CONFIG.commaSeparated.includes(key)) {
        // Default array handling - send each item
        value.forEach((item, index) => {
          formData.append(`${key}[${index}]`, item);
        });
      }
      else if (typeof value === 'object') {
        // Send objects as JSON
        formData.append(key, JSON.stringify(value));
      }
    });

    // Append files
    if (files && files.length > 0) {
      files.forEach(file => formData.append('files', file));
    }

    // Debug logging
    console.log('📤 Dynamic Form Data being sent:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    return await api.postForm(BASE, formData);
  },

  update: async (id, data) => {
    return await api.put(`${BASE}/${id}`, data);
  },

  delete: async (id) => {
    return await api.delete(`${BASE}/${id}`);
  },

  uploadFile: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return await api.postForm(`${BASE}/${id}/files`, formData);
  },

  deleteFile: async (poId, fileId) => {
    return await api.delete(`${BASE}/${poId}/files/${fileId}`);
  },

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