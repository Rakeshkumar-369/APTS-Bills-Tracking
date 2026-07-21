// src/pages/MyPackages.jsx (Updated with Create Package button)
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { packagesService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function MyPackages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    returned: 0
  });

  useEffect(() => {
    if (user) {
      fetchPackages();
    }
  }, [user]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const vendorId = user?.vendor_id || user?.id;
      const data = await packagesService.list({ vendor_id: vendorId });
      setPackages(data || []);
      
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
      console.error('Error fetching packages:', err);
      setError('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = 
      pkg.package_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus ? pkg.status === filterStatus : true;
    return matchesSearch && matchesStatus;
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
        fontSize: '0.75rem'
      }}>
        {status || 'Unknown'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading your packages...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1 fw-bold text-primary">
            <i className="bi bi-box-seam me-2"></i>
            My Packages
          </h3>
          <p className="text-muted small mb-0">
            View and manage all your submitted packages
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/vendor/packages/create')}
          >
            <i className="bi bi-plus-circle me-1"></i>
            Create New Package
          </button>
          <button 
            className="btn btn-outline-primary"
            onClick={fetchPackages}
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
              <h6 className="text-muted mb-0">Total Packages</h6>
              <h3 className="fw-bold text-primary">{stats.total}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-0">Pending</h6>
              <h3 className="fw-bold text-warning">{stats.pending}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-0">Completed</h6>
              <h3 className="fw-bold text-success">{stats.completed}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-0">Returned</h6>
              <h3 className="fw-bold text-danger">{stats.returned}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by code, project, or vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="APPROVED">Approved</option>
                <option value="RETURNED">Returned</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="col-md-2">
              <button 
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('');
                }}
              >
                <i className="bi bi-funnel me-1"></i> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Packages Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th className="px-4 py-3 text-secondary fw-semibold">Package Code</th>
                  <th className="py-3 text-secondary fw-semibold">Project</th>
                  <th className="py-3 text-secondary fw-semibold">Status</th>
                  <th className="py-3 text-secondary fw-semibold">Current Step</th>
                  <th className="py-3 text-secondary fw-semibold">Files</th>
                  <th className="py-3 text-secondary fw-semibold">Created</th>
                  <th className="px-4 py-3 text-end text-secondary fw-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackages.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="text-muted">
                        <i className="bi bi-inbox fs-1 d-block mx-auto mb-3 opacity-25"></i>
                        <p className="mb-0 fw-semibold">No packages found</p>
                        <small>Create your first package by clicking the "Create New Package" button</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPackages.map((pkg) => (
                    <tr key={pkg.id} className="border-bottom">
                      <td className="px-4 py-3">
                        <span className="fw-semibold text-primary">{pkg.package_code}</span>
                      </td>
                      <td className="py-3">{pkg.project_name || 'N/A'}</td>
                      <td className="py-3"><StatusBadge status={pkg.status} /></td>
                      <td className="py-3">{pkg.current_step?.step_name || pkg.current_step_name || 'Not Started'}</td>
                      <td className="py-3">
                        {pkg.files && pkg.files.length > 0 ? (
                          <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                            <i className="bi bi-file-earmark-pdf-fill me-1"></i>
                            {pkg.files.length}
                          </span>
                        ) : (
                          <span className="badge bg-light text-secondary">0</span>
                        )}
                      </td>
                      <td className="py-3">
                        {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                          <Link 
                            to={`/packages/${pkg.id}`} 
                            className="btn btn-sm btn-outline-primary"
                          >
                            <i className="bi bi-eye me-1"></i> View
                          </Link>
                          {pkg.status?.toUpperCase() === 'RETURNED' && (
                            <Link 
                              to={`/vendor/packages/${pkg.id}/resubmit`}
                              className="btn btn-sm btn-primary"
                            >
                              <i className="bi bi-arrow-counterclockwise me-1"></i> Resubmit
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}