// src/layouts/UnifiedLayout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';

export default function UnifiedLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Determine user role
  const userRole = user?.role_rank === 10 ? 'vendor' :
                    user?.role_rank === 30 ? 'pm' :
                    user?.role_rank === 40 ? 'tpa' :
                    user?.role_rank === 50 ? 'jdinfra' :
                    user?.role_rank === 60 ? 'apts' : 'unknown';

  // Get role display name
  const getRoleDisplay = () => {
    if (user?.role_rank === 10) return 'Vendor';
    if (user?.role_rank === 30) return 'Project Manager';
    if (user?.role_rank === 40) return 'TPA Auditor';
    if (user?.role_rank === 50) return 'JD-Infra';
    if (user?.role_rank === 60) return 'APTS Manager';
    return 'User';
  };

  // Get menu items based on role
  const getMenuItems = () => {
    const baseItems = [
      { path: `/${userRole}`, label: 'Dashboard', icon: 'bi-grid' },
    ];

    switch(userRole) {
      case 'vendor':
        return [
          ...baseItems,
          { path: '/vendor/packages', label: 'My Packages', icon: 'bi-boxes' },
          { path: '/vendor/packages/create', label: 'Create Package', icon: 'bi-plus-circle' },
        ];
      case 'pm':
      case 'tpa':
      case 'jdinfra':
        return [
          ...baseItems,
          { path: '/officer/inbox', label: 'Inbox', icon: 'bi-inbox' },
          { path: '/officer/outbox', label: 'Outbox', icon: 'bi-send' },
          { path: '/match', label: 'Match Invoices', icon: 'bi-search' },
        ];
      case 'apts':
        return [
          ...baseItems,
          { path: '/manager/inbox', label: 'Inbox', icon: 'bi-inbox' },
          { path: '/manager/outbox', label: 'Outbox', icon: 'bi-send' },
          { path: '/match', label: 'Match Invoices', icon: 'bi-search' },
        ];
      default:
        return baseItems;
    }
  };

  const menuItems = getMenuItems();

  const isActive = (path) => {
    // For dashboard, match exactly
    if (path === `/${userRole}`) {
      return location.pathname === path;
    }
    // For other paths, check if the current path starts with the menu path
    // But be careful not to match /vendor/packages when on /vendor/packages/create
    if (path === '/vendor/packages') {
      return location.pathname === path || location.pathname === '/vendor/packages/';
    }
    // For create package, match exactly
    if (path === '/vendor/packages/create') {
      return location.pathname === path;
    }
    // For other paths, use startsWith
    return location.pathname.startsWith(path);
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login', { replace: true });
    }
  }, [user, isAuthenticated, navigate]);

  if (!user) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column vh-100 bg-light" style={{ overflow: 'hidden' }}>
      {/* Navbar - Uniform Blue */}
      <nav className="navbar navbar-expand-lg" style={{ 
        backgroundColor: '#0a58ca',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1050
      }}>
        <div className="container-fluid">
          <button 
            className="btn btn-outline-light me-2" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <i className="bi bi-list"></i>
          </button>
          <span className="navbar-brand text-white fw-bold">
            <i className="bi bi-building me-2"></i>
            APTS Portal - {getRoleDisplay()}
          </span>
          <div className="navbar-nav ms-auto d-flex flex-row align-items-center">
            <span className="navbar-text text-white me-3">
              <i className="bi bi-person-circle me-1"></i>
              {user?.name || user?.vendor_name || user?.email || 'User'}
            </span>
            <button
              className="btn btn-outline-light btn-sm me-2"
              onClick={() => setShowChangePassword(true)}
            >
              <i className="bi bi-key me-1"></i>
              Change Password
            </button>
            <button
              className="btn btn-danger btn-sm"
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
        {/* Sidebar - Dark with blue active state */}
        <div 
          className={`bg-dark text-white ${sidebarOpen ? 'd-block' : 'd-none'} d-md-block`}
          style={{ width: '250px', minHeight: '100%', overflowY: 'auto' }}
        >
          <div className="p-3">
            <h6 className="text-uppercase text-secondary small">Main Menu</h6>
            <ul className="nav flex-column">
              {menuItems.map((item) => (
                <li key={item.path} className="nav-item">
                  <button
                    className={`nav-link text-white ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                    style={{
                      borderRadius: '5px',
                      marginBottom: '2px',
                      textAlign: 'left',
                      width: '100%',
                      border: 'none',
                      background: isActive(item.path) ? '#0a58ca' : 'transparent',
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
          <div style={{ minHeight: '100%' }}>
            <Outlet />
          </div>
        </main>
      </div>

      <ChangePasswordModal 
        show={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
    </div>
  );
}