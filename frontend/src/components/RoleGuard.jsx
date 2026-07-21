// src/components/RoleGuard.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleGuard({ 
  allowedRoles = [], 
  allowedRanks = [],
  redirectTo = '/'
}) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Check localStorage as fallback
  const storedUser = localStorage.getItem('user');
  const userData = user || (storedUser ? JSON.parse(storedUser) : null);

  if (!isAuthenticated && !userData) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has allowed role name
  const hasAllowedRole = allowedRoles.length === 0 || 
    allowedRoles.some(role => 
      userData?.role_name?.toLowerCase() === role.toLowerCase() ||
      userData?.role?.toLowerCase() === role.toLowerCase()
    );

  // Check if user has allowed rank
  const hasAllowedRank = allowedRanks.length === 0 || 
    allowedRanks.includes(userData?.role_rank);

  if (!hasAllowedRole && !hasAllowedRank) {
    console.log('🔒 User not authorized, redirecting to:', redirectTo);
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}