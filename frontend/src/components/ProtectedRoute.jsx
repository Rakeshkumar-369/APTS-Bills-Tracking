// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
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
  const token = localStorage.getItem('accessToken');
  
  if (!isAuthenticated && !user && !(storedUser && token)) {
    console.log('🔒 Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}