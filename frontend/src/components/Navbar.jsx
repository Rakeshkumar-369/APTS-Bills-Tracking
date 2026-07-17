import React from 'react';
import { useApp } from '../context/AppContext';

export default function Navbar() {
  const { user, logout } = useApp();

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom px-4 py-2 shadow-xs sticky-top">
      <div className="container-fluid px-0 d-flex align-items-center justify-content-between">
        
        {/* Left Side: Professional Logo Compartments & Typography */}
        <div className="d-flex align-items-center gap-3">
          
          {/* Mock Grid slots representing AP Govt Emblem, APTS, and ITE&C Brand Logos */}
          <div className="d-flex align-items-center gap-2 border-end pe-3 border-light-subtle">
            <div className="bg-light border text-secondary rounded d-flex align-items-center justify-content-center text-center font-monospace px-2 py-1 fs-8 fw-bold text-uppercase shadow-2xs" style={{ width: '52px', height: '42px', lineHeight: '1.1' }} title="AP State Emblem Asset Node Slot">
              AP GOVT
            </div>
            <div className="bg-primary bg-opacity-10 border border-primary border-opacity-20 text-primary rounded d-flex align-items-center justify-content-center text-center font-monospace px-1.5 py-1 fs-8 fw-extrabold shadow-2xs" style={{ width: '48px', height: '42px', lineHeight: '1.1' }} title="APTS Emblem Asset Node Slot">
              APTS
            </div>
            <div className="bg-success bg-opacity-10 border border-success border-opacity-20 text-success rounded d-flex align-items-center justify-content-center text-center font-monospace px-1 fs-8 fw-semibold shadow-2xs" style={{ width: '50px', height: '42px', lineHeight: '1.1' }} title="ITE&C Department Asset Node Slot">
              ITE&C
            </div>
          </div>

          {/* Master Text Headings */}
          <div>
            <h5 className="mb-0 fw-extrabold tracking-tight text-dark d-flex align-items-center gap-1.5 fs-5">
              APTS Web Portal
            </h5>
            <span className="text-secondary fs-7 fw-medium text-muted tracking-normal">
              Information Technology, Electronics & Communications Department &bull; Govt of AP
            </span>
          </div>
        </div>

        {/* Right Side: Logged User Desk Meta Data */}
        {user && (
          <div className="d-flex align-items-center gap-3 bg-light p-1.5 pe-3 rounded-pill border border-light-subtle shadow-2xs">
            <div className="bg-white border rounded-circle d-flex align-items-center justify-content-center text-primary shadow-xs" style={{ width: '34px', height: '34px' }}>
              <i className="bi bi-person-badge-fill fs-5"></i>
            </div>
            <div className="text-start me-2">
              <span className="d-block fw-bold text-dark fs-7 lh-1 mb-0.5">{user.name}</span>
              <span className="text-muted fs-8 text-capitalize font-monospace fw-semibold opacity-75">
                {user.role === 'officer' ? user.title : 'Registered Vendor'}
              </span>
            </div>
            
            <button 
              onClick={logout} 
              className="btn btn-outline-danger btn-xs px-2.5 py-1 rounded-pill d-flex align-items-center gap-1 fw-bold shadow-xs border-0 bg-white"
            >
              <i className="bi bi-power"></i> Exit
            </button>
          </div>
        )}

      </div>
    </nav>
  );
}