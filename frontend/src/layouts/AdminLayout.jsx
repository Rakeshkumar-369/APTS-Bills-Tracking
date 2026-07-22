// src/layouts/AdminLayout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';

export default function AdminLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [lastLogin, setLastLogin] = useState(null);

  console.log('🏗️ AdminLayout rendered with user:', user?.email);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true); // Auto-open on desktop
      } else {
        setSidebarOpen(false); // Auto-close on mobile
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get last login time
  useEffect(() => {
    if (user) {
      // Try to get last login from localStorage
      const storedLastLogin = localStorage.getItem(`lastLogin_${user.id || user.email}`);
      if (storedLastLogin) {
        setLastLogin(new Date(parseInt(storedLastLogin)));
      } else {
        // If no last login found, set current time as first login
        const now = Date.now();
        localStorage.setItem(`lastLogin_${user.id || user.email}`, now.toString());
        setLastLogin(new Date(now));
      }
    }
  }, [user]);

  // Update last login when user is active
  useEffect(() => {
    if (user) {
      // Update last login time periodically or on activity
      const updateLastLogin = () => {
        const now = Date.now();
        localStorage.setItem(`lastLogin_${user.id || user.email}`, now.toString());
      };
      
      // Update on page load
      updateLastLogin();

      // Update every 5 minutes
      const interval = setInterval(updateLastLogin, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [user]);

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

  // Format last login time
  const formatLastLogin = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Toggle sidebar function with overlay handling for mobile
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Close sidebar on mobile when clicking outside
  const closeSidebar = () => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="d-flex flex-column vh-100 bg-light" style={{ overflow: 'hidden' }}>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary" style={{ zIndex: 1050, flexShrink: 0 }}>
        <div className="container-fluid">
          <button 
            className="btn btn-outline-light me-2 hamburger-btn"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            style={{
              transition: 'all 0.3s ease',
              backgroundColor: 'transparent',
              borderColor: 'rgba(255,255,255,0.5)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#000000';
              e.currentTarget.style.borderColor = '#000000';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
              e.currentTarget.style.color = '#ffffff';
            }}
          >
            <i className="bi bi-list"></i>
          </button>
          <span className="navbar-brand">
            APTS Admin Panel
          </span>
          <div className="navbar-nav ms-auto d-flex flex-row align-items-center">
            <span className="navbar-text text-white me-3 d-none d-md-inline">
              <i className="bi bi-clock-history me-1"></i>
              Last Login: {formatLastLogin(lastLogin)}
            </span>
            <span className="navbar-text text-white me-3">
              <i className="bi bi-person-circle me-1"></i>
              {user?.name || 'Admin'}
            </span>
            <button
              className="btn btn-outline-light btn-sm me-2 change-password-btn"
              onClick={() => setShowChangePassword(true)}
              style={{
                transition: 'all 0.3s ease',
                backgroundColor: 'transparent',
                borderColor: 'rgba(255,255,255,0.5)',
                color: '#ffffff'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0d6efd';
                e.currentTarget.style.borderColor = '#0d6efd';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <i className="bi bi-shield-lock me-1"></i>
              <span className="d-none d-md-inline">Change Password</span>
            </button>
            <button
              className="btn btn-danger btn-sm logout-btn"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              style={{
                transition: 'all 0.3s ease',
                backgroundColor: '#dc3545',
                borderColor: '#dc3545',
                color: '#ffffff'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#bb2d3b';
                e.currentTarget.style.borderColor = '#bb2d3b';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc3545';
                e.currentTarget.style.borderColor = '#dc3545';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <i className="bi bi-box-arrow-right me-1"></i>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="d-flex flex-grow-1" style={{ overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar Overlay for mobile */}
        {isMobile && sidebarOpen && (
          <div 
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ 
              zIndex: 1040, 
              backgroundColor: 'rgba(0,0,0,0.5)',
              cursor: 'pointer'
            }}
            onClick={closeSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <div 
          className={`bg-dark text-white ${sidebarOpen ? 'd-block' : 'd-none'}`}
          style={{ 
            width: '250px', 
            minHeight: '100%', 
            overflowY: 'auto', 
            flexShrink: 0,
            position: isMobile ? 'fixed' : 'relative',
            top: isMobile ? '56px' : '0',
            left: isMobile ? '0' : 'auto',
            bottom: '0',
            zIndex: 1045,
            transition: 'transform 0.3s ease-in-out',
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            boxShadow: isMobile ? '2px 0 8px rgba(0,0,0,0.3)' : 'none'
          }}
        >
          <div className="p-3">
            <h6 className="text-uppercase text-secondary small">Main Menu</h6>
            <ul className="nav flex-column">
              {menuItems.map((item) => (
                <li key={item.path} className="nav-item">
                  <button
                    className={`nav-link text-white ${isActive(item.path) ? 'active bg-primary' : ''}`}
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile) {
                        setSidebarOpen(false);
                      }
                    }}
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
        <main 
          className="flex-grow-1 overflow-auto p-3"
          onClick={closeSidebar}
          style={{
            marginLeft: isMobile ? '0' : '0',
            transition: 'margin-left 0.3s ease-in-out'
          }}
        >
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal
        show={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}