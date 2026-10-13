// src/components/RoleGuard.jsx
// UI-level routing only — every API endpoint enforces permissions server-side.
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageLoader from './PageLoader';

export default function RoleGuard({ allowedRoles = [], allowedRanks = [], redirectTo = '/' }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return <PageLoader fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const hasAllowedRole = allowedRoles.length === 0 ||
    allowedRoles.some((role) => user?.role_name?.toLowerCase() === role.toLowerCase());
  const hasAllowedRank = allowedRanks.length === 0 || allowedRanks.includes(user?.role_rank);

  if (!hasAllowedRole && !hasAllowedRank) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}
