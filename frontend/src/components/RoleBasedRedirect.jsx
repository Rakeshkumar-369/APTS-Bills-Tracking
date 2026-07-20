// src/components/RoleBasedRedirect.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleBasedRedirect() {
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔄 RoleBasedRedirect - User:', user?.email, 'Loading:', loading);
    
    if (!loading) {
      // Check localStorage as fallback
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      
      if (!isAuthenticated && !user && !(storedUser && token)) {
        console.log('🔀 No user, redirecting to /login');
        navigate('/login', { replace: true });
        return;
      }

      const userData = user || (storedUser ? JSON.parse(storedUser) : null);
      
      if (!userData) {
        navigate('/login', { replace: true });
        return;
      }

      const roleRank = userData.role_rank;
      console.log('🔀 Redirecting based on role_rank:', roleRank);
      
      let redirectPath = '/login';
      if (roleRank === 100) redirectPath = '/admin';
      else if (roleRank === 10) redirectPath = '/vendor';
      else if (roleRank === 60) redirectPath = '/manager';
      else if (roleRank >= 30 && roleRank <= 50) redirectPath = '/officer';
      
      console.log('🔀 Redirecting to:', redirectPath);
      navigate(redirectPath, { replace: true });
    }
  }, [user, loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return null;
}