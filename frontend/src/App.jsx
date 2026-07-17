import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import VendorDashboard from './pages/VendorDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import AptsManagerDashboard from './pages/AptsManagerDashboard';

export default function App() {
  const { user, login } = useApp();
  const [currentTab, setCurrentTab] = useState('');
  
  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      // Set the initial active view tab based on matching user role mappings
      if (user.role === 'vendor') {
        setCurrentTab('upload');
      } else if (user.role === 'apts_manager') {
        setCurrentTab('inbox');
      } else {
        setCurrentTab('inbox');
      }
    }
  }, [user]);

  const handleFormLogin = (e) => {
    e.preventDefault();
    const success = login(username, password);
    if (!success) {
      setError('Invalid system credentials. Check access matrix codes.');
    } else {
      setError('');
    }
  };

  const handleQuickLogin = (targetUser) => {
    login(targetUser);
    setError('');
  };

  if (!user) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center p-0">
        <div className="row w-100 m-0">
          {/* Left Side - Welcome Message */}
          <div className="col-lg-6 d-none d-lg-flex flex-column justify-content-center align-items-start bg-primary bg-opacity-10 p-5" style={{ minHeight: '100vh' }}>
            <div className="px-4">
              <div className="bg-primary p-3 rounded-circle d-inline-block mb-4">
                <i className="bi bi-building-gear text-white fs-1"></i>
              </div>
              <h1 className="display-4 fw-bold text-primary mb-3">Welcome to APTS</h1>
              <h2 className="display-6 fw-semibold text-dark mb-4">Billing Portal</h2>
              <p className="lead text-secondary mb-4" style={{ maxWidth: '500px' }}>
                Information Technology, Electronics & Communications Department
              </p>
              <div className="d-flex flex-column gap-2 mb-4">
                <div className="d-flex align-items-center">
                  <i className="bi bi-check-circle-fill text-success me-2"></i>
                  <span className="text-secondary">Secure Bill Tracking & Management</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="bi bi-check-circle-fill text-success me-2"></i>
                  <span className="text-secondary">Multi-role Workflow Automation</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="bi bi-check-circle-fill text-success me-2"></i>
                  <span className="text-secondary">Real-time Collaboration & Approvals</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="bi bi-check-circle-fill text-success me-2"></i>
                  <span className="text-secondary">Comprehensive Audit Trail</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="col-lg-6 d-flex align-items-center justify-content-center p-4">
            <div className="card border-0 shadow-lg p-4 rounded-4" style={{ width: '100%', maxWidth: '420px' }}>
              <div className="text-center mb-4">
                <div className="bg-primary bg-opacity-10 p-3 rounded-circle d-inline-block mb-3 d-lg-none">
                  <i className="bi bi-building-gear text-primary fs-1"></i>
                </div>
                <h4 className="fw-extrabold text-dark mb-1 d-lg-none">APTS Billing Portal</h4>
                <h4 className="fw-extrabold text-dark mb-1 d-none d-lg-block">Sign In</h4>
                <p className="text-muted small d-lg-none">ITE&C Department Workflow Node</p>
                <p className="text-muted small d-none d-lg-block">Enter your credentials to access the portal</p>
              </div>

              <form onSubmit={handleFormLogin}>
                {error && <div className="alert alert-danger py-2 text-center small border-0">{error}</div>}
                <div className="mb-3">
                  <label className="form-label small fw-bold text-secondary">Username</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Enter user key..."
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    required 
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-secondary">Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder="••••••••"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary w-100 py-2 fw-bold rounded-3 shadow-sm">
                  Sign In <i className="bi bi-arrow-right-short ms-1"></i>
                </button>
              </form>

              <div className="mt-4 p-3 bg-light rounded-3 border border-dashed">
                <p className="text-muted small fw-bold mb-2 uppercase font-monospace">
                  <i className="bi bi-shield-check me-1"></i> Development Testing Desk Bypasses
                </p>
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  <button onClick={() => handleQuickLogin('vendor_user')} className="btn btn-xs btn-outline-primary px-2.5 py-1 fw-bold text-xs bg-light">
                    <i className="bi bi-person"></i> Vendor Node
                  </button>
                  <button onClick={() => handleQuickLogin('pm_user')} className="btn btn-xs btn-outline-success px-2.5 py-1 fw-bold text-xs bg-light">
                    <i className="bi bi-person-badge"></i> Project Manager
                  </button>
                  <button onClick={() => handleQuickLogin('tpa_user')} className="btn btn-xs btn-outline-warning px-2.5 py-1 fw-bold text-xs bg-light">
                    <i className="bi bi-person-bounding-box"></i> TPA Auditor
                  </button>
                  <button onClick={() => handleQuickLogin('jd_infra')} className="btn btn-xs btn-outline-danger px-2.5 py-1 fw-bold text-xs bg-light">
                    <i className="bi bi-vector-pen"></i> JD Infra (Sign)
                  </button>
                  <button onClick={() => handleQuickLogin('apts_manager')} className="btn btn-xs btn-outline-info px-2.5 py-1 fw-bold text-xs bg-light">
                    <i className="bi bi-shield-check"></i> APTS Manager
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column vh-100 bg-light" style={{ overflow: 'hidden' }}>
      <Navbar />
      <div className="d-flex flex-grow-1" style={{ overflow: 'hidden' }}>
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
        <main className="flex-grow-1 overflow-auto">
          {user.role === 'vendor' && <VendorDashboard currentTab={currentTab} />}
          {user.role === 'officer' && <OfficerDashboard currentTab={currentTab} />}
          {user.role === 'apts_manager' && <AptsManagerDashboard currentTab={currentTab} />}
        </main>
      </div>
    </div>
  );
}