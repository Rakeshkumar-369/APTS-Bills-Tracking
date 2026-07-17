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
    <div className="container d-flex align-items-center justify-content-center min-vh-100 pb-5">
      <div className="card shadow border-0 rounded-3 p-4 bg-white" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="text-center mb-4">
          <div className="bg-primary bg-opacity-10 p-3 rounded-circle d-inline-block mb-3">
            <i className="bi bi-building-gear text-primary fs-1"></i>
          </div>
          <h4 className="fw-bold text-dark mb-1">APTS Web Portal</h4>
          <p className="text-muted small">Information Technology, Electronics & Communications Dept.</p>
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
  );
}