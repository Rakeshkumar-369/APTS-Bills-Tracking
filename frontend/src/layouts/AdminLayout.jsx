// src/layouts/AdminLayout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  console.log('🏗️ AdminLayout rendered with user:', user?.email);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('🔒 AdminLayout: No user, redirecting to /login');
      navigate('/login', { replace: true });
      return;
    }
    if (user.role_rank !== 100) {
      console.log('🔒 AdminLayout: Not admin, redirecting to /');
      navigate('/', { replace: true });
    }
  }, [user, isAuthenticated, navigate]);

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

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: 'bi-grid' },
    { path: '/admin/users', label: 'Users', icon: 'bi-people' },
    { path: '/admin/vendors', label: 'Vendors', icon: 'bi-building' },
    { path: '/admin/projects', label: 'Projects', icon: 'bi-folder' },
    { path: '/admin/roles', label: 'Roles', icon: 'bi-shield-lock' },
    { path: '/admin/workflows', label: 'Workflows', icon: 'bi-diagram-3' },
    { path: '/admin/packages/create', label: 'Create Package', icon: 'bi-plus-circle' },
  ];

  const isActive = (path) => {
    if (path === '/admin' && location.pathname === '/admin') return true;
    if (path !== '/admin' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="d-flex flex-column vh-100 bg-light" style={{ overflow: 'hidden' }}>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary" style={{ zIndex: 1050, flexShrink: 0 }}>
        <div className="container-fluid">
          <button 
            className="btn btn-outline-light me-2" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <i className="bi bi-list"></i>
          </button>
          <span className="navbar-brand">
            <i className="bi bi-building-gear me-2"></i>
            APTS Admin Panel
          </span>
          <div className="navbar-nav ms-auto">
            <span className="navbar-text text-white me-3">
              <i className="bi bi-person-circle me-1"></i>
              {user?.name || 'Admin'}
            </span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <i className="bi bi-box-arrow-right me-1"></i>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="d-flex flex-grow-1" style={{ overflow: 'hidden' }}>
        {/* Sidebar */}
        <div 
          className={`bg-dark text-white ${sidebarOpen ? 'd-block' : 'd-none'} d-md-block`}
          style={{ width: '250px', minHeight: '100%', overflowY: 'auto', flexShrink: 0 }}
        >
          <div className="p-3">
            <h6 className="text-uppercase text-secondary small">Main Menu</h6>
            <ul className="nav flex-column">
              {menuItems.map((item) => (
                <li key={item.path} className="nav-item">
                  <button
                    className={`nav-link text-white ${isActive(item.path) ? 'active bg-primary' : ''}`}
                    onClick={() => navigate(item.path)}
                    style={{
                      borderRadius: '5px',
                      marginBottom: '2px',
                      textAlign: 'left',
                      width: '100%',
                      border: 'none',
                      background: isActive(item.path) ? '#0d6efd' : 'transparent',
                    }}
                  >
                    <i className={`bi ${item.icon} me-2`}></i>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-grow-1 overflow-auto p-3">
          <Outlet />
        </main>
      </div>
    </div>
  );
}