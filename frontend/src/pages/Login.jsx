import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const { login } = useApp();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    const result = login(username);
    if (!result.success) {
      setError(result.message);
    }
  };

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
            <h2 className="display-6 fw-semibold text-dark mb-4">Web Portal</h2>
            <p className="lead text-secondary mb-4" style={{ maxWidth: '500px' }}>
              Information Technology, Electronics & Communications Department
            </p>
            <div className="d-flex flex-column gap-2 mb-4">
              <div className="d-flex align-items-center">
                <i className="bi bi-check-circle-fill text-success me-2"></i>
                <span className="text-secondary">Secure Access to Workspace</span>
              </div>
              <div className="d-flex align-items-center">
                <i className="bi bi-check-circle-fill text-success me-2"></i>
                <span className="text-secondary">Bill Tracking & Management</span>
              </div>
              <div className="d-flex align-items-center">
                <i className="bi bi-check-circle-fill text-success me-2"></i>
                <span className="text-secondary">Real-time Updates & Collaboration</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="col-lg-6 d-flex align-items-center justify-content-center p-4">
          <div className="card shadow border-0 rounded-3 p-4 bg-white" style={{ maxWidth: '420px', width: '100%' }}>
            <div className="text-center mb-4">
              <div className="bg-primary bg-opacity-10 p-3 rounded-circle d-inline-block mb-3 d-lg-none">
                <i className="bi bi-building-gear text-primary fs-1"></i>
              </div>
              <h4 className="fw-bold text-dark mb-1 d-lg-none">APTS Web Portal</h4>
              <h4 className="fw-bold text-dark mb-1 d-none d-lg-block">Sign In</h4>
              <p className="text-muted small d-lg-none">Information Technology, Electronics & Communications Dept.</p>
              <p className="text-muted small d-none d-lg-block">Enter your credentials to access the portal</p>
            </div>

            {error && <div className="alert alert-danger text-center small py-2">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label text-secondary small fw-bold">Portal Access Account Handle</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0"><i className="bi bi-person text-muted"></i></span>
                  <input 
                    type="text" 
                    className="form-control bg-light border-start-0 ps-1" 
                    placeholder="Enter workspace user handle..."
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(''); }}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label text-secondary small fw-bold">Security Key / Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0"><i className="bi bi-lock text-muted"></i></span>
                  <input 
                    type="password" 
                    disabled 
                    className="form-control bg-light border-start-0 ps-1 text-muted" 
                    placeholder="•••••••• (Bypassed for Front-End Dev Mode)" 
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-100 py-2 fw-bold shadow-sm rounded-3">
                Authenticate Space <i className="bi bi-arrow-right-short ms-1"></i>
              </button>
            </form>

            <div className="mt-4 p-3 bg-light rounded-3 border border-dashed">
              <h6 className="fw-bold text-secondary mb-2 small"><i className="bi bi-shield-check me-1"></i> Developer Test Shortcuts:</h6>
              <div className="d-flex flex-wrap gap-1">
                {['akshara', 'rict', 'wision', 'pm_user', 'tpa_user', 'jd_infra'].map(profile => (
                  <button 
                    key={profile}
                    onClick={() => setUsername(profile)}
                    className="btn btn-outline-secondary btn-xs py-0.5 px-2 font-monospace fs-7 text-dark"
                    type="button"
                  >
                    {profile}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}