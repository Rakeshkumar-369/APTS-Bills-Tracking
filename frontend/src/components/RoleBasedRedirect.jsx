// src/components/RoleBasedRedirect.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageLoader from './PageLoader';

// eslint-disable-next-line react-refresh/only-export-components
export function homePathFor(user) {
  const rank = user?.role_rank;
  if (rank === 100 || rank === 80) return '/admin';   // Super Admin / Admin (PO manager)
  if (rank === 10) return '/vendor';
  if (rank === 60) return '/manager';
  if (rank >= 30 && rank <= 50) return '/officer';
  return '/login';
}

export default function RoleBasedRedirect() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return <PageLoader fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(user)} replace />;
}
