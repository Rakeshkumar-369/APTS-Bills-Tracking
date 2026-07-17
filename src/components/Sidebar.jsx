import React from 'react';
import { useApp } from '../context/AppContext';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const { user, logout } = useApp();

  if (!user) return null;

  return (
    <aside className="bg-white border-end d-flex flex-column justify-content-between shadow-sm" style={{ width: '260px', minWidth: '260px' }}>
      <div className="p-3 d-flex flex-column gap-1.5">
        <div className="px-2 py-2 mb-3 bg-light rounded-3">
          <span className="d-block small text-uppercase text-secondary font-monospace fw-bold fs-8">Active Desk Layer</span>
          <span className="d-block fw-extrabold text-dark text-truncate fs-7" title={user.name}>{user.name}</span>
          <span className="badge bg-primary bg-opacity-10 text-primary font-monospace fs-8 mt-1">{user.title} Profile</span>
        </div>

        {user.role === 'vendor' ? (
          <>
            {/* UPDATED SIDEBAR BUTTON LABELS PER YOUR EXACT DIRECTION */}
            <button 
              onClick={() => setCurrentTab('upload')} 
              className={`btn w-100 text-start d-flex align-items-center gap-2.5 px-3 py-2.5 rounded-3 border-0 transition-all ${
                currentTab === 'upload' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-secondary bg-transparent hover-bg-light fw-medium'
              }`}
            >
              <i className="bi bi-cloud-arrow-up-fill fs-5"></i>
              <span className="fs-7">Upload Particulars</span>
            </button>

            <button 
              onClick={() => setCurrentTab('status')} 
              className={`btn w-100 text-start d-flex align-items-center gap-2.5 px-3 py-2.5 rounded-3 border-0 transition-all ${
                currentTab === 'status' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-secondary bg-transparent hover-bg-light fw-medium'
              }`}
            >
              <i className="bi bi-card-list fs-5"></i>
              <span className="fs-7">Track File</span>
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => setCurrentTab('inbox')} 
              className={`btn w-100 text-start d-flex align-items-center gap-2.5 px-3 py-2.5 rounded-3 border-0 transition-all ${
                currentTab === 'inbox' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-secondary bg-transparent hover-bg-light fw-medium'
              }`}
            >
              <i className="bi bi-inbox-fill fs-5"></i>
              <span className="fs-7">Workflow Inbox</span>
            </button>

            <button 
              onClick={() => setCurrentTab('outbox')} 
              className={`btn w-100 text-start d-flex align-items-center gap-2.5 px-3 py-2.5 rounded-3 border-0 transition-all ${
                currentTab === 'outbox' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-secondary bg-transparent hover-bg-light fw-medium'
              }`}
            >
              <i className="bi bi-send-fill fs-5"></i>
              <span className="fs-7">Workflow Outbox</span>
            </button>
          </>
        )}
      </div>

      <div className="p-3 border-top border-light-subtle">
        <button onClick={logout} className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2 rounded-3 fw-bold fs-7 shadow-2xs">
          <i className="bi bi-box-arrow-left fs-6"></i> Terminal Sign Out
        </button>
      </div>

      <style>{`
        .hover-bg-light:hover {
          background-color: rgba(248, 249, 250, 1) !important;
          color: #212529 !important;
        }
        .fs-7 { font-size: 0.875rem !important; }
        .fs-8 { font-size: 0.725rem !important; }
        .shadow-2xs { box-shadow: 0 1px 2px rgba(220,53,69,0.05) !important; }
      `}</style>
    </aside>
  );
}