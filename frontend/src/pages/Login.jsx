// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/apiClient';

export default function Login() {
  const { login, user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      console.log('🔀 User already logged in, redirecting...');
      const roleRank = user.role_rank;
      let path = '/';
      if (roleRank === 100) path = '/admin';
      else if (roleRank === 10) path = '/vendor';
      else if (roleRank === 60) path = '/manager';
      else if (roleRank >= 30 && roleRank <= 50) path = '/officer';
      navigate(path, { replace: true });
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  // Test credentials
  const testCredentials = [
    { label: 'Super Admin', email: 'admin@apts.gov.in', password: 'Admin@123' },
    { label: 'PM', email: 'pm_user@apts.gov.in', password: 'password123' },
    { label: 'TPA', email: 'tpa_user@apts.gov.in', password: 'password123' },
    { label: 'JD-Infra', email: 'jd_infra@apts.gov.in', password: 'password123' },
    { label: 'APTS Manager', email: 'apts_manager@apts.gov.in', password: 'password123' },
    { label: 'Vendor', email: 'vendor@example.com', password: 'password123' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      console.log('🔐 Attempting login...');
      const result = await login(email, password);
      console.log('📊 Login result:', result);
      
      if (result && result.success) {
        console.log('✅ Login successful, redirecting...');
        const userData = result.user;
        const roleRank = userData.role_rank;
        let path = '/';
        if (roleRank === 100) path = '/admin';
        else if (roleRank === 10) path = '/vendor';
        else if (roleRank === 60) path = '/manager';
        else if (roleRank >= 30 && roleRank <= 50) path = '/officer';
        navigate(path, { replace: true });
      } else if (result && !result.success) {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Invalid credentials. Please check your email and password.');
        } else if (err.status === 429) {
          setError('Too many failed attempts. Your account is temporarily locked.');
        } else {
          setError(err.message || 'Authentication failed. Please try again.');
        }
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return null;
  }

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

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="alert alert-danger py-2 text-center small border-0">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                </div>
              )}
              
              <div className="mb-3">
                <label className="form-label small fw-bold text-secondary">Email Address</label>
                <input 
                  type="email" 
                  className="form-control form-control-lg" 
                  placeholder="Enter your email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  autoFocus
                />
              </div>
              
              <div className="mb-4">
                <label className="form-label small fw-bold text-secondary">Password</label>
                <input 
                  type="password" 
                  className="form-control form-control-lg" 
                  placeholder="Enter your password"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary w-100 py-2 fw-bold rounded-3 shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In <i className="bi bi-arrow-right-short ms-1"></i>
                  </>
                )}
              </button>
            </form>

            {/* Test Credentials Section */}
            <div className="mt-4 pt-3 border-top">
              <p className="text-muted small text-center mb-2">
                <i className="bi bi-info-circle me-1"></i>
                Test Credentials (Click to auto-fill)
              </p>
              <div className="d-flex flex-wrap gap-2 justify-content-center">
                {testCredentials.map((cred, index) => (
                  <button 
                    key={index}
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      console.log('🔑 Using test credentials:', cred.label);
                      setEmail(cred.email);
                      setPassword(cred.password);
                    }}
                    title={`Click to use ${cred.label} credentials`}
                  >
                    {cred.label}
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