// src/pages/Inbox.jsx
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { inboxService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function Inbox() {
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox'); // 'inbox' | 'outbox'
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, returned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (which) => {
    setLoading(true);
    setError('');
    try {
      const [listRes, statsRes] = await Promise.all([
        which === 'inbox' ? inboxService.list() : inboxService.outbox(),
        inboxService.stats(),
      ]);
      
      // Handle different response formats
      setClaims(listRes?.data || listRes || []);
      setStats(statsRes?.data || statsRes || { total: 0, pending: 0, returned: 0 });
    } catch (err) {
      console.error('Inbox load error:', err);
      setError(err.message || 'Failed to load inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">My Desk</h4>
          <p className="text-muted small mb-0">{user?.role_name || user?.role} — {user?.name}</p>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} tone="warning" />
        <StatCard label="Returned" value={stats.returned} tone="danger" />
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button 
            className={`nav-link ${tab === 'inbox' ? 'active' : ''}`} 
            onClick={() => setTab('inbox')}
          >
            <i className="bi bi-inbox me-1"></i>
            Inbox
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${tab === 'outbox' ? 'active' : ''}`} 
            onClick={() => setTab('outbox')}
          >
            <i className="bi bi-send me-1"></i>
            Outbox
          </button>
        </li>
      </ul>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-inbox fs-1 text-muted"></i>
          <p className="text-muted mt-2">Nothing here right now.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>claim</th>
                <th>Vendor</th>
                <th>Project</th>
                <th>Status</th>
                <th>Current step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map((pkg) => (
                <tr key={pkg.id}>
                  <td className="fw-medium">{pkg.claim_code}</td>
                  <td>{pkg.vendor_name || pkg.vendor?.vendor_name}</td>
                  <td>{pkg.project_name || pkg.project?.project_name}</td>
                  <td><StatusBadge status={pkg.status} /></td>
                  <td>{pkg.current_step_name || pkg.current_step?.step_name}</td>
                  <td className="text-end">
                    <Link to={`/claims/${pkg.id}`} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-eye me-1"></i> Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass = tone ? `text-bg-${tone}` : 'bg-body-secondary';
  return (
    <div className="col-sm-4">
      <div className={`card ${toneClass}`}>
        <div className="card-body">
          <div className="small">{label}</div>
          <div className="fs-3 fw-semibold">{value ?? 0}</div>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    PENDING: 'text-bg-warning',
    APPROVED: 'text-bg-success',
    COMPLETED: 'text-bg-success',
    RETURNED: 'text-bg-danger',
    SENT_BACK: 'text-bg-danger',
    IN_PROGRESS: 'text-bg-info',
    REJECTED: 'text-bg-danger',
    SUBMITTED: 'text-bg-primary',
  };
  const cls = map[status?.toUpperCase()] || 'text-bg-secondary';
  return <span className={`badge ${cls}`}>{status || 'Unknown'}</span>;
}