// src/services/authService.js
import api, { setAccessToken, getAccessToken } from './apiClient';

export const authService = {
  async login(email, password) {
    console.log('📡 Sending login request for:', email);
    
    try {
      const response = await api.post('/auth/login', { email, password }, { skipAuth: true });
      
      console.log('📥 Login response:', response);
      
      let userData = null;
      let accessToken = null;
      
      // Handle the response format from your API
      if (Array.isArray(response) && response.length > 0) {
        const entry = response[0];
        accessToken = entry?.accessToken;
        userData = entry?.user;
        console.log('📦 Format: Array with entry');
      } else if (response?.accessToken) {
        accessToken = response.accessToken;
        userData = response.user || response;
        console.log('📦 Format: Object with accessToken');
      } else if (response?.user?.accessToken) {
        accessToken = response.user.accessToken;
        userData = response.user;
        console.log('📦 Format: Nested user object');
      } else if (response?.data) {
        if (Array.isArray(response.data) && response.data.length > 0) {
          accessToken = response.data[0]?.accessToken;
          userData = response.data[0]?.user;
        } else if (response.data?.accessToken) {
          accessToken = response.data.accessToken;
          userData = response.data.user;
        }
        console.log('📦 Format: Data wrapper');
      }
      
      console.log('🔑 Extracted accessToken:', !!accessToken);
      console.log('👤 Extracted userData:', userData);
      
      if (!accessToken) {
        console.error('❌ No access token found in response:', response);
        throw new Error('Login response missing access token');
      }
      
      // Set the token
      setAccessToken(accessToken);
      
      // Store user data
      if (userData) {
        const normalizedUser = {
          id: userData.id,
          name: userData.name || userData.full_name || 'User',
          email: userData.email,
          role: userData.role_name || userData.role,
          role_name: userData.role_name || userData.role,
          role_rank: userData.role_rank || 0,
          role_id: userData.role_id,
          vendor_id: userData.vendor_id,
          permissions: userData.permissions || {},
          designation: userData.designation || '',
          phone: userData.phone || '',
          has_digital_signature: userData.has_digital_signature || false,
          is_active: userData.is_active !== undefined ? userData.is_active : true,
          last_login: userData.last_login || '',
          ...userData
        };
        
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        return normalizedUser;
      }
      
      return { email };
      
    } catch (error) {
      console.error('❌ Login service error:', error);
      throw error;
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout', undefined, { skipAuth: true });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      setAccessToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
    }
  },

  // Get user from localStorage (no API call)
  getCurrentUser() {
    try {
      const user = localStorage.getItem('user');
      if (user) {
        return JSON.parse(user);
      }
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  async changePassword(currentPassword, newPassword) {
    return api.post('/auth/change-password', { currentPassword, newPassword });
  },
  
  // Helper to check if user is logged in
  isAuthenticated() {
    return !!getAccessToken() && !!localStorage.getItem('user');
  },
  
  // Helper to get stored user
  getStoredUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }
};

export default authService;