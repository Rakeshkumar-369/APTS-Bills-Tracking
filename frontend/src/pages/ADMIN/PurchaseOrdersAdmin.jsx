import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { poService, projectsService, vendorsService } from '../../services';
import { useAuth } from '../../context/AuthContext';

export default function PurchaseOrdersAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    project_id: '',
    vendor_ids: [], // Changed to array for multiple vendors
    description: '',
    amount: '',
    status: 'ACTIVE',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [selectedPo, setSelectedPo] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [projects, setProjects] = useState([]);
  // Replace simple vendors list with vendors that include project assignments
  const [vendorsWithProjects, setVendorsWithProjects] = useState([]);

  // Fetch projects and vendors (with projects) for dropdowns
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [projectsRes, vendorsWithProjectsRes] = await Promise.all([
          projectsService.list({ is_active: 1 }),
          vendorsService.listWithProjects(),
        ]);
        setProjects(projectsRes || []);
        setVendorsWithProjects(vendorsWithProjectsRes || []);
      } catch (err) {
        console.error('Failed to load dropdowns:', err);
      }
    };
    fetchDropdowns();
  }, []);

  const fetchPOs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        search: searchTerm || undefined,
        status: filterStatus || undefined,
        project_id: filterProject || undefined,
        vendor_id: filterVendor || undefined,
        limit,
        offset: (page - 1) * limit,
      };
      const { data, meta } = await poService.list(params);
      setPos(data || []);
      setTotalCount(meta?.total || 0);
    } catch (err) {
      console.error('Failed to fetch POs:', err);
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [searchTerm, filterStatus, filterProject, filterVendor, page, limit]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStatus, filterProject, filterVendor]);

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      project_id: '',
      vendor_ids: [], // Changed to empty array
      description: '',
      amount: '',
      status: 'ACTIVE',
    });
    setFormErrors({});
    setSelectedFiles([]);
    setShowModal(true);
  };

  const handleEdit = (po) => {
    setEditingId(po.id);
    setFormData({
      project_id: po.project_id || '',
      vendor_ids: po.vendor_ids || [], // Changed to array
      description: po.description || '',
      amount: po.amount || '',
      status: po.status || 'ACTIVE',
    });
    setFormErrors({});
    setSelectedFiles([]);
    setShowModal(true);
  };

  // Helper to filter vendors by selected project
  const getFilteredVendors = (projectId) => {
    if (!projectId) return vendorsWithProjects;
    return vendorsWithProjects.filter(v =>
      v.projectIds && v.projectIds.includes(parseInt(projectId))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});

    const errors = {};
    if (!formData.project_id) errors.project_id = 'Project is required';
    if (!formData.vendor_ids || formData.vendor_ids.length === 0) {
      errors.vendor_ids = 'At least one vendor is required';
    }
    if (!formData.amount) errors.amount = 'Amount is required';
    if (isNaN(parseFloat(formData.amount))) errors.amount = 'Amount must be a number';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      if (editingId) {
        await poService.update(editingId, formData);
      } else {
        await poService.create(formData, selectedFiles);
      }
      setShowModal(false);
      fetchPOs();
    } catch (err) {
      console.error('Failed to save PO:', err);
      setFormErrors({ submit: err.message || 'Failed to save purchase order' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Purchase Order?')) return;
    try {
      await poService.delete(id);
      fetchPOs();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleUploadFile = (poId) => {
    setSelectedPoId(poId);
    setSelectedFile(null);
    setShowFileModal(true);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }
    setUploading(true);
    try {
      await poService.uploadFile(selectedPoId, selectedFile);
      setShowFileModal(false);
      setSelectedFile(null);
      if (selectedPo && selectedPo.id === selectedPoId) {
        fetchPoDetail(selectedPoId);
      }
      fetchPOs();
    } catch (err) {
      alert('Failed to upload file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (poId, fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await poService.deleteFile(poId, fileId);
      if (selectedPo && selectedPo.id === poId) {
        fetchPoDetail(poId);
      }
      fetchPOs();
    } catch (err) {
      alert('Failed to delete file: ' + err.message);
    }
  };

  const handleDownloadFile = async (poId, fileId, filename) => {
    try {
      await poService.downloadFile(poId, fileId, filename);
    } catch (err) {
      alert('Failed to download: ' + err.message);
    }
  };

  const fetchPoDetail = async (poId) => {
    setDetailLoading(true);
    try {
      let po = await poService.get(poId, { includeFiles: true });
      // Handle possible array wrap
      if (Array.isArray(po)) po = po[0] || null;
      setSelectedPo(po);
      setShowDetailModal(true);
    } catch (err) {
      alert('Failed to load PO details: ' + err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setShowDetailModal(false);
    setSelectedPo(null);
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return '₹ ' + parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const StatusBadge = ({ status }) => {
    const map = {
      ACTIVE: { color: '#10b981', bg: '#d1fae5' },
      CLOSED: { color: '#6b7280', bg: '#f3f4f6' },
      CANCELLED: { color: '#ef4444', bg: '#fee2e2' },
    };
    const style = map[status] || { color: '#6b7280', bg: '#f3f4f6' };
    return (
      <span className="px-2 py-1 rounded-pill fw-semibold" style={{ backgroundColor: style.bg, color: style.color, fontSize: '0.75rem' }}>
        {status || 'UNKNOWN'}
      </span>
    );
  };

  if (initialLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold">
          <i className="bi bi-receipt text-primary me-2"></i>
          Purchase Orders
        </h2>
        <button className="btn btn-primary" onClick={handleCreate}>
          <i className="bi bi-plus-circle me-1"></i> New Purchase Order
        </button>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label small fw-semibold text-secondary">Search</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="PO number, project, vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold text-secondary">Status</label>
              <select
                className="form-select form-select-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold text-secondary">Project</label>
              <select
                className="form-select form-select-sm"
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold text-secondary">Vendor</label>
              <select
                className="form-select form-select-sm"
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
              >
                <option value="">All Vendors</option>
                {vendorsWithProjects.map(v => (
                  <option key={v.id} value={v.id}>{v.vendor_name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-1">
              <button className="btn btn-outline-secondary btn-sm w-100" onClick={() => {
                setSearchTerm('');
                setFilterStatus('');
                setFilterProject('');
                setFilterVendor('');
              }}>
                <i className="bi bi-arrow-counterclockwise"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          {error && (
            <div className="alert alert-danger m-3">{error}</div>
          )}
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="py-3">Project</th>
                  <th className="py-3">Vendor</th>
                  <th className="py-3">Amount</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Created</th>
                  <th className="px-4 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      No Purchase Orders found.
                    </td>
                  </tr>
                ) : (
                  pos.map(po => (
                    <tr key={po.id}>
                      <td className="px-4 py-2 fw-semibold">{po.po_number}</td>
                      <td className="py-2">{po.project_name || 'N/A'}</td>
                      <td className="py-2">{po.vendor_name || 'N/A'}</td>
                      <td className="py-2">{formatCurrency(po.amount)}</td>
                      <td className="py-2"><StatusBadge status={po.status} /></td>
                      <td className="py-2">{new Date(po.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-end">
                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => fetchPoDetail(po.id)}
                            title="View Details"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleUploadFile(po.id)}
                            title="Upload File"
                          >
                            <i className="bi bi-upload"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => handleEdit(po)}
                            title="Edit"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(po.id)}
                            title="Delete"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
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

      {/* Pagination */}
      {totalCount > limit && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div>Showing {pos.length} of {totalCount}</div>
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(p => p - 1)}>Previous</button>
              </li>
              <li className="page-item active"><span className="page-link">{page}</span></li>
              <li className={`page-item ${pos.length < limit ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(p => p + 1)}>Next</button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '12px' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <h5 className="modal-title fw-bold">
                  {editingId ? 'Edit Purchase Order' : 'New Purchase Order'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {formErrors.submit && (
                    <div className="alert alert-danger">{formErrors.submit}</div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Project <span className="text-danger">*</span></label>
                    <select
                      className={`form-select ${formErrors.project_id ? 'is-invalid' : ''}`}
                      value={formData.project_id}
                      onChange={(e) => {
                        const projectId = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          project_id: projectId,
                          vendor_ids: [], // reset vendors on project change
                        }));
                      }}
                      required
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.project_name}</option>
                      ))}
                    </select>
                    {formErrors.project_id && <div className="invalid-feedback">{formErrors.project_id}</div>}
                  </div>
                  
                  {/* Updated Vendor selection with checkboxes for multiple selection */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Vendors <span className="text-danger">*</span></label>
                    <div className={`border rounded-3 p-3 ${formErrors.vendor_ids ? 'border-danger' : ''}`} style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {getFilteredVendors(formData.project_id).length === 0 ? (
                        <div className="text-muted text-center py-2">No vendors available for this project</div>
                      ) : (
                        getFilteredVendors(formData.project_id).map(v => (
                          <div key={v.id} className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`vendor-${v.id}`}
                              value={v.id}
                              checked={formData.vendor_ids.includes(String(v.id))}
                              onChange={(e) => {
                                const vendorId = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  vendor_ids: e.target.checked
                                    ? [...prev.vendor_ids, vendorId]
                                    : prev.vendor_ids.filter(id => id !== vendorId)
                                }));
                              }}
                            />
                            <label className="form-check-label" htmlFor={`vendor-${v.id}`}>
                              {v.vendor_name}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    {formErrors.vendor_ids && <div className="invalid-feedback d-block">{formErrors.vendor_ids}</div>}
                    <small className="text-muted">Select one or more vendors for this purchase order</small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Amount (₹) <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className={`form-control ${formErrors.amount ? 'is-invalid' : ''}`}
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                    {formErrors.amount && <div className="invalid-feedback">{formErrors.amount}</div>}
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="CLOSED">Closed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  {!editingId && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Attach Files</label>
                      <input
                        type="file"
                        className="form-control"
                        multiple
                        onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                      />
                      {selectedFiles.length > 0 && (
                        <div className="mt-2 small text-muted">
                          {selectedFiles.map((file, idx) => (
                            <div key={idx}>{file.name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPo && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content" style={{ borderRadius: '12px' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <h5 className="modal-title fw-bold">
                  PO #{selectedPo.po_number}
                </h5>
                <button type="button" className="btn-close" onClick={closeDetail}></button>
              </div>
              <div className="modal-body">
                {detailLoading ? (
                  <div className="text-center py-3"><div className="spinner-border text-primary"></div></div>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <div className="bg-light p-3 rounded-3">
                          <label className="text-muted small fw-semibold">Project</label>
                          <p className="fw-bold mb-0">{selectedPo.project_name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="bg-light p-3 rounded-3">
                          <label className="text-muted small fw-semibold">Vendors</label>
                          <p className="fw-bold mb-0">
                            {selectedPo.vendors && selectedPo.vendors.length > 0 
                              ? selectedPo.vendors.map(v => v.vendor_name).join(', ')
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="bg-light p-3 rounded-3">
                          <label className="text-muted small fw-semibold">Amount</label>
                          <p className="fw-bold mb-0">{formatCurrency(selectedPo.amount)}</p>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="bg-light p-3 rounded-3">
                          <label className="text-muted small fw-semibold">Status</label>
                          <p className="mb-0"><StatusBadge status={selectedPo.status} /></p>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="bg-light p-3 rounded-3">
                          <label className="text-muted small fw-semibold">Description</label>
                          <p className="mb-0">{selectedPo.description || 'No description'}</p>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="bg-light p-3 rounded-3">
                          <label className="text-muted small fw-semibold">Files</label>
                          {selectedPo.files && selectedPo.files.length > 0 ? (
                            <div className="mt-2">
                              {selectedPo.files.map(file => (
                                <div key={file.id} className="d-flex align-items-center gap-2 mb-2 p-2 bg-white rounded border">
                                  <i className="bi bi-file-earmark-pdf-fill text-danger fs-4"></i>
                                  <div className="flex-grow-1">
                                    <div className="fw-semibold">{file.original_name}</div>
                                    <small className="text-muted">
                                      {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : ''}
                                      {file.mime_type ? ` • ${file.mime_type}` : ''}
                                    </small>
                                  </div>
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleDownloadFile(selectedPo.id, file.id, file.original_name)}
                                  >
                                    <i className="bi bi-download"></i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteFile(selectedPo.id, file.id)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted mb-0">No files attached.</p>
                          )}
                          <button
                            className="btn btn-sm btn-primary mt-2"
                            onClick={() => {
                              setSelectedPoId(selectedPo.id);
                              setShowFileModal(true);
                              setShowDetailModal(false);
                            }}
                          >
                            <i className="bi bi-upload me-1"></i> Upload File
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
                <button className="btn btn-secondary" onClick={closeDetail}>Close</button>
                <button className="btn btn-warning" onClick={() => { closeDetail(); handleEdit(selectedPo); }}>Edit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showFileModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '12px' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <h5 className="modal-title fw-bold">Upload File to PO</h5>
                <button type="button" className="btn-close" onClick={() => setShowFileModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Select File</label>
                  <input
                    type="file"
                    className="form-control"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
                <button className="btn btn-secondary" onClick={() => setShowFileModal(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? <><span className="spinner-border spinner-border-sm me-2"></span>Uploading...</> : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}