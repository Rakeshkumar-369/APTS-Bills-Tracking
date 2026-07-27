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
  const [showPassword, setShowPassword] = useState(false); // 👁 toggle state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      console.log('🔀 User already logged in, redirecting...');
      const roleRank = user.role_rank;
      let path = '/';
      if (roleRank === 100 || roleRank === 80) path = '/admin';   // Super Admin & Admin
      else if (roleRank === 10) path = '/vendor';
      else if (roleRank === 60) path = '/manager';
      else if (roleRank >= 30 && roleRank <= 50) path = '/officer';
      navigate(path, { replace: true });
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  // Test credentials – includes Admin (PO) with rank 80
  const testCredentials = [
    { label: 'Super Admin', email: 'admin@apts.gov.in', password: 'Admin@123' },
    { label: 'Admin (PO)', email: 'admin1@gov.in', password: 'Admin@123' },
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
        if (roleRank === 100 || roleRank === 80) path = '/admin';
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

  const featureList = [
    { icon: 'bi-shield-check', text: 'Secure Bill Tracking & Management' },
    { icon: 'bi-diagram-3', text: 'Multi-role Workflow Automation' },
    { icon: 'bi-people', text: 'Real-time Collaboration & Approvals' },
    { icon: 'bi-clipboard-data', text: 'Comprehensive Audit Trail' },
  ];

  return (
    <div
      className="container-fluid min-vh-100 d-flex align-items-center p-0"
      style={{
        background: 'linear-gradient(135deg, #eef4ff 0%, #e6edff 45%, #dfe9ff 100%)',
      }}
    >
      <div className="row w-100 m-0">
        {/* Left Side - Welcome Message */}
        <div
          className="col-lg-6 d-none d-lg-flex flex-column justify-content-center align-items-start p-5 position-relative overflow-hidden"
          style={{ minHeight: '100vh' }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-120px',
              right: '-120px',
              width: '360px',
              height: '360px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 70%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-100px',
              left: '-100px',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(37,99,235,0.14) 0%, rgba(37,99,235,0) 70%)',
            }}
          />

          <div className="px-4 position-relative">
            <div 
              className="d-inline-flex align-items-center justify-content-center mb-4"
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 10px 25px rgba(37, 99, 235, 0.35)'
              }}
            >
              <i className="bi bi-building-gear text-white" style={{ fontSize: '2rem' }}></i>
            </div>

            <h1 className="display-4 fw-bold text-primary mb-2" style={{ letterSpacing: '-0.02em' }}>
              Welcome to APTS
            </h1>
            <h2 className="display-6 fw-semibold text-dark mb-4">Billing Portal</h2>
            <p className="lead text-secondary mb-4" style={{ maxWidth: '480px' }}>
              Information Technology, Electronics & Communications Department
            </p>

            <div className="d-flex flex-column gap-3 mb-4">
              {featureList.map((feature, idx) => (
                <div className="d-flex align-items-center" key={idx}>
                  <div
                    className="d-inline-flex align-items-center justify-content-center me-3 flex-shrink-0"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(37, 99, 235, 0.1)',
                    }}
                  >
                    <i className={`bi ${feature.icon} text-primary`} style={{ fontSize: '1rem' }}></i>
                  </div>
                  <span className="text-secondary fw-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="col-lg-6 d-flex align-items-center justify-content-center p-4">
          <div
            className="card border-0 p-4 p-md-5 rounded-4"
            style={{
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 60px rgba(37, 99, 235, 0.15), 0 4px 12px rgba(0,0,0,0.04)',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="text-center mb-4">
              <div 
                className="d-inline-flex align-items-center justify-content-center mb-3 d-lg-none"
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)'
                }}
              >
                <i className="bi bi-building-gear text-white" style={{ fontSize: '1.75rem' }}></i>
              </div>
              <h4 className="fw-bold text-dark mb-1 d-lg-none">APTS Billing Portal</h4>
              <h3 className="fw-bold text-dark mb-1 d-none d-lg-block">Sign In</h3>
              <p className="text-muted small d-lg-none">ITE&C Department Workflow Node</p>
              <p className="text-muted d-none d-lg-block">Enter your credentials to access the portal</p>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="alert alert-danger py-2 text-center small border-0 rounded-3 d-flex align-items-center justify-content-center">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                </div>
              )}
              
              <div className="mb-3">
                <label className="form-label small fw-bold text-secondary">Email Address</label>
                <div className="position-relative">
                  <i
                    className="bi bi-envelope position-absolute text-muted"
                    style={{ left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                  ></i>
                  <input 
                    type="email" 
                    className="form-control form-control-lg rounded-3"
                    style={{ paddingLeft: '40px' }}
                    placeholder="Enter your email"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="form-label small fw-bold text-secondary">Password</label>
                <div className="position-relative">
                  <i
                    className="bi bi-lock position-absolute text-muted"
                    style={{ left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                  ></i>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    className="form-control form-control-lg rounded-3"
                    style={{ paddingLeft: '40px', paddingRight: '52px' }}
                    placeholder="Enter your password"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />

                  {/* 👁 Eye toggle – boxed style, right */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#ffffff',
                      border: '1px solid #dfe4ee',
                      borderRadius: '8px',
                      boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
                      color: '#7c8aa5',
                      cursor: 'pointer',
                      padding: 0,
                      zIndex: 5,
                      lineHeight: 1,
                      transition: 'background-color .15s ease, border-color .15s ease, color .15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f4f7fd';
                      e.currentTarget.style.borderColor = '#c7d2e6';
                      e.currentTarget.style.color = '#4f6bed';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#dfe4ee';
                      e.currentTarget.style.color = '#7c8aa5';
                    }}
                  >
                    {showPassword ? (
                      /* Eye (open) = password visible, click to hide */
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      /* Eye-off (slashed) = password hidden, click to show */
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary w-100 py-2 fw-bold rounded-3"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
                }}
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
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
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
