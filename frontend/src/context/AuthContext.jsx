// src/context/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authService } from '../services';
import { setAccessToken, setOnSessionExpired } from '../services/apiClient';

const AuthContext = createContext(null);

// Lets other open tabs know the user logged out so they drop their session too
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('apts-auth') : null;

// Automatic sign-out after inactivity (configurable with VITE_IDLE_TIMEOUT_MINUTES)
const IDLE_TIMEOUT_MS = (Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 30) * 60 * 1000;
const ACTIVITY_KEY = 'apts.lastActivity'; // shared by all tabs; a timestamp, not a credential
const LOGOUT_REASON_KEY = 'apts.logoutReason';
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];

const safeStorage = {
  get: (store, k) => { try { return store.getItem(k); } catch { return null; } },
  set: (store, k, v) => { try { store.setItem(k, v); } catch { /* storage disabled */ } },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // boot-time session restore only
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const booted = useRef(false);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    setUser(null); // UI reacts immediately
    await authService.logout();
    channel?.postMessage('logout');
  }, []);

  useEffect(() => {
    setOnSessionExpired(clearSession);

    const onMessage = (e) => { if (e.data === 'logout') clearSession(); };
    channel?.addEventListener('message', onMessage);

    // StrictMode mounts effects twice in development; refresh tokens rotate, so
    // only restore the session once.
    if (!booted.current) {
      booted.current = true;
      authService.restoreSession()
        .then((restored) => setUser(restored))
        .catch(() => clearSession())
        .finally(() => setLoading(false));
    }

    return () => channel?.removeEventListener('message', onMessage);
  }, [clearSession]);

  // Idle timeout: any interaction in any tab counts as activity
  useEffect(() => {
    if (!user) return undefined;
    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      if (now - lastWrite > 15000) { // throttle storage writes
        lastWrite = now;
        safeStorage.set(localStorage, ACTIVITY_KEY, String(now));
      }
    };
    markActive();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    const timer = setInterval(() => {
      const last = Number(safeStorage.get(localStorage, ACTIVITY_KEY)) || Date.now();
      if (Date.now() - last > IDLE_TIMEOUT_MS) {
        safeStorage.set(sessionStorage, LOGOUT_REASON_KEY, 'idle');
        logout();
      }
    }, 30000);
    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive));
    };
  }, [user, logout]);

  const login = useCallback(async (email, password) => {
    setAuthActionLoading(true);
    setError(null);
    try {
      const userData = await authService.login(email, password);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setAuthActionLoading(false);
    }
  }, []);

  const hasPermission = useCallback((permission) => {
    if (!user?.permissions) return false;
    const [resource, action] = permission.split('.');
    return action ? user.permissions[resource]?.[action] === true : user.permissions[permission] === true;
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    authActionLoading,
    error,
    login,
    logout,
    hasPermission,
    isAuthenticated: !!user,
  }), [user, loading, authActionLoading, error, login, logout, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
