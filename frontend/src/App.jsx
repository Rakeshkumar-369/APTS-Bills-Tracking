// src/App.jsx
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRedirect from './components/RoleBasedRedirect';
import RoleGuard from './components/RoleGuard';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import VendorLayout from './layouts/VendorLayout';
import OfficerLayout from './layouts/OfficerLayout';
import ManagerLayout from './layouts/ManagerLayout';

// Admin Components
import AdminDashboard from './pages/ADMIN/AdminDashboard';
import UsersAdmin from './pages/ADMIN/UsersAdmin';
import VendorsAdmin from './pages/ADMIN/VendorsAdmin';
import ProjectsAdmin from './pages/ADMIN/ProjectsAdmin';
import RolesAdmin from './pages/ADMIN/RolesAdmin';
import WorkflowsAdmin from './pages/ADMIN/WorkflowsAdmin';
import WorkflowDetail from './pages/ADMIN/WorkflowDetail';

// Other Pages
import Login from './pages/Login';
import VendorDashboard from './pages/VendorDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import AptsManagerDashboard from './pages/AptsManagerDashboard';
import Inbox from './pages/Inbox';
import MyPackages from './pages/MyPackages';
import PackageDetail from './pages/PackageDetail';
import MatchInvoice from './pages/MatchInvoice';
import PackageCreate from './pages/PackageCreate';


// Loading Screen Component
function LoadingScreen() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="text-center">
        <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading APTS Portal...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading, isAuthenticated } = useAuth();

  // Debug logging
  useEffect(() => {
    console.log('🔍 App State:');
    console.log('  - User:', user);
    console.log('  - Loading:', loading);
    console.log('  - Is Authenticated:', isAuthenticated);
    console.log('  - Token in localStorage:', !!localStorage.getItem('accessToken'));
    console.log('  - User in localStorage:', !!localStorage.getItem('user'));
  }, [user, loading, isAuthenticated]);

  if (loading) {
    console.log('⏳ App is loading...');
    return <LoadingScreen />;
  }

  console.log('✅ App rendered with user:', user ? user.email : 'No user');

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RoleBasedRedirect />} />

      {/* ============ ADMIN ROUTES ============ */}
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<AdminDashboard />} />
  <Route path="users" element={<UsersAdmin />} />
  <Route path="vendors" element={<VendorsAdmin />} />
  <Route path="projects" element={<ProjectsAdmin />} />
  <Route path="roles" element={<RolesAdmin />} />
  <Route path="workflows" element={<WorkflowsAdmin />} />
  <Route path="workflows/:id" element={<WorkflowDetail />} />
  <Route path="packages/create" element={<PackageCreate />} />
  <Route path="*" element={<Navigate to="/admin" replace />} />
</Route>

      {/* ============ VENDOR ROUTES ============ */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard allowedRanks={[10]} redirectTo="/" />}>
          <Route path="/vendor" element={<VendorLayout />}>
            <Route index element={<VendorDashboard />} />
            <Route path="packages" element={<MyPackages />} />
            <Route path="packages/:id" element={<PackageDetail />} />
            <Route path="*" element={<Navigate to="/vendor" replace />} />
          </Route>
        </Route>
      </Route>

      {/* ============ OFFICER ROUTES ============ */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard allowedRanks={[30, 40, 50]} redirectTo="/" />}>
          <Route path="/officer" element={<OfficerLayout />}>
            <Route index element={<OfficerDashboard />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="packages/:id" element={<PackageDetail />} />
            <Route path="*" element={<Navigate to="/officer" replace />} />
          </Route>
        </Route>
      </Route>

      {/* ============ MANAGER ROUTES ============ */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard allowedRanks={[60]} redirectTo="/" />}>
          <Route path="/manager" element={<ManagerLayout />}>
            <Route index element={<AptsManagerDashboard />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="match" element={<MatchInvoice />} />
            <Route path="packages/:id" element={<PackageDetail />} />
            <Route path="*" element={<Navigate to="/manager" replace />} />
          </Route>
        </Route>
      </Route>

      {/* ============ FALLBACK ROUTE ============ */}
      <Route path="*" element={<RoleBasedRedirect />} />
    </Routes>
  );
}