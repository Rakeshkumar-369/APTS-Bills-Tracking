// src/layouts/VendorLayout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function VendorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Redirect if not vendor
  useEffect(() => {
    if (user && user.role_rank !== 10) {
      navigate('/');
    }
  }, [user, navigate]);

  const menuItems = [
    { path: '/vendor', label: 'Dashboard', icon: 'bi-grid' },
    { path: '/vendor/packages', label: 'My Packages', icon: 'bi-boxes' },
    { path: '/vendor/history', label: 'History', icon: 'bi-clock-history' },
  ];

  const isActive = (path) => {
    if (path === '/vendor' && location.pathname === '/vendor') return true;
    if (path !== '/vendor' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="d-flex flex-column vh-100 bg-light" style={{ overflow: 'hidden' }}>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-success">
        <div className="container-fluid">
          <button 
            className="btn btn-outline-light me-2" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <i className="bi bi-list"></i>
          </button>
          <span className="navbar-brand">
            <i className="bi bi-building me-2"></i>
            Vendor Portal
          </span>
          <div className="navbar-nav ms-auto">
            <span className="navbar-text text-white me-3">
              <i className="bi bi-person-circle me-1"></i>
              {user?.name || 'Vendor'}
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
          style={{ width: '250px', minHeight: '100%', overflowY: 'auto' }}
        >
          <div className="p-3">
            <h6 className="text-uppercase text-secondary small">Menu</h6>
            <ul className="nav flex-column">
              {menuItems.map((item) => (
                <li key={item.path} className="nav-item">
                  <button
                    className={`nav-link text-white ${isActive(item.path) ? 'active bg-success' : ''}`}
                    onClick={() => navigate(item.path)}
                    style={{
                      borderRadius: '5px',
                      marginBottom: '2px',
                      textAlign: 'left',
                      width: '100%',
                      border: 'none',
                      background: isActive(item.path) ? '#198754' : 'transparent',
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