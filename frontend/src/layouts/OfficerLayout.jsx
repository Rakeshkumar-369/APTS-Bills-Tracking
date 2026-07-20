// src/layouts/OfficerLayout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function OfficerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Redirect if not officer (PM, TPA, JD-Infra)
  useEffect(() => {
    if (user && (user.role_rank < 30 || user.role_rank > 50 || user.role_rank === 60)) {
      navigate('/');
    }
  }, [user, navigate]);

  const getRoleDisplay = () => {
    if (user?.role_rank === 30) return 'PM';
    if (user?.role_rank === 40) return 'TPA';
    if (user?.role_rank === 50) return 'JD-Infra';
    return 'Officer';
  };

  const menuItems = [
    { path: '/officer', label: 'Dashboard', icon: 'bi-grid' },
    { path: '/officer/inbox', label: 'Inbox', icon: 'bi-inbox' },
    { path: '/officer/outbox', label: 'Outbox', icon: 'bi-send' },
    { path: '/officer/packages', label: 'All Packages', icon: 'bi-boxes' },
  ];

  const isActive = (path) => {
    if (path === '/officer' && location.pathname === '/officer') return true;
    if (path !== '/officer' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="d-flex flex-column vh-100 bg-light" style={{ overflow: 'hidden' }}>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-info">
        <div className="container-fluid">
          <button 
            className="btn btn-outline-light me-2" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <i className="bi bi-list"></i>
          </button>
          <span className="navbar-brand">
            <i className="bi bi-person-badge me-2"></i>
            {getRoleDisplay()} Portal
          </span>
          <div className="navbar-nav ms-auto">
            <span className="navbar-text text-white me-3">
              <i className="bi bi-person-circle me-1"></i>
              {user?.name || 'Officer'}
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
                    className={`nav-link text-white ${isActive(item.path) ? 'active bg-info' : ''}`}
                    onClick={() => navigate(item.path)}
                    style={{
                      borderRadius: '5px',
                      marginBottom: '2px',
                      textAlign: 'left',
                      width: '100%',
                      border: 'none',
                      background: isActive(item.path) ? '#0dcaf0' : 'transparent',
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