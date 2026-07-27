// src/pages/ClaimDetail.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsService } from '../services';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './Inbox';

const ACTIONS = {
  forward: { label: 'Forward', verb: 'forward', tone: 'primary', icon: 'bi-arrow-right' },
  sendback: { label: 'Send back', verb: 'sendback', tone: 'danger', icon: 'bi-arrow-left' },
  resubmit: { label: 'Re-submit', verb: 'resubmit', tone: 'success', icon: 'bi-arrow-counterclockwise' },
};

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  // Debug logging
  console.log('🏷️ ClaimDetail component mounted');
  console.log('📌 ID from params:', id);
  console.log('👤 User:', user?.email);

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
      console.log('🔍 Fetching claim with ID:', id);
      
      // Get claim details
      const claimData = await claimsService.get(id, { includeDetails: true });
      console.log('📦 Raw claimData from service:', claimData);
      
      // Handle different response formats
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
      
      console.log('✅ Processed claim:', claim);
      
      if (!claim) {
        setError('Claim data not found');
        setLoading(false);
        return;
      }
      
      setPkg(claim);
      
      // Get history
      try {
        const historyData = await claimsService.getHistory(id);
        console.log('📦 Raw historyData:', historyData);
        
        let historyArray = [];
        if (Array.isArray(historyData)) {
          historyArray = historyData;
        } else if (historyData?.data && Array.isArray(historyData.data)) {
          historyArray = historyData.data;
        } else if (historyData && typeof historyData === 'object') {
          if (historyData.id) {
            historyArray = [historyData];
          }
        }
        console.log('✅ History array:', historyArray);
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
    console.log('🔄 ClaimDetail useEffect running, id:', id);
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

  // Show loading state
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
        <p className="mt-3 text-muted">Loading claim details...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
        <button className="btn btn-outline-secondary" onClick={() => navigate('/vendor/claims')}>
          <i className="bi bi-arrow-left me-1"></i> Back to Claims
        </button>
      </div>
    );
  }

  // Show not found state
  if (!pkg) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Claim not found
        </div>
        <button className="btn btn-outline-secondary" onClick={() => navigate('/vendor/claims')}>
          <i className="bi bi-arrow-left me-1"></i> Back to Claims
        </button>
      </div>
    );
  }

  console.log('📦 Rendering claim details for:', pkg.claim_code);

  const isVendor = user?.role_name === 'Vendor' || user?.role_rank === 10;
  const isAdmin = user?.role_rank === 100;
  const canUpload = isVendor || isAdmin;
  const canForward = hasPermission('claim.forward') || isAdmin;
  const canSendback = hasPermission('claim.sendback') || isAdmin;
  const canResubmit = isVendor && pkg.status?.toUpperCase() === 'SENT_BACK';

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => navigate('/vendor/claims')}>
            <i className="bi bi-arrow-left"></i> Back
          </button>
          <h4 className="d-inline-block mb-1">{pkg.claim_code || 'N/A'}</h4>
          <div className="mt-1">
            <StatusBadge status={pkg.status} />
            <span className="ms-2 text-muted small">
              Step: {pkg.current_step_name || pkg.current_step?.step_name || 'Not Started'}
            </span>
          </div>
        </div>
        {isAdmin && (
          <span className="badge bg-primary">Admin View</span>
        )}
      </div>

      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show">
          <i className="bi bi-check-circle-fill me-2"></i>
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger alert-dismissible fade show">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {actionError}
          <button type="button" className="btn-close" onClick={() => setActionError('')}></button>
        </div>
      )}

      <div className="row g-4">
        <div className="col-md-7">
          {/* Details Card */}
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-subtitle text-muted mb-3">
                <i className="bi bi-info-circle me-1"></i>
                Details
              </h6>
              <dl className="row mb-0 small">
                <dt className="col-4">Claim Code</dt>
                <dd className="col-8">{pkg.claim_code || 'N/A'}</dd>
                <dt className="col-4">Vendor</dt>
                <dd className="col-8">{pkg.vendor_name || pkg.vendor?.vendor_name || 'N/A'}</dd>
                <dt className="col-4">Project</dt>
                <dd className="col-8">{pkg.project_name || pkg.project?.project_name || 'N/A'}</dd>
                <dt className="col-4">PO Number</dt>
                <dd className="col-8">{pkg.po_number || 'N/A'}</dd>
                <dt className="col-4">Workflow</dt>
                <dd className="col-8">{pkg.workflow_name || pkg.workflow?.workflow_name || 'N/A'}</dd>
                <dt className="col-4">Current Step</dt>
                <dd className="col-8">{pkg.current_step_name || pkg.current_step?.step_name || 'Not Started'}</dd>
                <dt className="col-4">Created</dt>
                <dd className="col-8">{pkg.created_at ? new Date(pkg.created_at).toLocaleString() : 'N/A'}</dd>
                {pkg.remarks && (
                  <>
                    <dt className="col-4">Remarks</dt>
                    <dd className="col-8">{pkg.remarks}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Files Card */}
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-subtitle text-muted mb-3">
                <i className="bi bi-file-earmark me-1"></i>
                Files
              </h6>
              <ul className="list-group list-group-flush mb-3">
                {(pkg.files || []).map((f) => (
                  <li key={f.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                    <button
                      className="btn btn-link btn-sm p-0 text-start"
                      onClick={() => claimsService.downloadFile(id, f.id, f.original_name)}
                    >
                      <i className="bi bi-file-earmark me-1"></i>
                      {f.original_name}
                      <span className="text-muted ms-2" style={{ fontSize: '0.75rem' }}>
                        ({(f.file_size ? (f.file_size / 1024).toFixed(1) : '0')} KB)
                      </span>
                    </button>
                    {(isAdmin || isVendor) && (
                      <button 
                        className="btn btn-sm btn-outline-danger" 
                        onClick={() => handleDeleteFile(f.id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </li>
                ))}
                {(!pkg.files || pkg.files.length === 0) && (
                  <li className="list-group-item px-0 text-muted small">No files attached yet.</li>
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
                  <button className="btn btn-sm btn-primary" disabled={!file || uploading}>
                    {uploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1"></span>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cloud-upload me-1"></i>
                        Upload
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-muted mb-3">
                <i className="bi bi-clock-history me-1"></i>
                Timeline
              </h6>
              {history.length === 0 ? (
                <p className="text-muted small">No history yet.</p>
              ) : (
                <div className="timeline">
                  {history.map((h, index) => (
                    <div key={h.id || index} className="mb-3 pb-3 border-bottom">
                      <div className="d-flex justify-content-between">
                        <span className="fw-medium">
                          <span className="badge bg-secondary me-2">{h.action}</span>
                          {h.from_step_name && (
                            <>
                              <span className="text-muted small">from</span> {h.from_step_name}
                              <i className="bi bi-arrow-right mx-1"></i>
                            </>
                          )}
                          {h.to_step_name && <span>{h.to_step_name}</span>}
                        </span>
                        <span className="text-muted small">
                          {h.created_at ? new Date(h.created_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="small text-muted">
                        by {h.performed_by_name || h.performed_by || 'Unknown'}
                      </div>
                      {h.remarks && (
                        <div className="small mt-1 bg-light p-2 rounded">
                          <i className="bi bi-chat me-1"></i>
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

        <div className="col-md-5">
          {/* Actions Card */}
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-muted mb-3">
                <i className="bi bi-gear me-1"></i>
                Actions
              </h6>

              {!activeAction ? (
                <div className="d-flex flex-column gap-2">
                  {canForward && pkg.status?.toUpperCase() !== 'COMPLETED' && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => setActiveAction('forward')}
                    >
                      <i className="bi bi-arrow-right me-1"></i>
                      Forward to Next Step
                    </button>
                  )}
                  {canSendback && pkg.status?.toUpperCase() !== 'COMPLETED' && (
                    <button 
                      className="btn btn-outline-danger"
                      onClick={() => setActiveAction('sendback')}
                    >
                      <i className="bi bi-arrow-left me-1"></i>
                      Send Back
                    </button>
                  )}
                  {canResubmit && (
                    <button 
                      className="btn btn-success"
                      onClick={() => setActiveAction('resubmit')}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1"></i>
                      Re-submit Claim
                    </button>
                  )}
                  {!canForward && !canSendback && !canResubmit && (
                    <div className="alert alert-info mb-0">
                      <i className="bi bi-info-circle me-1"></i>
                      No actions available for your role at this step.
                    </div>
                  )}
                  {pkg.status?.toUpperCase() === 'COMPLETED' && (
                    <div className="alert alert-success mb-0">
                      <i className="bi bi-check-circle-fill me-1"></i>
                      This claim has been completed.
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={submitAction}>
                  <label className="form-label small">
                    Remarks <span className="text-danger">*</span> 
                    <span className="text-muted ms-1">({ACTIONS[activeAction].label})</span>
                  </label>
                  <textarea
                    className="form-control mb-2"
                    rows={4}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    minLength={3}
                    required
                    autoFocus
                    placeholder="Enter your remarks (minimum 3 characters)..."
                  />
                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className={`btn btn-${ACTIONS[activeAction].tone}`}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1"></span>
                          Submitting...
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
                      className="btn btn-outline-secondary"
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

          {/* Claim Info Card */}
          <div className="card mt-3">
            <div className="card-body">
              <h6 className="card-subtitle text-muted mb-2">
                <i className="bi bi-tag me-1"></i>
                Claim Info
              </h6>
              <div className="small">
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Status:</span>
                  <span><StatusBadge status={pkg.status} /></span>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span className="text-muted">Current Step:</span>
                  <span>{pkg.current_step_name || pkg.current_step?.step_name || 'N/A'}</span>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span className="text-muted">Total Files:</span>
                  <span>{(pkg.files || []).length}</span>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span className="text-muted">Total Actions:</span>
                  <span>{history.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}