// src/pages/UnifiedDashboard.jsx
import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsService, poService, projectsService, vendorsService, inboxService } from '../services';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { homePathFor } from '../components/RoleBasedRedirect';
import { decodeEntities, formatDate } from '../utils/text';

const STAT_COLORS = {
  blue: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  yellow: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  green: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  red: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  purple: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
};

// Declared at module level so React does not re-create (and remount) it on every render
function StatCard({ icon, label, value, subtitle, color }) {
  const style = STAT_COLORS[color] || STAT_COLORS.blue;
  return (
    <div className="col-6 col-md-4 col-lg-3 col-xl-2">
      <div className="card h-100 border-0 shadow-sm hover-scale" style={{ borderRadius: 12 }}>
        <div className="card-body p-3 d-flex align-items-center">
          <div className="rounded-3 p-2 p-md-3 me-2 me-md-3" style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}>
            <i className={`bi ${icon}`} style={{ color: style.text, fontSize: '1.4rem' }}></i>
          </div>
          <div className="min-w-0">
            <h6 className="text-muted mb-0 text-truncate" style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.5px' }}>{label}</h6>
            <h3 className="mb-0 fw-bold" style={{ color: style.text, fontSize: '1.6rem' }}>{value}</h3>
            {subtitle && <small className="text-muted" style={{ fontSize: '0.65rem' }}>{subtitle}</small>}
          </div>
        </div>
      </div>
    </div>
  );
}

const ROLE_INFO = {
  100: ['APTS Admin', 'System administration and oversight'],
  80: ['Admin', 'Purchase order management'],
  10: ['Vendor', 'Create and submit claims; respond to send-backs'],
  30: ['Project Manager', 'First verification desk — review and forward claims'],
  40: ['TPA Auditor', 'Audit & verification desk — review and forward claims'],
  50: ['JD-Infra', 'Digital signature authority — validate and forward'],
  60: ['APTS Manager', 'Final clearance authority — approve or send back'],
};

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [totalClaims, setTotalClaims] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [inboxStats, setInboxStats] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // Typing in the search box stays instant; filtering the table can lag a frame behind
  const deferredSearch = useDeferredValue(searchTerm);

  const rank = user?.role_rank;
  const isOfficer = [30, 40, 50, 60].includes(rank);
  const showPOs = rank === 100 || rank === 80 || rank === 10;
  const [roleDisplayName, roleDescription] = ROLE_INFO[rank] || ['User', 'Manage your dashboard'];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Independent requests run in parallel instead of one after another
      const [claimsRes, statsRes, poRes] = await Promise.all([
        claimsService.list({ limit: 400 }),
        isOfficer ? inboxService.stats().catch(() => null) : Promise.resolve(null),
        showPOs ? poService.list({ limit: 400 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      const list = Array.isArray(claimsRes) ? claimsRes : [];
      setClaims(list);
      setTotalClaims(list.length);
      setInboxStats(Array.isArray(statsRes) ? statsRes[0] : statsRes);
      setPurchaseOrders(poRes?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load data');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [isOfficer, showPOs]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      projectsService.list({ is_active: 1 }).catch(() => []),
      vendorsService.list().catch(() => []),
    ]).then(([p, v]) => {
      if (cancelled) return;
      setProjects(p || []);
      setVendors(v || []);
    });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => ({
    total: totalClaims,
    inProgress: claims.filter((c) => c.status === 'IN_PROGRESS').length,
    completed: claims.filter((c) => c.status === 'COMPLETED').length,
    returned: claims.filter((c) => c.status === 'SENT_BACK').length,
  }), [claims, totalClaims]);

  const filteredItems = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return claims.filter((item) => {
      if (q) {
        const hay = `${item.claim_code} ${decodeEntities(item.project_name)} ${decodeEntities(item.vendor_name)} ${item.po_number}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterProject && String(item.project_id) !== String(filterProject)) return false;
      if (filterVendor && String(item.vendor_id) !== String(filterVendor)) return false;
      return true;
    });
  }, [claims, deferredSearch, filterStatus, filterProject, filterVendor]);

  const claimPath = (claimId) => `${homePathFor(user)}/claims/${claimId}`;

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
        <p className="mt-3 text-muted">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchAll}>
            <i className="bi bi-arrow-counterclockwise me-1"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-0 px-md-2">
      <div className="rounded-4 p-3 p-md-4 mb-4" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
          <div className="min-w-0">
            <h2 className="mb-1 fw-bold text-white d-flex align-items-center gap-2 fs-4">
              <i className="bi bi-speedometer2"></i>{roleDisplayName} Dashboard
            </h2>
            <p className="text-white-50 small mb-0 text-truncate">
              <i className="bi bi-person-circle me-1"></i>{decodeEntities(user?.name)} • {roleDescription}
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            {rank === 10 && (
              <button className="btn btn-warning btn-sm fw-semibold" onClick={() => navigate('/vendor/claims/create')}>
                <i className="bi bi-plus-circle me-1"></i> New Claim
              </button>
            )}
            {isOfficer && (
              <button className="btn btn-info btn-sm fw-semibold" onClick={() => navigate(`${homePathFor(user)}/inbox`)}>
                <i className="bi bi-inbox me-1"></i> Open Inbox{inboxStats?.total ? ` (${inboxStats.total})` : ''}
              </button>
            )}
            <button className="btn btn-light btn-sm fw-semibold" onClick={fetchAll}>
              <i className="bi bi-arrow-counterclockwise me-1"></i> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <StatCard icon="bi-box-seam" label="Total Claims" value={stats.total} color="blue" />
        <StatCard icon="bi-graph-up-arrow" label="In Progress" value={stats.inProgress} color="purple" />
        <StatCard icon="bi-arrow-return-left" label="Returned" value={stats.returned} color="red" />
        <StatCard icon="bi-check-circle-fill" label="Completed" value={stats.completed} color="green" />
        {isOfficer && (
          <StatCard icon="bi-inbox-fill" label="Awaiting My Action" value={Number(inboxStats?.total || 0)} color="yellow" />
        )}
        {showPOs && (
          <StatCard icon="bi-receipt" label="Purchase Orders" value={purchaseOrders.length}
            subtitle={`${purchaseOrders.filter((po) => po.status === 'ACTIVE').length} active`} color="blue" />
        )}
      </div>

      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label htmlFor="dash-search" className="form-label small fw-semibold text-secondary">Search</label>
              <input id="dash-search" type="search" className="form-control" placeholder="Claim code, project, vendor or PO..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="dash-status" className="form-label small fw-semibold text-secondary">Status</label>
              <select id="dash-status" className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="SENT_BACK">Returned to Vendor</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="dash-project" className="form-label small fw-semibold text-secondary">Project</label>
              <select id="dash-project" className="form-select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{decodeEntities(p.project_name)}</option>)}
              </select>
            </div>
            {rank !== 10 && (
              <div className="col-6 col-md-2">
                <label htmlFor="dash-vendor" className="form-label small fw-semibold text-secondary">Vendor</label>
                <select id="dash-vendor" className="form-select" value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)}>
                  <option value="">All Vendors</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{decodeEntities(v.vendor_name)}</option>)}
                </select>
              </div>
            )}
            <div className="col-6 col-md-2">
              <button className="btn btn-outline-secondary w-100" onClick={() => { setSearchTerm(''); setFilterStatus(''); setFilterProject(''); setFilterVendor(''); }}>
                <i className="bi bi-funnel me-1"></i> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: 12, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr className="small text-secondary">
                <th className="px-3 py-3">Claim</th>
                <th className="py-3">Project</th>
                <th className="py-3 d-none d-md-table-cell">Vendor</th>
                <th className="py-3 d-none d-lg-table-cell">PO</th>
                <th className="py-3">Status</th>
                <th className="py-3 d-none d-md-table-cell">Currently With</th>
                <th className="py-3 d-none d-lg-table-cell">Submitted</th>
                <th className="px-3 py-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <i className="bi bi-inbox fs-1 d-block mb-3 opacity-25"></i>
                    <p className="mb-0 fw-semibold">No claims found</p>
                    <small>Try adjusting your search or filters</small>
                  </td>
                </tr>
              ) : filteredItems.map((item) => (
                <tr key={item.id} className="small">
                  <td className="px-3 fw-semibold text-primary text-nowrap">{item.claim_code}</td>
                  <td>{decodeEntities(item.project_name)}</td>
                  <td className="d-none d-md-table-cell">{decodeEntities(item.vendor_name)}</td>
                  <td className="d-none d-lg-table-cell text-nowrap">{item.po_number || '—'}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="d-none d-md-table-cell">
                    {item.status === 'COMPLETED' ? '—' : item.status === 'SENT_BACK' ? 'Vendor' : decodeEntities(item.current_step_name) || '—'}
                  </td>
                  <td className="d-none d-lg-table-cell text-nowrap">{formatDate(item.created_at)}</td>
                  <td className="px-3 text-end">
                    <button className="btn btn-sm btn-primary fw-semibold text-nowrap" onClick={() => navigate(claimPath(item.id))}>
                      <i className="bi bi-eye me-1"></i> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
