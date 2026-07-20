// src/pages/MatchInvoice.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { packagesService, vendorsService, projectsService } from '../services';

export default function MatchInvoice() {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [packagesData, vendorsData, projectsData] = await Promise.all([
        packagesService.list(),
        vendorsService.list(),
        projectsService.list()
      ]);
      
      setPackages(packagesData || []);
      setVendors(vendorsData || []);
      setProjects(projectsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load invoice matching data');
    } finally {
      setLoading(false);
    }
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.vendor_name : 'N/A';
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.project_name : 'N/A';
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = pkg.package_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          getVendorName(pkg.vendor_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus ? pkg.status === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        {error}
        <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-0">
            <i className="bi bi-file-earmark-check me-2"></i>
            Match Invoice
          </h4>
          <p className="text-muted small">
            <i className="bi bi-info-circle me-1"></i>
            Review and match vendor invoices with submitted packages
          </p>
        </div>
        <span className="badge bg-primary">
          <i className="bi bi-boxes me-1"></i>
          Total Packages: {packages.length}
        </span>
      </div>

      {/* Search and Filter */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by package code or vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
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
                <option value="RETURNED">Returned</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="col-md-3">
              <button 
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('');
                }}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Packages Table */}
      <div className="card">
        <div className="card-body">
          {filteredPackages.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox fs-1 text-muted"></i>
              <p className="text-muted mt-2">No packages found matching your criteria</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Package Code</th>
                    <th>Vendor</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Files</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPackages.map((pkg) => (
                    <tr key={pkg.id}>
                      <td>
                        <strong className="text-primary">{pkg.package_code}</strong>
                      </td>
                      <td>{getVendorName(pkg.vendor_id)}</td>
                      <td>{getProjectName(pkg.project_id)}</td>
                      <td>
                        <span className={`badge ${
                          pkg.status === 'COMPLETED' ? 'bg-success' :
                          pkg.status === 'PENDING' ? 'bg-warning' :
                          pkg.status === 'IN_PROGRESS' ? 'bg-info' :
                          pkg.status === 'RETURNED' || pkg.status === 'REJECTED' ? 'bg-danger' :
                          'bg-secondary'
                        }`}>
                          {pkg.status || 'Unknown'}
                        </span>
                      </td>
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
                      <td>
                        {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setSelectedPackage(pkg)}
                          data-bs-toggle="modal"
                          data-bs-target="#invoiceModal"
                        >
                          <i className="bi bi-eye me-1"></i>
                          Match
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Matching Modal */}
      {selectedPackage && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} id="invoiceModal">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-file-earmark-check me-2"></i>
                  Match Invoice - {selectedPackage.package_code}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedPackage(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6 className="text-muted">Package Details</h6>
                    <dl className="row small">
                      <dt className="col-5">Package Code</dt>
                      <dd className="col-7">{selectedPackage.package_code}</dd>
                      <dt className="col-5">Vendor</dt>
                      <dd className="col-7">{getVendorName(selectedPackage.vendor_id)}</dd>
                      <dt className="col-5">Project</dt>
                      <dd className="col-7">{getProjectName(selectedPackage.project_id)}</dd>
                      <dt className="col-5">Status</dt>
                      <dd className="col-7">
                        <span className={`badge ${
                          selectedPackage.status === 'COMPLETED' ? 'bg-success' : 'bg-warning'
                        }`}>
                          {selectedPackage.status}
                        </span>
                      </dd>
                    </dl>
                  </div>
                  <div className="col-md-6">
                    <h6 className="text-muted">Invoice Details</h6>
                    <div className="mb-3">
                      <label className="form-label small">Invoice Number</label>
                      <input type="text" className="form-control form-control-sm" placeholder="Enter invoice number" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label small">Invoice Amount</label>
                      <input type="number" className="form-control form-control-sm" placeholder="Enter amount" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label small">Invoice Date</label>
                      <input type="date" className="form-control form-control-sm" />
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <h6 className="text-muted">Files Attached</h6>
                  {selectedPackage.files && selectedPackage.files.length > 0 ? (
                    <ul className="list-group">
                      {selectedPackage.files.map((file) => (
                        <li key={file.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <span>
                            <i className="bi bi-file-earmark me-2"></i>
                            {file.original_name}
                          </span>
                          <button className="btn btn-sm btn-outline-primary">
                            <i className="bi bi-download"></i>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted small">No files attached</p>
                  )}
                </div>

                <div className="mt-3">
                  <label className="form-label small">Match Notes</label>
                  <textarea className="form-control" rows="2" placeholder="Add notes about this match..."></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedPackage(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => {
                    alert('Invoice matched successfully!');
                    setSelectedPackage(null);
                  }}
                >
                  <i className="bi bi-check-circle me-1"></i>
                  Match Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}