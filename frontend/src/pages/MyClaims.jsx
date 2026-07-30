// src/pages/MyClaims.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsService } from '../services';
import { useAuth } from '../context/AuthContext';
import PdfViewerPage from './PdfViewerPage';

export default function MyClaims() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
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

  // --- inline claim view state ---
  const [loadingItemId, setLoadingItemId] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [showPdfView, setShowPdfView] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

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

  const handleViewClaim = async (item) => {
    const claimId = item?.id || item?.claim_id || item?.ID;
    if (!claimId) {
      alert('Unable to get claim ID');
      return;
    }
    setLoadingItemId(claimId);
    try {
      const details = await claimsService.get(claimId, { includeDetails: true });
      
      // Get the file info
      let fileUrl = null;
      let fileName = 'document.pdf';
      let fileSize = 'N/A';

      if (details?.files && details.files.length > 0) {
        const file = details.files[0];
        fileName = file.original_name || file.filename || 'document.pdf';
        fileSize = file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'N/A';
        if (file.id) {
          fileUrl = `${API_BASE}/claims/${claimId}/files/${file.id}/download`;
        }
      }

      // Get history
      const history = details?.history || [
        { 
          actor: details?.vendor_name || 'Vendor', 
          date: new Date(details?.created_at).toLocaleString(), 
          action: 'Claim Created', 
          remarks: details?.submission_note || 'Initial submission' 
        }
      ];

      const claimData = {
        id: details?.claim_code || details?.claimCode || claimId,
        claimId: claimId,
        vendor: details?.vendor_name || details?.vendor || 'Akshara Enterprises',
        project: details?.project_name || details?.project?.project_name || 'Video Conferencing',
        poReference: details?.po_reference || 'Workflow',
        poNumber: details?.po_number || 'PO-2026-0003',
        package: details?.package_name || 'Standard Vendor Package C...',
        submissionNote: details?.submission_note || details?.remarks || 'fhgfkmjhklk',
        fileName,
        fileSize,
        fileUrl,
        history: history,
        status: details?.status || 'IN_PROGRESS',
        currentStage: details?.current_step_name || 'PM Verification',
        created_at: details?.created_at
      };

      setSelectedClaim(claimData);
      setShowDetailView(true);
    } catch (err) {
      console.error('❌ Error fetching claim details:', err);
      alert('Failed to load claim details');
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleBackFromDetail = () => {
    setShowDetailView(false);
    setSelectedClaim(null);
    setShowPdfView(false);
  };

  const filteredClaims = claims.filter(pkg => {
    const matchesSearch =
      (pkg.claim_code || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.project_name || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.vendor_name || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.po_number || '')?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus ? (pkg.status || '').toUpperCase() === filterStatus.toUpperCase() : true;
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

  // Claim Detail View (Vendor View - matches second image)
  if (showDetailView && selectedClaim) {
    const lastEntry = selectedClaim.history && selectedClaim.history.length > 0
      ? selectedClaim.history[selectedClaim.history.length - 1]
      : null;

    return (
      <div className="container-fluid p-0" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        {/* Header */}
        <div className="bg-white border-bottom px-4 py-3 d-flex align-items-center justify-content-between" style={{ zIndex: 10 }}>
          <div className="d-flex align-items-center gap-3">
            <button
              onClick={handleBackFromDetail}
              className="btn btn-outline-secondary btn-sm rounded-circle px-2 py-1 border-0 bg-white shadow-sm"
            >
              <i className="bi bi-arrow-left"></i>
            </button>
            <div>
              <h5 className="mb-0 fw-bold text-dark">{selectedClaim.id}</h5>
              <span className="text-muted small">{selectedClaim.vendor} • {selectedClaim.project}</span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <StatusBadge status={selectedClaim.status} />
            <span className="text-muted small">
              Stage: {selectedClaim.currentStage}
            </span>
          </div>
        </div>

        {/* Main Content - Split Layout */}
        <div className="row g-0" style={{ height: 'calc(100vh - 80px)' }}>
          {/* Left - PDF Viewer (using PdfViewerPage embedded) */}
          <div className="col-12 col-lg-7" style={{ height: '100%', backgroundColor: '#ffffff' }}>
            {selectedClaim.fileUrl ? (
              <PdfViewerPage 
                claimId={selectedClaim.claimId}
                onBack={() => setShowPdfView(false)}
                embedded={true}
              />
            ) : (
              <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted p-5 text-center">
                <div className="bg-white p-4 rounded-circle shadow-sm mb-3">
                  <i className="bi bi-file-earmark-pdf fs-1 text-secondary"></i>
                </div>
                <h6 className="fw-bold text-dark mb-1">No Document Available</h6>
                <p className="small text-muted mb-0">No PDF document is attached to this claim.</p>
              </div>
            )}
          </div>

          {/* Right - Claim Details */}
          <div className="col-12 col-lg-5" style={{ height: '100%', overflowY: 'auto', backgroundColor: '#ffffff' }}>
            <div className="p-4">
              {/* Claim Overview */}
              <div className="mb-4">
                <h6 className="fw-bold text-dark mb-3" style={{ fontSize: '0.85rem' }}>
                  CLAIM OVERVIEW
                </h6>
                <div className="bg-light rounded-3 p-3">
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted small">Vendor</span>
                    <span className="fw-semibold small">{selectedClaim.vendor}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-top">
                    <span className="text-muted small">Project</span>
                    <span className="fw-semibold small">{selectedClaim.project}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-top">
                    <span className="text-muted small">PO Reference</span>
                    <span className="fw-semibold small">{selectedClaim.poReference}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-top">
                    <span className="text-muted small">PO Number</span>
                    <span className="fw-semibold small">{selectedClaim.poNumber}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-top">
                    <span className="text-muted small">Package</span>
                    <span className="fw-semibold small">{selectedClaim.package}</span>
                  </div>
                  {selectedClaim.submissionNote && (
                    <div className="mt-2 pt-2 border-top">
                      <span className="text-muted small">Submission Note</span>
                      <p className="mb-0 small mt-1">{selectedClaim.submissionNote}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Officer Review Decision */}
              <div className="mb-4">
                <h6 className="fw-bold text-dark mb-3" style={{ fontSize: '0.85rem' }}>
                  OFFICER REVIEW DECISION
                </h6>
                <div className="bg-light rounded-3 p-3 text-center text-muted">
                  <i className="bi bi-info-circle me-2"></i>
                  No pending approval actions required for your role at this stage.
                </div>
              </div>

              {/* Attachments */}
              <div className="mb-4">
                <h6 className="fw-bold text-dark mb-3" style={{ fontSize: '0.85rem' }}>
                  ATTACHMENTS
                </h6>
                <div className="bg-light rounded-3 p-3">
                  {selectedClaim.fileName && (
                    <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-file-earmark-pdf text-danger"></i>
                        <div>
                          <div className="fw-semibold small">{selectedClaim.fileName}</div>
                          <div className="text-muted small">{selectedClaim.fileSize}</div>
                        </div>
                      </div>
                      {selectedClaim.fileUrl && (
                        <button
                          onClick={() => {
                            // This will open the PDF in a new tab using the full PdfViewerPage
                            window.open(`/pdf-viewer/${selectedClaim.claimId}`, '_blank');
                          }}
                          className="btn btn-sm btn-outline-primary"
                        >
                          <i className="bi bi-box-arrow-up-right me-1"></i> View
                        </button>
                      )}
                    </div>
                  )}
                  <div className="text-muted small">
                    <i className="bi bi-info-circle me-1"></i>
                    File upload is disabled in view-only mode
                  </div>
                </div>
              </div>

              {/* Workflow Audit Trail */}
              <div>
                <h6 className="fw-bold text-dark mb-3" style={{ fontSize: '0.85rem' }}>
                  WORKFLOW AUDIT TRAIL
                </h6>
                <div className="bg-light rounded-3 p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {selectedClaim.history && selectedClaim.history.length > 0 ? (
                    selectedClaim.history.map((log, index) => {
                      const actionText = log.action_label || log.action || 'Action';
                      const actorName = log.performed_by_name || log.actor || 'Unknown';
                      const actorRole = log.performed_by_role_name || log.role || '';
                      const dateText = log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : (log.date || '');
                      const remarksText = log.remarks;

                      return (
                        <div key={log.id || index} className="mb-3 pb-3 border-bottom border-light">
                          <div className="fw-bold small text-dark">{actionText}</div>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted small">
                              {actorName}{actorRole ? ` • ${actorRole}` : ''}
                            </span>
                            <span className="text-muted small">{dateText}</span>
                          </div>
                          {remarksText && (
                            <div className="small text-muted mt-1">"{remarksText}"</div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-muted py-3">
                      <i className="bi bi-inbox fs-4 d-block mb-2"></i>
                      No activity history available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <h3 className="mb-1 fw-bold text-primary">
            <i className="bi bi-file-earmark-text me-2"></i>
            My Claims
          </h3>
          <p className="text-muted small mb-0">
            View and manage all your submitted claims
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-primary"
            onClick={() => navigate('/vendor/claims/create')}
          >
            <i className="bi bi-plus-circle me-1"></i>
            Create New Claim
          </button>
          <button
            className="btn btn-outline-primary"
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
              <h6 className="text-muted mb-0">Total Claims</h6>
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
                  placeholder="Search by claim code, project, PO, or vendor..."
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
                <option value="SENT_BACK">Sent Back</option>
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

      {/* Claims Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th className="px-4 py-3 text-secondary fw-semibold">Claim Code</th>
                  <th className="py-3 text-secondary fw-semibold">PO Number</th>
                  <th className="py-3 text-secondary fw-semibold">Project</th>
                  <th className="py-3 text-secondary fw-semibold">Status</th>
                  <th className="py-3 text-secondary fw-semibold">Current Step</th>
                  <th className="py-3 text-secondary fw-semibold">Created</th>
                  <th className="px-4 py-3 text-end text-secondary fw-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="text-muted">
                        <i className="bi bi-inbox fs-1 d-block mx-auto mb-3 opacity-25"></i>
                        <p className="mb-0 fw-semibold">No claims found</p>
                        <small>Create your first claim by clicking the "Create New Claim" button</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((pkg) => {
                    const pkgId = pkg?.id || pkg?.claim_id || pkg?.ID;
                    return (
                      <tr key={pkgId} className="border-bottom">
                        <td className="px-4 py-3">
                          <span className="fw-semibold text-primary">{pkg.claim_code || 'N/A'}</span>
                        </td>
                        <td className="py-3">
                          <span className="badge bg-light text-dark">{pkg.po_number || 'N/A'}</span>
                        </td>
                        <td className="py-3">{pkg.project_name || 'N/A'}</td>
                        <td className="py-3"><StatusBadge status={pkg.status} /></td>
                        <td className="py-3">
                          <span className="badge bg-info bg-opacity-10 text-info">
                            {pkg.current_step_name || pkg.current_step?.step_name || 'Not Started'}
                          </span>
                        </td>
                        <td className="py-3">
                          {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleViewClaim(pkg)}
                            disabled={loadingItemId === pkgId || !pkgId}
                          >
                            {loadingItemId === pkgId ? (
                              <span className="spinner-border spinner-border-sm me-1"></span>
                            ) : (
                              <i className="bi bi-eye me-1"></i>
                            )}
                            View
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
    </div>
  );
}