// src/pages/ClaimDetail.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsService } from '../services';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './Inbox';

const ACTIONS = {
  forward: { label: 'Forward', verb: 'forward', tone: 'primary', icon: 'bi-arrow-right-circle' },
  sendback: { label: 'Send Back', verb: 'sendback', tone: 'danger', icon: 'bi-arrow-left-circle' },
  resubmit: { label: 'Re-submit', verb: 'resubmit', tone: 'success', icon: 'bi-arrow-counterclockwise' },
};

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const [pkg, setPkg] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [remarks, setRemarks] = useState('');
  const [activeAction, setActiveAction] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const load = useCallback(async () => {
    if (!id) {
      setError('No claim ID provided');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const claimData = await claimsService.get(id, { includeDetails: true });
      
      let claim = null;
      if (claimData) {
        if (Array.isArray(claimData) && claimData.length > 0) {
          claim = claimData[0];
        } else if (typeof claimData === 'object' && claimData.claim_code) {
          claim = claimData;
        } else if (claimData.data) {
          claim = claimData.data;
        } else {
          claim = claimData;
        }
      }
      
      if (!claim) {
        setError('Claim data not found');
        setLoading(false);
        return;
      }
      
      setPkg(claim);
      
      try {
        const historyData = await claimsService.getHistory(id);
        let historyArray = [];
        if (Array.isArray(historyData)) {
          historyArray = historyData;
        } else if (historyData?.data && Array.isArray(historyData.data)) {
          historyArray = historyData.data;
        } else if (historyData && typeof historyData === 'object' && historyData.id) {
          historyArray = [historyData];
        }
        setHistory(historyArray);
      } catch (historyErr) {
        console.warn('Could not fetch history:', historyErr);
        setHistory([]);
      }
      
    } catch (err) {
      console.error('❌ ClaimDetail load error:', err);
      setError(err.message || 'Failed to load claim.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      load();
    } else {
      setError('No claim ID provided');
      setLoading(false);
    }
  }, [id, load]);

  async function submitAction(e) {
    e.preventDefault();
    if (remarks.trim().length < 3) {
      setActionError('Remarks must be at least 3 characters.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      if (activeAction === 'forward') {
        await claimsService.forward(id, remarks.trim());
        setSuccessMessage('Claim forwarded successfully!');
      } else if (activeAction === 'sendback') {
        await claimsService.sendback(id, remarks.trim());
        setSuccessMessage('Claim sent back successfully!');
      } else if (activeAction === 'resubmit') {
        await claimsService.resubmit(id, remarks.trim());
        setSuccessMessage('Claim resubmitted successfully!');
      }
      setRemarks('');
      setActiveAction(null);
      await load();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Action error:', err);
      setActionError(err.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setActionError('');
    try {
      await claimsService.uploadFile(id, file);
      setFile(null);
      setSuccessMessage('File uploaded successfully!');
      await load();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Upload error:', err);
      setActionError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId) {
    if (!confirm('Remove this file?')) return;
    try {
      await claimsService.deleteFile(id, fileId);
      setSuccessMessage('File deleted successfully!');
      await load();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Delete error:', err);
      setActionError(err.message || 'Could not delete file.');
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" style={{ width: '2.5rem', height: '2.5rem' }} role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
          <p className="mt-3 text-secondary fw-semibold">Loading claim review workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="container py-5">
        <div className="card shadow-sm border-0">
          <div className="card-body p-4 text-center">
            <i className="bi bi-exclamation-triangle text-warning fs-1 mb-2"></i>
            <h5>Claim Unavailable</h5>
            <p className="text-muted small">{error || 'The requested claim could not be found.'}</p>
            <button className="btn btn-primary btn-sm px-4 mt-2" onClick={() => navigate(-1)}>
              <i className="bi bi-arrow-left me-1"></i> Back to Desk
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isVendor = user?.role_name === 'Vendor' || user?.role_rank === 10;
  const isAdmin = user?.role_rank === 100;
  const canUpload = isVendor || isAdmin;
  const canForward = hasPermission('claim.forward') || isAdmin;
  const canSendback = hasPermission('claim.sendback') || isAdmin;
  const canResubmit = isVendor && pkg.status?.toUpperCase() === 'SENT_BACK';

  // Find attached PDF file
  const pdfFile = (pkg.files || []).find((f) =>
    f.original_name?.toLowerCase().endsWith('.pdf') || f.file_type?.includes('pdf')
  ) || (pkg.files && pkg.files[0]);

  const pdfUrl = pdfFile
    ? `/api/claims/${id}/files/${pdfFile.id}/download`
    : pkg.file_url || null;

  return (
    <div className="d-flex flex-column vh-100 bg-body-tertiary overflow-hidden">
      
      {/* Workspace Navigation Header */}
      <header className="bg-white border-bottom px-4 py-2.5 d-flex justify-content-between align-items-center shadow-sm z-2">
        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-sm btn-outline-secondary font-semibold d-flex align-items-center" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left me-1"></i> Back
          </button>
          <span className="vr"></span>
          <div>
            <span className="text-muted small d-block" style={{ fontSize: '0.7rem', lineHeight: '1' }}>CLAIM ID</span>
            <strong className="text-dark fs-6">{pkg.claim_code || 'Claim Review'}</strong>
          </div>
          <StatusBadge status={pkg.status} />
          <span className="badge bg-light text-dark border fw-medium px-2 py-1">
            Stage: {pkg.current_step_name || pkg.current_step?.step_name || 'In Review'}
          </span>
        </div>

        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-primary fw-semibold d-flex align-items-center"
          >
            <span>Expand Document</span>
            <i className="bi bi-box-arrow-up-right ms-2"></i>
          </a>
        )}
      </header>

      {/* Workspace Main Grid Layout */}
      <div className="d-flex flex-grow-1 overflow-hidden">
        
        {/* Left Pane: Embedded PDF Viewer (60% width) */}
        <div className="border-end bg-secondary-subtle d-flex flex-column h-100" style={{ flex: '0 0 60%', width: '60%' }}>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Bill PDF Preview"
              className="w-100 h-100 border-0"
            />
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted p-5 text-center">
              <div className="bg-white p-4 rounded-circle shadow-sm mb-3">
                <i className="bi bi-file-earmark-pdf fs-1 text-secondary"></i>
              </div>
              <h6 className="fw-bold text-dark mb-1">No Document Available</h6>
              <p className="small text-muted mb-0">No PDF bill preview is attached to this claim.</p>
            </div>
          )}
        </div>

        {/* Right Pane: Summary, Officer Actions & History (40% width) */}
        <div className="bg-white d-flex flex-column h-100 overflow-y-auto p-4" style={{ flex: '0 0 40%', width: '40%' }}>
          
          {successMessage && (
            <div className="alert alert-success alert-dismissible fade show border-0 shadow-sm py-2 px-3 mb-3 small">
              <i className="bi bi-check-circle-fill me-2"></i>
              {successMessage}
              <button type="button" className="btn-close py-2" onClick={() => setSuccessMessage('')}></button>
            </div>
          )}

          {actionError && (
            <div className="alert alert-danger alert-dismissible fade show border-0 shadow-sm py-2 px-3 mb-3 small">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {actionError}
              <button type="button" className="btn-close py-2" onClick={() => setActionError('')}></button>
            </div>
          )}

          {/* Section 1: Claim Information Card */}
          <div className="card border shadow-sm mb-3">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2.5 border-bottom pb-2">
                <h6 className="card-subtitle text-uppercase text-secondary fw-bold small mb-0">
                  <i className="bi bi-card-heading me-1.5 text-primary"></i>
                  Claim Overview
                </h6>
                {pkg.amount && (
                  <span className="fw-bold text-success fs-6">
                    ₹{Number(pkg.amount).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <div className="row g-2 text-sm">
                <div className="col-6">
                  <span className="text-muted d-block small" style={{ fontSize: '0.75rem' }}>Vendor</span>
                  <strong className="text-dark d-block text-truncate">{pkg.vendor_name || pkg.vendor?.vendor_name || 'N/A'}</strong>
                </div>
                <div className="col-6">
                  <span className="text-muted d-block small" style={{ fontSize: '0.75rem' }}>Project</span>
                  <strong className="text-dark d-block text-truncate">{pkg.project_name || pkg.project?.project_name || 'N/A'}</strong>
                </div>
                <div className="col-6">
                  <span className="text-muted d-block small" style={{ fontSize: '0.75rem' }}>PO Reference</span>
                  <span className="text-dark fw-medium">{pkg.po_number || 'N/A'}</span>
                </div>
                <div className="col-6">
                  <span className="text-muted d-block small" style={{ fontSize: '0.75rem' }}>Workflow</span>
                  <span className="text-dark fw-medium text-truncate d-block">{pkg.workflow_name || pkg.workflow?.workflow_name || 'N/A'}</span>
                </div>
                {pkg.remarks && (
                  <div className="col-12 border-top pt-2 mt-1">
                    <span className="text-muted d-block small" style={{ fontSize: '0.75rem' }}>Submission Note</span>
                    <p className="text-dark small mb-0 bg-light p-2 rounded border">{pkg.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Officer Review Panel */}
          <div className="card border border-primary-subtle shadow-sm mb-3 bg-body-highlight">
            <div className="card-body p-3">
              <h6 className="card-subtitle text-uppercase text-primary fw-bold mb-3 small d-flex align-items-center">
                <i className="bi bi-shield-check fs-6 me-1.5"></i>
                Officer Review Decision
              </h6>

              {!activeAction ? (
                <div className="d-grid gap-2">
                  {canForward && pkg.status?.toUpperCase() !== 'COMPLETED' && (
                    <button 
                      type="button"
                      className="btn btn-primary fw-semibold py-2 d-flex align-items-center justify-content-center gap-2"
                      onClick={() => setActiveAction('forward')}
                    >
                      <i className="bi bi-arrow-right-circle fs-6"></i>
                      <span>Forward to Next Step</span>
                    </button>
                  )}
                  {canSendback && pkg.status?.toUpperCase() !== 'COMPLETED' && (
                    <button 
                      type="button"
                      className="btn btn-outline-danger fw-semibold py-2 d-flex align-items-center justify-content-center gap-2"
                      onClick={() => setActiveAction('sendback')}
                    >
                      <i className="bi bi-arrow-left-circle fs-6"></i>
                      <span>Send Back</span>
                    </button>
                  )}
                  {canResubmit && (
                    <button 
                      type="button"
                      className="btn btn-success fw-semibold py-2 d-flex align-items-center justify-content-center gap-2"
                      onClick={() => setActiveAction('resubmit')}
                    >
                      <i className="bi bi-arrow-counterclockwise fs-6"></i>
                      <span>Re-submit Claim</span>
                    </button>
                  )}
                  {!canForward && !canSendback && !canResubmit && (
                    <div className="alert alert-info mb-0 small py-2">
                      <i className="bi bi-info-circle me-1"></i>
                      No pending approval actions required for your role at this stage.
                    </div>
                  )}
                  {pkg.status?.toUpperCase() === 'COMPLETED' && (
                    <div className="alert alert-success mb-0 small py-2">
                      <i className="bi bi-check-circle-fill me-1"></i>
                      This claim has completed the full verification pipeline.
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={submitAction} className="d-flex flex-column gap-2">
                  <div>
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Officer Remarks <span className="text-danger">*</span> 
                      <span className="badge bg-secondary-subtle text-dark ms-1 font-normal">
                        {ACTIONS[activeAction].label}
                      </span>
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      minLength={3}
                      required
                      autoFocus
                      placeholder={`Enter notes for ${ACTIONS[activeAction].label.toLowerCase()}...`}
                    />
                  </div>
                  <div className="d-flex gap-2 pt-1">
                    <button
                      type="submit"
                      className={`btn btn-sm btn-${ACTIONS[activeAction].tone} fw-bold flex-grow-1 py-1.5`}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className={`${ACTIONS[activeAction].icon} me-1`}></i>
                          Confirm {ACTIONS[activeAction].label}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-1.5 px-3"
                      onClick={() => {
                        setActiveAction(null);
                        setRemarks('');
                        setActionError('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Section 3: Document Attachments */}
          <div className="card border shadow-sm mb-3">
            <div className="card-body p-3">
              <h6 className="card-subtitle text-uppercase text-secondary fw-bold mb-2.5 small">
                <i className="bi bi-paperclip me-1.5 text-primary"></i>
                Attachments
              </h6>
              <ul className="list-group list-group-flush mb-2 border-top border-bottom">
                {(pkg.files || []).map((f) => (
                  <li key={f.id} className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                    <button
                      className="btn btn-link btn-sm p-0 text-start text-decoration-none d-flex align-items-center"
                      onClick={() => claimsService.downloadFile(id, f.id, f.original_name)}
                    >
                      <i className="bi bi-file-earmark-pdf text-danger fs-6 me-2"></i>
                      <span className="fw-medium text-dark text-truncate" style={{ maxWidth: '180px' }}>
                        {f.original_name}
                      </span>
                      <span className="text-muted ms-2 small" style={{ fontSize: '0.7rem' }}>
                        ({(f.file_size ? (f.file_size / 1024).toFixed(1) : '0')} KB)
                      </span>
                    </button>
                    {(isAdmin || isVendor) && (
                      <button 
                        className="btn btn-sm btn-outline-danger py-0 px-1" 
                        onClick={() => handleDeleteFile(f.id)}
                        title="Delete file"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </li>
                ))}
                {(!pkg.files || pkg.files.length === 0) && (
                  <li className="list-group-item px-0 text-muted small py-2">No files attached to this claim.</li>
                )}
              </ul>

              {canUpload && (
                <form className="d-flex gap-2" onSubmit={handleUpload}>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <button className="btn btn-sm btn-primary text-nowrap" disabled={!file || uploading}>
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Section 4: Audit & Action History */}
          <div className="card border shadow-sm">
            <div className="card-body p-3">
              <h6 className="card-subtitle text-uppercase text-secondary fw-bold mb-3 small">
                <i className="bi bi-clock-history me-1.5 text-primary"></i>
                Workflow Audit Trail
              </h6>
              {history.length === 0 ? (
                <p className="text-muted small mb-0">No audit activity logged yet.</p>
              ) : (
                <div className="timeline">
                  {history.map((h, index) => (
                    <div key={h.id || index} className="mb-2.5 pb-2 border-bottom">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold small">
                          <span className="badge bg-secondary me-1.5">{h.action}</span>
                          {h.from_step_name && <span className="text-muted">{h.from_step_name} → </span>}
                          {h.to_step_name && <span className="text-dark">{h.to_step_name}</span>}
                        </span>
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                          {h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                        By: <span className="text-dark fw-medium">{h.performed_by_name || h.performed_by || 'Officer'}</span>
                      </div>
                      {h.remarks && (
                        <div className="small mt-1 bg-light p-2 rounded text-secondary border" style={{ fontSize: '0.75rem' }}>
                          <i className="bi bi-chat-left-quote me-1"></i>
                          {h.remarks}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}