// src/services/packagesService.js
import api from './apiClient';
import { toQueryString } from './queryString';

export const packagesService = {
  async list({ status, vendor_id, project_id, search, limit, offset } = {}) {
    try {
      console.log('📦 packagesService.list called with:', { status, vendor_id, project_id, search, limit, offset });
      const response = await api.get(`/packages${toQueryString({ status, vendor_id, project_id, search, limit, offset })}`);
      console.log('📦 packagesService.list response:', response);
      return response || [];
    } catch (error) {
      console.error('❌ packagesService.list error:', error);
      return [];
    }
  },

  async get(id, { includeDetails = true } = {}) {
    try {
      const response = await api.get(`/packages/${id}${toQueryString({ include_details: includeDetails })}`);
      const pkg = Array.isArray(response) ? response[0] : response;
      return pkg || null;
    } catch (error) {
      console.error('❌ packagesService.get error:', error);
      return null;
    }
  },

  async create(data, files = []) {
    console.log('📦 packagesService.create called with:', data, 'Files:', files.length);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No access token found');
      }

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      
      const formData = new FormData();
      
      formData.append('vendor_id', parseInt(data.vendor_id));
      formData.append('project_id', parseInt(data.project_id));
      formData.append('remarks', data.remarks || '');
      
      if (data.vendor_contact_user_id) {
        formData.append('vendor_contact_user_id', parseInt(data.vendor_contact_user_id));
      }
      
      if (files && files.length > 0) {
        for (const file of files) {
          formData.append('files', file);
        }
      }
      
      console.log('📤 Sending package creation with FormData');
      console.log('📤 Form fields:', { 
        vendor_id: data.vendor_id, 
        project_id: data.project_id, 
        remarks: data.remarks,
        vendor_contact_user_id: data.vendor_contact_user_id
      });
      console.log('📤 Files count:', files.length);

      const response = await fetch(`${baseUrl}/packages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create package');
      }

      const result = await response.json();
      console.log('✅ Package created:', result);
      return result?.data?.[0] || result?.data || result;
      
    } catch (error) {
      console.error('❌ packagesService.create error:', error);
      throw error;
    }
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
    try {
      const response = await api.get(`/packages/${id}/history`);
      return response || [];
    } catch (error) {
      console.error('❌ packagesService.history error:', error);
      return [];
    }
  },

  async uploadFile(packageId, file) {
    try {
      console.log('📤 Uploading file:', {
        packageId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('accessToken');
      console.log('🔑 Token available:', !!token);

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
      return result?.data || result;
      
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

  fileViewUrl(packageId, fileId) {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    // Using the download endpoint with view=true parameter
    return `${base}/packages/${packageId}/files/${fileId}/download?view=true`;
  },

  async downloadFile(packageId, fileId, filename) {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No access token found');
      }

      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const url = `${base}/packages/${packageId}/files/${fileId}/download`;
      
      console.log('📥 Downloading file from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Download failed:', errorText);
        throw new Error(`Download failed: ${response.status} - ${errorText}`);
      }
      
      let downloadFilename = filename || 'download';
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1];
        }
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      console.log('✅ Download completed:', downloadFilename);
      return true;
      
    } catch (error) {
      console.error('❌ Download error:', error);
      throw error;
    }
  },

  async viewFile(packageId, fileId) {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No access token found');
      }

      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      // Using the download endpoint with view=true parameter
      const url = `${base}/packages/${packageId}/files/${fileId}/download?view=true`;
      
      console.log('👁️ Viewing file from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ View failed:', errorText);
        throw new Error(`View failed: ${response.status} - ${errorText}`);
      }
      
      const blob = await response.blob();
      const contentType = response.headers.get('Content-Type') || 'application/pdf';
      const viewUrl = window.URL.createObjectURL(blob);
      
      return {
        blob,
        viewUrl,
        contentType
      };
      
    } catch (error) {
      console.error('❌ View error:', error);
      throw error;
    }
  }
};

export default packagesService;