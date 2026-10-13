// src/pages/ADMIN/AdminDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { decodeEntities } from '../../utils/text';

const CARDS = [
  { key: 'users', label: 'Total Users', path: '/users', cls: 'bg-primary' },
  { key: 'vendors', label: 'Total Vendors', path: '/vendors', cls: 'bg-success' },
  { key: 'projects', label: 'Total Projects', path: '/projects', cls: 'bg-info' },
  { key: 'pos', label: 'Purchase Orders', path: '/purchase-orders', cls: 'bg-secondary' },
  { key: 'claims', label: 'Total Claims', path: '/claims', cls: 'bg-warning' },
];

const ACTIONS = [
  { to: '/admin/users', icon: 'bi-person-plus', label: 'Manage Users', cls: 'btn-primary', superOnly: true },
  { to: '/admin/vendors', icon: 'bi-building-add', label: 'Manage Vendors', cls: 'btn-success', superOnly: true },
  { to: '/admin/projects', icon: 'bi-folder-plus', label: 'Manage Projects', cls: 'btn-info', superOnly: true },
  { to: '/admin/purchase-orders', icon: 'bi-receipt', label: 'Purchase Orders', cls: 'btn-dark', superOnly: false },
  { to: '/admin/roles', icon: 'bi-shield-plus', label: 'Manage Roles', cls: 'btn-warning', superOnly: true },
  { to: '/admin/workflows', icon: 'bi-diagram-3', label: 'Manage Workflows', cls: 'btn-secondary', superOnly: true },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isSuperAdmin = user?.role_rank === 100;

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // limit=1 + meta.total: real totals without downloading every record
      const results = await Promise.all(CARDS.map((c) =>
        api.get(`${c.path}?limit=1`, { withMeta: true })
          .then((r) => r.meta?.total ?? r.data.length)
          .catch(() => null)
      ));
      setStats(Object.fromEntries(CARDS.map((c, i) => [c.key, results[i]])));
    } catch {
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Dashboard Overview</h4>
        <span className="badge bg-primary">
          {isSuperAdmin ? 'Super Admin' : 'Admin (PO Manager)'} — {decodeEntities(user?.name)}
        </span>
      </div>

      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchStats}>Retry</button>
        </div>
      )}

      <div className="row g-3">
        {CARDS.map((c) => (
          <div key={c.key} className="col-6 col-md-4 col-xl">
            <div className={`card ${c.cls} text-white shadow-sm h-100`}>
              <div className="card-body">
                <h6 className="card-title small">{c.label}</h6>
                <h2 className="mb-0">
                  {loading ? <span className="spinner-border spinner-border-sm" role="status" /> : (stats[c.key] ?? '—')}
                </h2>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card shadow-sm mt-4">
        <div className="card-body">
          <h5>Quick Actions</h5>
          <div className="d-flex flex-wrap gap-2 mt-3">
            {ACTIONS.filter((a) => isSuperAdmin || !a.superOnly).map((a) => (
              <button key={a.to} className={`btn ${a.cls}`} onClick={() => navigate(a.to)}>
                <i className={`bi ${a.icon} me-1`}></i> {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
