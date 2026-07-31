// src/pages/UnifiedDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsService, poService, projectsService, vendorsService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function UnifiedDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Dropdown data for filters
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  
  const [inboxStats, setInboxStats] = useState({
    total: 0,
    pending: 0,
    returned: 0
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    returned: 0,
    inProgress: 0
  });

  // Purchase Order states
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [posLoading, setPosLoading] = useState(false);

  // Get API base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  // Determine user role rank & route prefix
  const userRole = user?.role_rank === 100 ? 'admin' :
                    user?.role_rank === 10 ? 'vendor' :
                    user?.role_rank === 30 ? 'pm' :
                    user?.role_rank === 40 ? 'tpa' :
                    user?.role_rank === 50 ? 'jdinfra' :
                    user?.role_rank === 60 ? 'apts' : 'unknown';

  const getRoutePrefix = () => {
    if (userRole === 'admin') return '/admin';
    if (userRole === 'vendor') return '/vendor';
    if (userRole === 'apts') return '/manager';
    return '/officer';
  };

  const getRoleDisplayName = () => {
    if (user?.role_rank === 100) return 'APTS Admin';
    if (user?.role_rank === 10) return 'Vendor';
    if (user?.role_rank === 30) return 'Project Manager';
    if (user?.role_rank === 40) return 'TPA Auditor';
    if (user?.role_rank === 50) return 'JD-Infra';
    if (user?.role_rank === 60) return 'APTS Manager';
    return 'User';
  };

  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.vendor_name) return user.vendor_name;
    if (user?.email) return user.email;
    return 'User';
  };

  const getRoleDescription = () => {
    if (user?.role_rank === 100) return 'System administration and oversight';
    if (user?.role_rank === 10) return 'Create and submit claims; respond to sendbacks';
    if (user?.role_rank === 30) return 'First verification desk - review and forward claims';
    if (user?.role_rank === 40) return 'Audit & verification desk - review and forward claims';
    if (user?.role_rank === 50) return 'Digital signature authority - validate and forward';
    if (user?.role_rank === 60) return 'Final clearance authority - approve or send back';
    return 'Manage your dashboard';
  };

  const roleDisplayName = getRoleDisplayName();
  const userDisplayName = getUserDisplayName();
  const roleDescription = getRoleDescription();

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchData();
      if (['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole)) {
        fetchInboxStats();
      }
      if (userRole === 'admin' || userRole === 'vendor') {
        fetchPurchaseOrders();
      }
    } else {
      setLoading(false);
      setError(null);
    }
  }, [user, isAuthenticated]);

  // Fetch projects and vendors for filter dropdowns
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [projectsRes, vendorsRes] = await Promise.all([
          projectsService.list({ is_active: 1 }),
          vendorsService.list(),
        ]);
        setProjects(projectsRes || []);
        setVendors(vendorsRes || []);
      } catch (err) {
        console.error('Failed to load filter dropdowns:', err);
      }
    };
    fetchDropdowns();
  }, []);

  const fetchInboxStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const response = await fetch(`${API_BASE}/inbox/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      if (!response.ok) return;
      const data = await response.json();
      setInboxStats(data);
    } catch (err) {
      console.debug('Inbox stats not available:', err.message);
    }
  };

  const fetchPurchaseOrders = async () => {
    setPosLoading(true);
    try {
      let params = {};
      if (userRole === 'vendor' && user?.vendor_id) {
        params.vendor_id = user.vendor_id;
      }
      const { data } = await poService.list(params);
      setPurchaseOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch POs:', err);
    } finally {
      setPosLoading(false);
    }
  };

  // Fetch ALL claims regardless of role - no filtering by vendor/stage
  const fetchData = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const claimsData = await claimsService.list({});

      setClaims(claimsData || []);

      const total = claimsData?.length || 0;
      const pending = claimsData?.filter(p => ['PENDING','SUBMITTED','IN_PROGRESS'].includes(p.status)).length || 0;
      const completed = claimsData?.filter(p => ['COMPLETED','APPROVED','CLEARED'].includes(p.status)).length || 0;
      const returned = claimsData?.filter(p => ['RETURNED','SENT_BACK','REJECTED'].includes(p.status)).length || 0;
      const inProgress = claimsData?.filter(p => p.status === 'IN_PROGRESS').length || 0;
      setStats({ total, pending, completed, returned, inProgress });

    } catch (err) {
      console.error('❌ Error fetching data:', err);
      setError(err.message || 'Failed to load data');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  // Direct Unified Navigation Handler
  const handleNavigateToClaim = (pkgId) => {
    if (!pkgId) {
      alert('Unable to identify claim ID.');
      return;
    }
    const prefix = getRoutePrefix();
    navigate(`${prefix}/claims/${pkgId}`);
  };

  const filteredItems = claims.filter(item => {
    const searchTermLower = searchTerm.toLowerCase();
    const pkgCode = item.claim_code || item.claimCode || item.id || '';
    const projectName = item.project_name || item.project?.project_name || '';
    const vendorName = item.vendor_name || item.vendor || '';
    const poNumber = item.po_number || item.po?.po_number || '';
    
    const matchesSearch = 
      pkgCode?.toLowerCase().includes(searchTermLower) ||
      projectName?.toLowerCase().includes(searchTermLower) ||
      vendorName?.toLowerCase().includes(searchTermLower) ||
      poNumber?.toLowerCase().includes(searchTermLower);
    
    const matchesStatus = filterStatus ? 
      (item.status || '').toUpperCase() === filterStatus.toUpperCase() : 
      true;

    const itemProjectId = item.project_id || item.project?.id;
    const matchesProject = filterProject ? 
      String(itemProjectId) === String(filterProject) : 
      true;

    const itemVendorId = item.vendor_id || item.vendor?.id;
    const matchesVendor = filterVendor ? 
      String(itemVendorId) === String(filterVendor) : 
      true;
    
    return matchesSearch && matchesStatus && matchesProject && matchesVendor;
  });

  const StatusBadge = ({ status }) => {
    const statusMap = {
      'PENDING': { color: '#f59e0b', bg: '#fef3c7' },
      'SUBMITTED': { color: '#3b82f6', bg: '#dbeafe' },
      'IN_PROGRESS': { color: '#8b5cf6', bg: '#ede9fe' },
      'COMPLETED': { color: '#10b981', bg: '#d1fae5' },
      'APPROVED': { color: '#10b981', bg: '#d1fae5' },
      'CLEARED': { color: '#10b981', bg: '#d1fae5' },
      'RETURNED': { color: '#ef4444', bg: '#fee2e2' },
      'SENT_BACK': { color: '#ef4444', bg: '#fee2e2' },
      'REJECTED': { color: '#ef4444', bg: '#fee2e2' },
    };
    const style = statusMap[status?.toUpperCase()] || { color: '#6b7280', bg: '#f3f4f6' };
    return (
      <span className="px-3 py-1 rounded-pill fw-semibold" style={{ backgroundColor: style.bg, color: style.color, fontSize: '0.75rem' }}>
        {status || 'Unknown'}
      </span>
    );
  };

  const StatCard = ({ icon, label, value, subtitle, color }) => {
    const colors = {
      blue: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
      yellow: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
      green: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
      red: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
      purple: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' }
    };
    const style = colors[color] || colors.blue;
    return (
      <div className="col-xl-2 col-lg-3 col-md-4 col-sm-6 mb-3">
        <div className="card h-100 border-0 shadow-sm hover-scale" style={{ borderRadius: '12px' }}>
          <div className="card-body p-3">
            <div className="d-flex align-items-center">
              <div className="rounded-3 p-3 me-3" style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}>
                {React.cloneElement(icon, { style: { color: style.text, fontSize: '1.5rem' } })}
              </div>
              <div>
                <h6 className="text-muted mb-0" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                  {label}
                </h6>
                <h3 className="mb-0 fw-bold" style={{ color: style.text, fontSize: '1.75rem' }}>
                  {value}
                </h3>
                {subtitle && <small className="text-muted" style={{ fontSize: '0.65rem' }}>{subtitle}</small>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchData}>
            <i className="bi bi-arrow-counterclockwise me-1"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show" role="alert" style={{ 
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          minWidth: '300px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
        }}>
          <i className="bi bi-check-circle-fill me-2"></i>
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
        </div>
      )}

      {/* Header */}
      <div className="rounded-4 p-4 mb-4" style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}>
        <div className="d-flex flex-wrap justify-content-between align-items-center">
          <div>
            <h2 className="mb-1 fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-speedometer2"></i>
              {roleDisplayName} Dashboard
            </h2>
            <p className="text-white-50 small mb-0">
              <i className="bi bi-person-circle me-1"></i>
              {userDisplayName} • {roleDescription}
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <button className="btn btn-light btn-sm fw-semibold" onClick={() => {
              fetchData();
              if (['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole)) fetchInboxStats();
              if (userRole === 'admin' || userRole === 'vendor') fetchPurchaseOrders();
            }} style={{ borderRadius: '8px' }}>
              <i className="bi bi-arrow-counterclockwise me-1"></i> Refresh
            </button>
            <span className="badge bg-white text-dark p-2 fw-semibold" style={{ borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '0.85rem' }}>
              <i className="bi bi-calendar3 me-1 text-primary"></i>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <StatCard icon={<i className="bi bi-box-seam"></i>} label="Total Items" value={stats.total} color="blue" />
        <StatCard icon={<i className="bi bi-clock-history"></i>} label="Pending" value={stats.pending} color="yellow" />
        <StatCard icon={<i className="bi bi-check-circle-fill"></i>} label="Completed" value={stats.completed} color="green" />
        <StatCard icon={<i className="bi bi-arrow-return-left"></i>} label="Returned" value={stats.returned} color="red" />
        <StatCard icon={<i className="bi bi-graph-up-arrow"></i>} label="In Progress" value={stats.inProgress} color="purple" />
        {(userRole === 'admin' || userRole === 'vendor') && (
          <StatCard 
            icon={<i className="bi bi-receipt"></i>}
            label="Purchase Orders"
            value={purchaseOrders.length}
            subtitle={`${purchaseOrders.filter(po => po.status === 'ACTIVE').length} active`}
            color="blue"
          />
        )}
      </div>

      {/* Inbox Stats for Officers */}
      {['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole) && inboxStats.total > 0 && (
        <div className="row g-3 mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <div className="card-body p-3">
                <h6 className="fw-bold text-dark mb-3">
                  <i className="bi bi-inbox-fill text-primary me-2"></i> Inbox Summary
                </h6>
                <div className="d-flex flex-wrap gap-4">
                  <div><span className="text-muted small">Total in Inbox</span><h4 className="fw-bold text-primary">{inboxStats.total || 0}</h4></div>
                  <div><span className="text-muted small">Pending Action</span><h4 className="fw-bold text-warning">{inboxStats.pending || 0}</h4></div>
                  <div><span className="text-muted small">Returned</span><h4 className="fw-bold text-danger">{inboxStats.returned || 0}</h4></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small fw-semibold text-secondary">Search</label>
              <div className="input-group">
                <span className="input-group-text bg-white border-0"><i className="bi bi-search text-muted"></i></span>
                <input type="text" className="form-control border-0" placeholder="Search by code, project, vendor, or PO..." 
                       value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ backgroundColor: '#f8fafc' }} />
              </div>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold text-secondary">Status</label>
              <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ backgroundColor: '#f8fafc', border: 'none' }}>
                <option value="">All </option>
                <option value="PENDING">Pending</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="APPROVED">Approved</option>
                <option value="RETURNED">Returned</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLEARED">Cleared</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold text-secondary">Project</label>
              <select className="form-select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)} style={{ backgroundColor: '#f8fafc', border: 'none' }}>
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold text-secondary">Vendor</label>
              <select className="form-select" value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} style={{ backgroundColor: '#f8fafc', border: 'none' }}>
                <option value="">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.vendor_name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-outline-secondary w-100" onClick={() => { setSearchTerm(''); setFilterStatus(''); setFilterProject(''); setFilterVendor(''); }} style={{ borderRadius: '8px' }}>
                <i className="bi bi-funnel me-1"></i> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th className="px-4 py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-hash me-1"></i> ID / Code
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-folder me-1"></i> Project
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-building me-1"></i> Vendor
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-receipt me-1"></i> PO
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-circle me-1"></i> Status
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-diagram-3 me-1"></i> Current Step
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-calendar me-1"></i> Date
                  </th>
                  <th className="px-4 py-3 text-end text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-gear me-1"></i> Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="text-muted">
                        <i className="bi bi-inbox fs-1 d-block mx-auto mb-3 opacity-25"></i>
                        <p className="mb-0 fw-semibold">No items found</p>
                        <small>Try adjusting your search or filters</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const pkgId = item?.id || item?.claim_id || item?.ID;
                    const pkgCode = item?.claim_code || item?.claimCode || pkgId || 'N/A';
                    const projectName = item?.project_name || item?.project?.project_name || 'N/A';
                    const vendorName = item?.vendor_name || item?.vendor || item?.vendor_id || 'N/A';
                    const poNumber = item?.po_number || item?.po?.po_number || 'N/A';
                    const currentStep = item?.current_step?.step_name || item?.current_step_name || item?.status ||'Not Started';
                    const createdDate = item?.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A';
                    
                    return (
                      <tr key={pkgId || index} className="border-bottom" style={{ borderColor: '#f1f5f9' }}>
                        <td className="px-4 py-3">
                          <span className="fw-semibold text-primary" style={{ fontSize: '0.85rem' }}>{pkgCode}</span>
                        </td>
                        <td className="py-3" style={{ fontSize: '0.85rem' }}>{projectName}</td>
                        <td className="py-3" style={{ fontSize: '0.85rem' }}>{vendorName}</td>
                        <td className="py-3" style={{ fontSize: '0.85rem' }}>{poNumber}</td>
                        <td className="py-3"><StatusBadge status={item.status} /></td>
                        <td className="py-3" style={{ fontSize: '0.85rem' }}>{currentStep}</td>
                        <td className="py-3" style={{ fontSize: '0.8rem' }}>{createdDate}</td>
                        <td className="px-4 py-3 text-end">
                          <button 
                            className="btn btn-sm btn-primary fw-semibold px-3" 
                            style={{ borderRadius: '6px' }}
                            onClick={() => handleNavigateToClaim(pkgId)}
                          >
                            <i className="bi bi-eye me-1"></i> View Case
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .hover-scale { transition: all 0.3s ease; }
        .hover-scale:hover { transform: translateY(-4px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1) !important; }
        .btn-primary { background-color: #2563eb; border-color: #2563eb; }
        .btn-primary:hover { background-color: #1d4ed8; border-color: #1d4ed8; }
        .btn-outline-primary { color: #2563eb; border-color: #2563eb; }
        .btn-outline-primary:hover { background-color: #2563eb; color: white; }
        .form-control:focus, .form-select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
      `}</style>
    </div>
  );
}