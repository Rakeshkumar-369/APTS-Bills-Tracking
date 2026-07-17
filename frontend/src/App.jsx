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
      <div className="vh-100 d-flex flex-column align-items-center justify-content-center bg-light">
        <div className="card border-0 shadow-lg p-4 rounded-4 mb-4" style={{ width: '400px' }}>
          <div className="text-center mb-4">
            <h4 className="fw-extrabold text-dark mb-1">APTS Billing Portal</h4>
            <p className="text-muted small">ITE&C Department Workflow Node</p>
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
              Sign In
            </button>
          </form>
        </div>

        <div className="bg-white p-3 rounded-3 shadow-sm border text-center" style={{ width: '400px' }}>
          <p className="text-muted small fw-bold mb-2 uppercase font-monospace">Development Testing Desk Bypasses</p>
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