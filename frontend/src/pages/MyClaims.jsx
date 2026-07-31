// src/pages/MyClaims.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsService, projectsService, vendorsService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function MyClaims() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  
  // Dropdown data for filters
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    returned: 0
  });

  const [navigatingId, setNavigatingId] = useState(null);

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

  useEffect(() => {
    if (user) {
      fetchClaims();
    }
  }, [user]);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const vendorId = user?.vendor_id || user?.id;
      const data = await claimsService.list({ vendor_id: vendorId });
      setClaims(data || []);

      const total = data?.length || 0;
      const pending = data?.filter(p =>
        ['PENDING', 'SUBMITTED', 'IN_PROGRESS'].includes(p.status)
      ).length || 0;
      const completed = data?.filter(p =>
        ['COMPLETED', 'APPROVED', 'CLEARED'].includes(p.status)
      ).length || 0;
      const returned = data?.filter(p =>
        ['RETURNED', 'SENT_BACK', 'REJECTED'].includes(p.status)
      ).length || 0;

      setStats({ total, pending, completed, returned });
    } catch (err) {
      console.error('❌ Error fetching claims:', err);
      setError('Failed to load claims: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to the full ClaimDetail page
  const handleViewClaim = (item) => {
    const claimId = item?.id || item?.claim_id || item?.ID;
    if (!claimId) {
      alert('Unable to get claim ID');
      return;
    }
    setNavigatingId(claimId);
    navigate(`/vendor/claims/${claimId}`);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setFilterProject('');
    setFilterVendor('');
  };

  // Apply all filters
  const filteredClaims = claims.filter(pkg => {
    const matchesSearch =
      (pkg.claim_code || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.project_name || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.vendor_name || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.po_number || '')?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus ? 
      (pkg.status || '').toUpperCase() === filterStatus.toUpperCase() : 
      true;

    const itemProjectId = pkg.project_id || pkg.project?.id;
    const matchesProject = filterProject ? 
      String(itemProjectId) === String(filterProject) : 
      true;

    const itemVendorId = pkg.vendor_id || pkg.vendor?.id;
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
      'RETURNED': { color: '#ef4444', bg: '#fee2e2' },
      'SENT_BACK': { color: '#ef4444', bg: '#fee2e2' },
      'REJECTED': { color: '#ef4444', bg: '#fee2e2' },
    };

    const style = statusMap[status?.toUpperCase()] || { color: '#6b7280', bg: '#f3f4f6' };
    return (
      <span className="px-3 py-1 rounded-pill fw-semibold" style={{
        backgroundColor: style.bg,
        color: style.color,
        fontSize: '0.85rem'
      }}>
        {status || 'Unknown'}
      </span>
    );
  };

  // Main Claims List View
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading your claims...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid p-4">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button className="btn btn-outline-danger ms-3" onClick={fetchClaims}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1 fw-bold text-primary" style={{ fontSize: '1.75rem' }}>
            <i className="bi bi-file-earmark-text me-2"></i>
            My Claims
          </h3>
          <p className="text-muted small mb-0" style={{ fontSize: '0.9rem' }}>
            View and manage all your submitted claims
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.95rem', padding: '0.5rem 1.25rem' }}
            onClick={() => navigate('/vendor/claims/create')}
          >
            <i className="bi bi-plus-circle me-1"></i>
            Create New Claim
          </button>
          <button
            className="btn btn-outline-primary"
            style={{ fontSize: '0.95rem', padding: '0.5rem 1.25rem' }}
            onClick={fetchClaims}
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>Total Claims</h6>
              <h3 className="fw-bold text-primary" style={{ fontSize: '2rem' }}>{stats.total}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>Pending</h6>
              <h3 className="fw-bold text-warning" style={{ fontSize: '2rem' }}>{stats.pending}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>Completed</h6>
              <h3 className="fw-bold text-success" style={{ fontSize: '2rem' }}>{stats.completed}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>Returned</h6>
              <h3 className="fw-bold text-danger" style={{ fontSize: '2rem' }}>{stats.returned}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small fw-semibold text-secondary" style={{ fontSize: '0.85rem' }}>Search</label>
              <div className="input-group">
                <span className="input-group-text bg-white border-0" style={{ fontSize: '0.95rem' }}>
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input 
                  type="text" 
                  className="form-control border-0" 
                  placeholder="Search by code, project, vendor, or PO..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  style={{ backgroundColor: '#f8fafc', fontSize: '0.95rem' }} 
                />
              </div>
            </div>
            
            <div className="col-md-2">
              <label className="form-label small fw-semibold text-secondary" style={{ fontSize: '0.85rem' }}>Status</label>
              <select 
                className="form-select" 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                style={{ backgroundColor: '#f8fafc', border: 'none', fontSize: '0.95rem' }}
              >
                <option value="">All</option>
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
              <label className="form-label small fw-semibold text-secondary" style={{ fontSize: '0.85rem' }}>Project</label>
              <select 
                className="form-select" 
                value={filterProject} 
                onChange={(e) => setFilterProject(e.target.value)} 
                style={{ backgroundColor: '#f8fafc', border: 'none', fontSize: '0.95rem' }}
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            
            <div className="col-md-2">
              <label className="form-label small fw-semibold text-secondary" style={{ fontSize: '0.85rem' }}>Vendor</label>
              <select 
                className="form-select" 
                value={filterVendor} 
                onChange={(e) => setFilterVendor(e.target.value)} 
                style={{ backgroundColor: '#f8fafc', border: 'none', fontSize: '0.95rem' }}
              >
                <option value="">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.vendor_name}</option>
                ))}
              </select>
            </div>
            
            <div className="col-md-2">
              <button 
                className="btn btn-outline-secondary w-100" 
                onClick={resetFilters} 
                style={{ borderRadius: '8px', fontSize: '0.95rem' }}
              >
                <i className="bi bi-funnel me-1"></i> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Claims Table */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th className="px-4 py-3 text-secondary fw-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-hash me-1"></i> Claim Code
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-receipt me-1"></i> PO Number
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-folder me-1"></i> Project
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-building me-1"></i> Vendor
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-circle me-1"></i> Status
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-diagram-3 me-1"></i> Current Step
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-calendar me-1"></i> Created
                  </th>
                  <th className="px-4 py-3 text-end text-secondary fw-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-gear me-1"></i> Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="text-muted">
                        <i className="bi bi-inbox fs-1 d-block mx-auto mb-3 opacity-25"></i>
                        <p className="mb-0 fw-semibold" style={{ fontSize: '1.1rem' }}>No claims found</p>
                        <small style={{ fontSize: '0.95rem' }}>Create your first claim by clicking the "Create New Claim" button</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((pkg) => {
                    const pkgId = pkg?.id || pkg?.claim_id || pkg?.ID;
                    return (
                      <tr key={pkgId} className="border-bottom" style={{ borderColor: '#f1f5f9' }}>
                        <td className="px-4 py-3">
                          <span className="fw-semibold text-primary" style={{ fontSize: '0.95rem' }}>
                            {pkg.claim_code || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3" style={{ fontSize: '0.95rem' }}>
                          <span className="badge bg-light text-dark" style={{ fontSize: '0.9rem' }}>{pkg.po_number || 'N/A'}</span>
                        </td>
                        <td className="py-3" style={{ fontSize: '0.95rem' }}>{pkg.project_name || 'N/A'}</td>
                        <td className="py-3" style={{ fontSize: '0.95rem' }}>{pkg.vendor_name || 'N/A'}</td>
                        <td className="py-3"><StatusBadge status={pkg.status} /></td>
                        <td className="py-3">
                          <span className="badge bg-info bg-opacity-10 text-info" style={{ fontSize: '0.9rem' }}>
                            {pkg.current_step_name || pkg.current_step?.step_name || 'Not Started'}
                          </span>
                        </td>
                        <td className="py-3" style={{ fontSize: '0.9rem' }}>
                          {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary fw-semibold px-3"
                            style={{ borderRadius: '6px', fontSize: '0.9rem' }}
                            onClick={() => handleViewClaim(pkg)}
                            disabled={navigatingId === pkgId || !pkgId}
                          >
                            {navigatingId === pkgId ? (
                              <span className="spinner-border spinner-border-sm me-1"></span>
                            ) : (
                              <i className="bi bi-eye me-1"></i>
                            )}
                            View Case
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
        .btn-primary { 
          background-color: #2563eb; 
          border-color: #2563eb; 
        }
        .btn-primary:hover { 
          background-color: #1d4ed8; 
          border-color: #1d4ed8; 
        }
        .btn-outline-primary { 
          color: #2563eb; 
          border-color: #2563eb; 
        }
        .btn-outline-primary:hover { 
          background-color: #2563eb; 
          color: white; 
        }
        .form-control:focus, .form-select:focus { 
          border-color: #2563eb; 
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); 
        }
        .input-group .form-control:focus {
          box-shadow: none;
        }
        /* Increase table row height for better readability */
        .table > tbody > tr > td {
          padding-top: 0.75rem;
          padding-bottom: 0.75rem;
        }
        .table > thead > tr > th {
          padding-top: 0.75rem;
          padding-bottom: 0.75rem;
        }
      `}</style>
    </div>
  );
}