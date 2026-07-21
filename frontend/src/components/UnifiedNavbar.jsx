// src/components/UnifiedNavbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function UnifiedNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Determine user role for display
  const userRole = user?.rank === 100 ? 'Admin' :
                    user?.rank === 10 ? 'Vendor' :
                    user?.rank === 30 ? 'PM' :
                    user?.rank === 40 ? 'TPA Auditor' :
                    user?.rank === 50 ? 'JD-Infra' :
                    user?.rank === 60 ? 'APTS Manager' : 'User';

  return (
    <nav className="navbar navbar-expand-lg" style={{ 
      backgroundColor: '#0a58ca',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div className="container-fluid">
        {/* Brand/Logo */}
        <Link to="/" className="navbar-brand text-white fw-bold d-flex align-items-center">
          <i className="bi bi-building me-2"></i>
          APTS Portal
        </Link>

        {/* Toggler for mobile */}
        <button 
          className="navbar-toggler border-0" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
          style={{ color: 'white' }}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Navbar Links */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {user && (
              <>
                {/* Dashboard link based on role */}
                {user.rank === 100 && (
                  <li className="nav-item">
                    <Link to="/admin" className="nav-link text-white">
                      <i className="bi bi-speedometer2 me-1"></i> Dashboard
                    </Link>
                  </li>
                )}
                {user.rank === 10 && (
                  <li className="nav-item">
                    <Link to="/vendor" className="nav-link text-white">
                      <i className="bi bi-speedometer2 me-1"></i> Dashboard
                    </Link>
                  </li>
                )}
                {[30, 40, 50].includes(user.rank) && (
                  <li className="nav-item">
                    <Link to="/officer" className="nav-link text-white">
                      <i className="bi bi-speedometer2 me-1"></i> Dashboard
                    </Link>
                  </li>
                )}
                {user.rank === 60 && (
                  <li className="nav-item">
                    <Link to="/manager" className="nav-link text-white">
                      <i className="bi bi-speedometer2 me-1"></i> Dashboard
                    </Link>
                  </li>
                )}

                {/* Common links */}
                <li className="nav-item">
                  <Link to="/packages" className="nav-link text-white">
                    <i className="bi bi-box-seam me-1"></i> Packages
                  </Link>
                </li>

                {/* Admin specific links */}
                {user.rank === 100 && (
                  <>
                    <li className="nav-item">
                      <Link to="/admin/users" className="nav-link text-white">
                        <i className="bi bi-people me-1"></i> Users
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/admin/vendors" className="nav-link text-white">
                        <i className="bi bi-building me-1"></i> Vendors
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/admin/workflows" className="nav-link text-white">
                        <i className="bi bi-diagram-3 me-1"></i> Workflows
                      </Link>
                    </li>
                  </>
                )}

                {/* Officer/Manager specific links */}
                {[30, 40, 50, 60].includes(user.rank) && (
                  <li className="nav-item">
                    <Link to="/match" className="nav-link text-white">
                      <i className="bi bi-search me-1"></i> Match Invoices
                    </Link>
                  </li>
                )}
              </>
            )}
          </ul>

          {/* User Info & Logout */}
          {user && (
            <div className="d-flex align-items-center gap-3">
              <div className="text-white d-flex align-items-center gap-2">
                <i className="bi bi-person-circle fs-5"></i>
                <div>
                  <span className="fw-bold">{user.name || user.email}</span>
                  <span className="badge bg-white text-primary ms-2" style={{ fontSize: '0.7rem' }}>
                    {userRole}
                  </span>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="btn btn-outline-light btn-sm"
              >
                <i className="bi bi-box-arrow-right me-1"></i> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}