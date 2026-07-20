// src/services/packagesService.js
import api from './apiClient';
import { toQueryString } from './queryString';

export const packagesService = {
  async list({ status, vendor_id, project_id, search, limit, offset } = {}) {
    const response = await api.get(`/packages${toQueryString({ status, vendor_id, project_id, search, limit, offset })}`);
    return response || [];
  },

  async get(id, { includeDetails = true } = {}) {
    const response = await api.get(`/packages/${id}${toQueryString({ include_details: includeDetails })}`);
    return response || null;
  },

  async create({ vendor_id, vendor_contact_user_id, project_id, workflow_id, remarks }) {
    return api.post('/packages', { vendor_id, vendor_contact_user_id, project_id, workflow_id, remarks });
  },

  async forward(id, remarks) {
    return api.post(`/packages/${id}/forward`, { remarks });
  },

  async sendback(id, remarks) {
    return api.post(`/packages/${id}/sendback`, { remarks });
  },

  async resubmit(id, remarks) {
    return api.post(`/packages/${id}/resubmit`, { remarks });
  },

  async history(id) {
    const response = await api.get(`/packages/${id}/history`);
    return response || [];
  },

  // FIXED: File upload method
  async uploadFile(packageId, file) {
    try {
      console.log('📤 Uploading file:', {
        packageId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Get the access token
      const token = localStorage.getItem('accessToken');
      console.log('🔑 Token available:', !!token);

      // Make the API call using fetch directly (more control)
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const url = `${baseUrl}/packages/${packageId}/files`;
      
      console.log('🌐 Upload URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });

      console.log('📡 Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Upload successful:', result);
      
      // Return the extracted data
      return result?.data || result;
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      throw error;
    }
  },

  // Alternative upload method using apiClient
  async uploadFileWithApiClient(packageId, file) {
    try {
      console.log('📤 Uploading file with apiClient:', {
        packageId,
        fileName: file.name
      });

      const formData = new FormData();
      formData.append('file', file);

      // Use the apiClient postForm
      const result = await api.postForm(`/packages/${packageId}/files`, formData);
      console.log('✅ Upload successful:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      throw error;
    }
  },

  async deleteFile(packageId, fileId) {
    return api.delete(`/packages/${packageId}/files/${fileId}`);
  },

  fileDownloadUrl(packageId, fileId) {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    return `${base}/packages/${packageId}/files/${fileId}/download`;
  },

  async downloadFile(packageId, fileId, filename) {
    const token = localStorage.getItem('accessToken');
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const url = `${base}/packages/${packageId}/files/${fileId}/download`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Download failed');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};

export default packagesService;