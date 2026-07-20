// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services';
import { setAccessToken, getAccessToken, setOnSessionExpired } from '../services/apiClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('🔍 AuthProvider mounted, checking for existing session...');
    
    setOnSessionExpired(() => {
      console.log('⏰ Session expired, logging out...');
      logout();
    });

    const checkAuth = () => {
      try {
        const token = getAccessToken();
        const storedUser = localStorage.getItem('user');
        
        console.log('🔍 Checking auth - token exists:', !!token);
        console.log('🔍 Checking auth - stored user exists:', !!storedUser);
        
        if (token && storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            console.log('👤 Found stored user data:', userData);
            setUser(userData);
          } catch (err) {
            console.error('❌ Error parsing stored user:', err);
            localStorage.removeItem('user');
            setAccessToken(null);
          }
        } else {
          // No valid session
          setAccessToken(null);
          localStorage.removeItem('user');
        }
      } catch (err) {
        console.error('❌ Auth check error:', err);
        setAccessToken(null);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔐 Attempting login for:', email);
      const userData = await authService.login(email, password);
      console.log('✅ Login successful, user data:', userData);
      
      if (!userData) {
        throw new Error('No user data received');
      }
      
      setUser(userData);
      console.log('👤 User set in context:', userData);
      
      return { success: true, user: userData };
    } catch (err) {
      console.error('❌ Login error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log('🚪 Logging out...');
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      console.log('✅ Logout complete, user data cleared');
    }
  };

  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;
    
    const parts = permission.split('.');
    if (parts.length === 2) {
      const [resource, action] = parts;
      return user.permissions[resource]?.[action] === true;
    }
    
    return user.permissions[permission] === true;
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    hasPermission,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;