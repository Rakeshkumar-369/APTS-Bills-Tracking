// src/pages/MyClaims.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsService } from '../services';
import { useAuth } from '../context/AuthContext';
import SubmissionAudit from './SubmissionAudit';
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

  // --- inline claim view state (no more navigating to /claims/:id) ---
  const [loadingItemId, setLoadingItemId] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showAuditView, setShowAuditView] = useState(false);
  const [actionRemarks, setActionRemarks] = useState('');
  const [showPdfView, setShowPdfView] = useState(false);
  const [pdfclaimId, setPdfclaimId] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const SERVER_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

  const toAbsoluteUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path.replace(/\\/g, '/');
    let normalized = path.replace(/\\/g, '/');
    normalized = normalized.replace(/^\/?/, '/');
    return `${SERVER_ORIGIN}${normalized}`;
  };

  useEffect(() => {
    if (user) {
      fetchClaims();
    }
  }, [user]);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const vendorId = user?.vendor_id || user?.id;
      console.log('🔍 Fetching claims for vendorId:', vendorId);

      const data = await claimsService.list({ vendor_id: vendorId });
      console.log('✅ Claims data:', data);
      console.log('📊 Total claims:', data?.length);

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

  // Fetches claim details and shows them inline (no route change, no remount)
  const handleViewClaim = async (item) => {
    const pkgId = item?.id || item?.claim_id || item?.ID;
    if (!pkgId) {
      console.error('No claim ID found in item:', item);
      alert('Unable to get claim ID');
      return;
    }
    setLoadingItemId(pkgId);
    try {
      const details = await claimsService.get(pkgId, { includeDetails: true });
      let fileUrl = null;
      let fileName = 'document.pdf';
      let fileSize = 'N/A';

      if (details?.files && details.files.length > 0) {
        const file = details.files[0];
        fileName = file.original_name || file.filename || 'document.pdf';
        fileSize = file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'N/A';
        if (file.id) {
          fileUrl = `${API_BASE}/claims/${pkgId}/files/${file.id}/download`;
        } else {
          const rawUrl = file.url || file.file_path || file.download_url || file.public_url || null;
          fileUrl = toAbsoluteUrl(rawUrl);
        }
      }
      if (!fileUrl && details?.file_url) fileUrl = toAbsoluteUrl(details.file_url);
      if (!fileUrl && details?.attachment_url) fileUrl = toAbsoluteUrl(details.attachment_url);
      if (!fileUrl && details?.document_url) fileUrl = toAbsoluteUrl(details.document_url);

      const submissionData = {
        id: details?.claim_code || details?.claimCode || pkgId,
        claimId: pkgId,
        vendor: details?.vendor_name || details?.vendor || 'N/A',
        projectType: details?.project_name || details?.project?.project_name || 'N/A',
        fileName,
        fileSize,
        fileUrl,
        history: details?.history || [
          { actor: 'Vendor', date: new Date(details?.created_at).toLocaleString(), action: 'claim Created', remarks: 'Initial submission' }
        ],
        status: details?.status || 'PENDING'
      };

      setSelectedSubmission(submissionData);
      setShowAuditView(true);
      setActionRemarks('');
    } catch (err) {
      console.error('❌ Error fetching claim details:', err);
      const fallbackData = {
        id: item?.claim_code || item?.claimCode || pkgId,
        claimId: pkgId,
        vendor: item?.vendor_name || item?.vendor || 'N/A',
        projectType: item?.project_name || item?.project?.project_name || 'N/A',
        fileName: 'document.pdf',
        fileSize: 'N/A',
        fileUrl: null,
        history: [{ actor: 'System', date: new Date().toLocaleString(), action: 'claim Retrieved', remarks: 'Basic view' }],
        status: item?.status || 'PENDING'
      };
      setSelectedSubmission(fallbackData);
      setShowAuditView(true);
      setActionRemarks('');
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleOpenPdf = (submission) => {
    if (!submission.fileUrl) {
      alert('No document available for this claim');
      return;
    }
    if (!submission.claimId) {
      alert('Unable to determine claim ID for this document');
      return;
    }
    setPdfclaimId(submission.claimId);
    setShowPdfView(true);
  };

  const handleBackFromAudit = () => {
    setShowAuditView(false);
    setSelectedSubmission(null);
    setActionRemarks('');
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
          <button
            className="btn btn-outline-danger ms-3"
            onClick={fetchClaims}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Inline PDF view
  if (showPdfView && pdfclaimId) {
    return (
      <PdfViewerPage
        claimId={pdfclaimId}
        onBack={() => setShowPdfView(false)}
      />
    );
  }

  // Inline Audit view (this replaces the old navigate-to-/claims/:id behavior)
  if (showAuditView && selectedSubmission) {
    const daysElapsed = Math.floor(Math.random() * 10) + 1;
    return (
      <div className="container-fluid p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <SubmissionAudit
          submission={selectedSubmission}
          daysElapsed={daysElapsed}
          actionRemarks={actionRemarks}
          onRemarksChange={setActionRemarks}
          onBack={handleBackFromAudit}
          onOpenPdf={handleOpenPdf}
          onSendBack={null}
          onForward={null}
          hasDigitalSignature={false}
        />
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
                          <div className="d-flex gap-1 justify-content-end flex-wrap">
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
                            {pkg.status?.toUpperCase() === 'SENT_BACK' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => navigate(`/vendor/claims/${pkgId}/resubmit`)}
                              >
                                <i className="bi bi-arrow-counterclockwise me-1"></i> Resubmit
                              </button>
                            )}
                          </div>
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