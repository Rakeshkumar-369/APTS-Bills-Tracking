// src/services/authService.js
import api, { setAccessToken, getAccessToken, refreshSession } from './apiClient';

// "Last login" is only known at login time (it is the PREVIOUS login). Keep it in
// sessionStorage so it survives a page reload; it is not a credential.
const LAST_LOGIN_KEY = 'apts.lastLogin';

export function normalizeUser(userData) {
  if (!userData) return null;
  return {
    ...userData,
    name: userData.name || 'User',
    role: userData.role_name,
    role_rank: userData.role_rank || 0,
    vendor_id: userData.vendor_id || null,
    vendor_name: userData.vendor_name || null,
    permissions: userData.permissions || {},
    designation: userData.designation || '',
  };
}

function readLastLogin() {
  try { return sessionStorage.getItem(LAST_LOGIN_KEY) || null; } catch { return null; }
}

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password }, { skipAuth: true });
    const entry = Array.isArray(response) ? response[0] : response;
    if (!entry?.accessToken) throw new Error('Login response missing access token');

    setAccessToken(entry.accessToken);
    try { sessionStorage.setItem(LAST_LOGIN_KEY, entry.user?.last_login || ''); } catch { /* ignore */ }
    return normalizeUser(entry.user);
  },

  /** Restore a session after reload using the HttpOnly refresh cookie. */
  async restoreSession() {
    const { user } = await refreshSession();
    return normalizeUser({ ...user, last_login: readLastLogin() });
  },

  async logout() {
    // Send the current token so the server invalidates the whole session
    // (session_version bump), then forget it locally.
    const token = getAccessToken();
    try {
      await api.post('/auth/logout', undefined, {
        skipAuth: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Logout must always succeed locally
    } finally {
      setAccessToken(null);
      try { sessionStorage.removeItem(LAST_LOGIN_KEY); } catch { /* ignore */ }
    }
  },

  async changePassword(currentPassword, newPassword, confirmNewPassword) {
    return api.post('/auth/change-password', { currentPassword, newPassword, confirmNewPassword });
  },
};

export default authService;
