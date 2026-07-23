// src/pages/ADMIN/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import UsersAdmin from './UsersAdmin';
import VendorsAdmin from './VendorsAdmin';
import ProjectsAdmin from './ProjectsAdmin';
import RolesAdmin from './RolesAdmin';
import WorkflowsAdmin from './WorkflowsAdmin';
import WorkflowDetail from './WorkflowDetail';
import { useAuth } from '../../context/AuthContext';
import { packagesService, usersService, vendorsService, projectsService } from '../../services';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({ users: 0, vendors: 0, projects: 0, packages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('📊 AdminDashboard rendered with user:', user);

  // Fetch stats when on dashboard
  useEffect(() => {
    console.log('📍 AdminDashboard location:', location.pathname);
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      fetchStats();
    }
  }, [location.pathname]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📊 Fetching stats...');
      
      // Fetch all data with error handling for each
      const [users, vendors, projects, packages] = await Promise.all([
        usersService.list().catch(() => []),
        vendorsService.list().catch(() => []),
        projectsService.list().catch(() => []),
        packagesService.list().catch(() => [])
      ]);
      
      setStats({
        users: users?.length || 0,
        vendors: vendors?.length || 0,
        projects: projects?.length || 0,
        packages: packages?.length || 0
      });
      console.log('📊 Stats loaded:', stats);
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  // Dashboard Overview Component
  const DashboardOverview = () => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading dashboard stats...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchStats}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>
            Retry
          </button>
        </div>
      );
    }

    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4>Dashboard Overview</h4>
          <span className="badge bg-primary">Welcome, {user?.name || 'Admin'}!</span>
        </div>

        <div className="row g-4">
          <div className="col-md-3">
            <div className="card bg-primary text-white shadow-sm">
              <div className="card-body">
                <h6 className="card-title">Total Users</h6>
                <h2 className="mb-0">{stats.users}</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-success text-white shadow-sm">
              <div className="card-body">
                <h6 className="card-title">Total Vendors</h6>
                <h2 className="mb-0">{stats.vendors}</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-info text-white shadow-sm">
              <div className="card-body">
                <h6 className="card-title">Total Projects</h6>
                <h2 className="mb-0">{stats.projects}</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-warning text-white shadow-sm">
              <div className="card-body">
                <h6 className="card-title">Total Packages</h6>
                <h2 className="mb-0">{stats.packages}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5>Quick Actions</h5>
              <div className="d-flex flex-wrap gap-2 mt-3">
                <button className="btn btn-primary" onClick={() => navigate('/admin/users')}>
                  <i className="bi bi-person-plus me-1"></i> Manage Users
                </button>
                <button className="btn btn-success" onClick={() => navigate('/admin/vendors')}>
                  <i className="bi bi-building-add me-1"></i> Manage Vendors
                </button>
                <button className="btn btn-info" onClick={() => navigate('/admin/projects')}>
                  <i className="bi bi-folder-plus me-1"></i> Manage Projects
                </button>
                <button className="btn btn-warning" onClick={() => navigate('/admin/roles')}>
                  <i className="bi bi-shield-plus me-1"></i> Manage Roles
                </button>
    
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // If no user, show loading
  if (!user) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // This renders only the content area (no sidebar)
  return (
    <div className="container-fluid px-4">
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="users" element={<UsersAdmin />} />
        <Route path="vendors" element={<VendorsAdmin />} />
        <Route path="projects" element={<ProjectsAdmin />} />
        <Route path="roles" element={<RolesAdmin />} />
        <Route path="workflows" element={<WorkflowsAdmin />} />
        <Route path="workflows/:id" element={<WorkflowDetail />} />
      </Routes>
    </div>
  );
}