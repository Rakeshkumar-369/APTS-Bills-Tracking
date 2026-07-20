import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="d-flex flex-column bg-white border-end" style={{ width: '260px', height: '100%' }}>
      {/* Profile/Role Identification Context Block */}
      <div className="p-3 border-bottom bg-light">
        <div className="d-flex align-items-center gap-2">
          <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '40px', height: '40px', fontSize: '14px' }}>
            {user.title ? user.title.substring(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="overflow-hidden">
            <h6 className="mb-0 fw-bold text-dark text-truncate small">{user.name}</h6>
            <span className="text-muted text-xs font-monospace bg-white border px-1.5 py-0.5 rounded text-uppercase tracking-wider" style={{ fontSize: '10px' }}>
              {user.title || user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tab Elements Collection */}
      <div className="p-3 d-flex flex-column gap-1 flex-grow-1">
        {user.role === 'vendor' ? (
          <>
            <button
              onClick={() => setCurrentTab('upload')}
              className={`btn text-start d-flex align-items-center gap-2 py-2 px-3 border-0 rounded-3 fw-bold transition-all ${
                currentTab === 'upload' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary'
              }`}
            >
              <i className="bi bi-cloud-upload"></i>
              <span>Upload Particulars</span>
            </button>
            <button
              onClick={() => setCurrentTab('tracking')}
              className={`btn text-start d-flex align-items-center gap-2 py-2 px-3 border-0 rounded-3 fw-bold transition-all ${
                currentTab === 'tracking' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary'
              }`}
            >
              <i className="bi bi-clock-history"></i>
              <span>Tracking Status</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setCurrentTab('inbox')}
              className={`btn text-start d-flex align-items-center gap-2 py-2 px-3 border-0 rounded-3 fw-bold transition-all ${
                currentTab === 'inbox' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary'
              }`}
            >
              <i className="bi bi-inbox"></i>
              <span>Inbox Desk</span>
            </button>

            {/* Role Validation - Hide Outbox option completely if the logged in profile is the APTS Manager */}
            {user.role !== 'apts_manager' && (
              <button
                onClick={() => setCurrentTab('outbox')}
                className={`btn text-start d-flex align-items-center gap-2 py-2 px-3 border-0 rounded-3 fw-bold transition-all ${
                  currentTab === 'outbox' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary'
                }`}
              >
                <i className="bi bi-send"></i>
                <span>Outbox Dispatches</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Terminal Logout Actions Panel Bar Container */}
      <div className="p-3 border-top mt-auto bg-light">
        <button
          onClick={logout}
          className="btn btn-outline-danger w-100 py-2 fw-bold rounded-3 d-flex align-items-center justify-content-center gap-2 shadow-xs"
        >
          <i className="bi bi-box-arrow-left"></i>
          <span>Logout System</span>
        </button>
      </div>
    </div>
  );
}