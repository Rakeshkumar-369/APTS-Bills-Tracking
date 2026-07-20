// src/pages/MyPackages.jsx
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { packagesService } from '../services';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './Inbox';

const STATUS_FILTERS = ['', 'PENDING', 'SUBMITTED', 'IN_PROGRESS', 'RETURNED', 'COMPLETED', 'REJECTED'];

export default function MyPackages() {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await packagesService.list({ 
        status: status || undefined, 
        search: search || undefined,
        vendor_id: user?.vendor_id // Scope to vendor's packages
      });
      // Handle different response formats
      setPackages(res?.data || res || []);
    } catch (err) {
      console.error('MyPackages load error:', err);
      setError(err.message || 'Failed to load packages.');
    } finally {
      setLoading(false);
    }
  }, [status, search, user?.vendor_id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-boxes me-2"></i>
          My Packages
        </h5>
        <span className="badge bg-primary">
          Total: {packages.length}
        </span>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <div className="flex-grow-1" style={{ maxWidth: '300px' }}>
          <input
            className="form-control form-control-sm"
            placeholder="Search by code or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="form-select form-select-sm" 
          style={{ maxWidth: '180px' }} 
          value={status} 
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>
        <button 
          className="btn btn-sm btn-outline-secondary"
          onClick={() => {
            setStatus('');
            setSearch('');
          }}
        >
          <i className="bi bi-arrow-counterclockwise"></i> Reset
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-inbox fs-1 text-muted"></i>
          <p className="text-muted mt-2">No packages yet. Contact admin to create a package.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-sm align-middle">
            <thead>
              <tr>
                <th>Package Code</th>
                <th>Project</th>
                <th>Status</th>
                <th>Current Step</th>
                <th>Files</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td className="fw-medium">{pkg.package_code}</td>
                  <td>{pkg.project_name || pkg.project?.project_name || 'N/A'}</td>
                  <td><StatusBadge status={pkg.status} /></td>
                  <td>{pkg.current_step_name || pkg.current_step?.step_name || 'Not Started'}</td>
                  <td>
                    {pkg.files && pkg.files.length > 0 ? (
                      <span className="badge bg-info">
                        <i className="bi bi-file-earmark me-1"></i>
                        {pkg.files.length}
                      </span>
                    ) : (
                      <span className="badge bg-secondary">0</span>
                    )}
                  </td>
                  <td>{pkg.created_at ? new Date(pkg.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td className="text-end">
                    <Link to={`/packages/${pkg.id}`} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-eye me-1"></i> View
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