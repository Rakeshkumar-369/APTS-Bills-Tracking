// src/pages/ClaimDetail.jsx
import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { claimsService, usersService } from '../services';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { decodeEntities, formatDate, formatINR } from '../utils/text';

// PDF.js is large — only download it when a claim is actually opened
const PdfViewerPage = lazy(() => import('./PdfViewerPage'));

const ACTION_LABELS = {
  CREATE: 'Submitted',
  FORWARD: 'Forwarded',
  SENDBACK: 'Sent back',
  RESUBMIT: 'Re-submitted',
  PULL_BACK: 'Pulled back',
  COMPLETE: 'Approved & completed',
  REJECT: 'Rejected',
};
const ACTION_BADGE = {
  CREATE: 'text-bg-primary',
  FORWARD: 'text-bg-info',
  SENDBACK: 'text-bg-danger',
  RESUBMIT: 'text-bg-warning',
  PULL_BACK: 'text-bg-secondary',
  COMPLETE: 'text-bg-success',
};

function RemarksAction({ id, label, placeholder, value, onChange, onSubmit, submitting, buttonClass, buttonIcon, buttonText, children }) {
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor={id} className="form-label small fw-semibold text-dark mb-1">
        {label} <span className="text-danger">*</span>
      </label>
      {children}
      <textarea
        id={id}
        className="form-control form-control-sm mb-2"
        rows={2}
        maxLength={500}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={submitting}
      />
      <button type="submit" className={`btn btn-sm w-100 ${buttonClass}`} disabled={submitting}>
        {submitting
          ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          : <><i className={`bi ${buttonIcon} me-1`}></i>{buttonText}</>}
      </button>
    </form>
  );
}

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission } = useAuth();

  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [officers, setOfficers] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  // One remarks box per action so text typed for one action never leaks into another
  const [remarks, setRemarks] = useState({ approve: '', forward: '', sendback: '', assign: '', pullback: '' });
  const [busy, setBusy] = useState(null); // name of the action in flight
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState(location.state?.flash || '');

  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState('INVOICE');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const claim = await claimsService.get(id, { includeDetails: true });
      if (!claim) throw new Error('Claim data not found');
      setPkg(claim);
    } catch (err) {
      setError(err.status === 404 ? 'This claim does not exist or you do not have access to it.' : err.message || 'Failed to load claim.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const t = setTimeout(() => setSuccessMessage(''), 5000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // --- Derived state ---
  const history = pkg?.history || [];
  const isVendor = user?.role_name === 'Vendor';
  const isAptsManager = user?.role_name === 'APTS Manager';
  const isPm = user?.role_name === 'PM'; // PM is the first desk — no send-back action (team decision)
  const isCompleted = pkg?.status === 'COMPLETED';
  const isReturned = pkg?.status === 'SENT_BACK';
  const isWorkflowMode = Boolean(pkg?.workflow_id);
  const isManual = !isWorkflowMode;

  const isMyWorkflowStep = isWorkflowMode && !isCompleted && !isReturned &&
    pkg?.current_step_role_id != null && pkg.current_step_role_id === user?.role_id;
  const isClaimWithMeManual = isManual && !isCompleted && pkg?.current_assigned_user_id === user?.id;
  const isOfficerTurn = isMyWorkflowStep || (isClaimWithMeManual && !isVendor);

  const canApproveComplete = isOfficerTurn && isAptsManager;
  const canForward = isMyWorkflowStep && !isAptsManager;
  const canAssign = isClaimWithMeManual && !(isVendor && isReturned);
  const canSendBackManual = isClaimWithMeManual && !isVendor && !isAptsManager && !isPm;
  const canSendBackWorkflow = isMyWorkflowStep && !isPm;
  const canResubmit = isVendor && isReturned;

  const lastHistory = history.length > 0 ? history[history.length - 1] : null;
  const claimWithVendorNow = isReturned || (isManual && pkg?.current_assigned_user_id === pkg?.created_by);
  const canPullBack = isVendor && !isCompleted && !claimWithVendorNow &&
    lastHistory && lastHistory.from_user_id === user?.id && ['CREATE', 'FORWARD', 'RESUBMIT'].includes(lastHistory.action);

  const canEditFiles = !isCompleted && (
    hasPermission('claim.update') || (isVendor && claimWithVendorNow)
  );

  useEffect(() => {
    if (canAssign && officers.length === 0) {
      usersService.getOfficers().then((data) => setOfficers(data || [])).catch(() => setOfficers([]));
    }
  }, [canAssign, officers.length]);

  // --- Actions ---
  const setRemark = (key) => (value) => setRemarks((r) => ({ ...r, [key]: value }));

  const runAction = async (key, fn, message, { confirmText } = {}) => {
    const text = (remarks[key] || '').trim();
    if (text.length < 3) {
      setActionError('Remarks must be at least 3 characters.');
      return;
    }
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setActionError('');
    try {
      await fn(text);
      setSuccessMessage(message);
      setRemarks((r) => ({ ...r, [key]: '' }));
      await load({ silent: true });
    } catch (err) {
      setActionError(err.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (key, fn, message, opts) => (e) => {
    e.preventDefault();
    runAction(key, fn, message, opts);
  };

  async function handleAssign(e) {
    e.preventDefault();
    if (!selectedOfficerId) {
      setActionError('Please select an officer.');
      return;
    }
    await runAction('assign', (text) => claimsService.assign(id, Number(selectedOfficerId), text), 'Claim assigned successfully.');
    setSelectedOfficerId('');
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy('upload');
    setActionError('');
    try {
      await claimsService.uploadFile(id, file, docType);
      setFile(null);
      e.target.reset();
      setSuccessMessage('File uploaded successfully.');
      await load({ silent: true });
    } catch (err) {
      setActionError(err.message || 'Upload failed.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteFile(fileId) {
    if (!window.confirm('Remove this file?')) return;
    setActionError('');
    try {
      await claimsService.deleteFile(id, fileId);
      setSuccessMessage('File removed.');
      await load({ silent: true });
    } catch (err) {
      setActionError(err.message || 'Could not delete file.');
    }
  }

  async function handleDownload(f) {
    try {
      await claimsService.downloadFile(id, f.id, decodeEntities(f.original_name));
    } catch (err) {
      setActionError(err.message || 'Download failed.');
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
          <p className="mt-3 text-secondary fw-semibold">Loading claim...</p>
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
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const files = pkg.files || [];
  const hasActions = canApproveComplete || canForward || canSendBackWorkflow || canAssign || canSendBackManual || canPullBack || canResubmit;
  const stageLabel = isReturned ? 'With vendor for revision' : decodeEntities(pkg.current_step_name) || (isManual ? 'Not yet assigned' : 'In review');

  return (
    <div className="claim-detail d-flex flex-column bg-body-tertiary">
      <header className="bg-white border-bottom px-3 px-md-4 py-2 d-flex flex-wrap gap-2 justify-content-between align-items-center shadow-sm">
        <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left me-1"></i> Back
          </button>
          <div>
            <span className="text-muted d-block" style={{ fontSize: '0.7rem', lineHeight: 1 }}>CLAIM ID</span>
            <strong className="text-dark">{pkg.claim_code}</strong>
          </div>
          <StatusBadge status={pkg.status} />
          <span className="badge bg-light text-dark border fw-medium">Stage: {stageLabel}</span>
        </div>
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => window.open(`/pdf-viewer/${id}`, '_blank', 'noopener,noreferrer')}
            className="btn btn-sm btn-outline-primary fw-semibold d-none d-md-inline-flex align-items-center"
          >
            Open documents in new tab <i className="bi bi-box-arrow-up-right ms-2"></i>
          </button>
        )}
      </header>

      <div className="claim-detail-body d-flex flex-column flex-lg-row flex-grow-1">
        <section className="claim-doc-pane border-end bg-secondary-subtle d-flex flex-column" aria-label="Claim documents">
          <Suspense fallback={<div className="text-center py-5"><div className="spinner-border text-primary" role="status" /></div>}>
            <PdfViewerPage claimId={id} files={files} embedded />
          </Suspense>
        </section>

        <aside className="claim-side-pane bg-white p-3 p-md-4">
          {successMessage && (
            <div className="alert alert-success alert-dismissible border-0 shadow-sm py-2 px-3 mb-3 small" role="status">
              <i className="bi bi-check-circle-fill me-2"></i>{successMessage}
              <button type="button" className="btn-close py-2" aria-label="Close" onClick={() => setSuccessMessage('')}></button>
            </div>
          )}
          {actionError && (
            <div className="alert alert-danger alert-dismissible border-0 shadow-sm py-2 px-3 mb-3 small" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>{actionError}
              <button type="button" className="btn-close py-2" aria-label="Close" onClick={() => setActionError('')}></button>
            </div>
          )}

          <div className="card border shadow-sm mb-3">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                <h6 className="text-uppercase text-secondary fw-bold small mb-0">
                  <i className="bi bi-card-heading me-1 text-primary"></i> Claim Overview
                </h6>
                {pkg.claimed_amount ? <span className="fw-bold text-success">{formatINR(pkg.claimed_amount)}</span> : null}
              </div>
              <div className="row g-2 small">
                <div className="col-6"><span className="text-muted d-block">Vendor</span><strong className="d-block text-truncate">{decodeEntities(pkg.vendor_name) || '—'}</strong></div>
                <div className="col-6"><span className="text-muted d-block">Project</span><strong className="d-block text-truncate">{decodeEntities(pkg.project_name) || '—'}</strong></div>
                <div className="col-6"><span className="text-muted d-block">PO Reference</span><span className="fw-medium">{pkg.po_number || '—'}</span></div>
                <div className="col-6"><span className="text-muted d-block">Workflow</span><span className="fw-medium d-block text-break">{decodeEntities(pkg.workflow_name) || 'Manual assignment'}</span></div>
                {pkg.invoice_number && <div className="col-6"><span className="text-muted d-block">Invoice No.</span><span className="fw-medium text-break">{decodeEntities(pkg.invoice_number)}</span></div>}
                {pkg.invoice_date && <div className="col-6"><span className="text-muted d-block">Invoice Date</span><span className="fw-medium">{formatDate(pkg.invoice_date)}</span></div>}
                <div className="col-6"><span className="text-muted d-block">Submitted</span><span className="fw-medium">{formatDate(pkg.created_at)}</span></div>
                {pkg.completed_at && <div className="col-6"><span className="text-muted d-block">Completed</span><span className="fw-medium">{formatDate(pkg.completed_at)}</span></div>}
                {pkg.remarks && (
                  <div className="col-12 border-top pt-2 mt-1">
                    <span className="text-muted d-block">Submission note</span>
                    <p className="text-dark mb-0 bg-light p-2 rounded border">{decodeEntities(pkg.remarks)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card border border-primary-subtle shadow-sm mb-3">
            <div className="card-body p-3">
              <h6 className="text-uppercase text-primary fw-bold mb-3 small">
                <i className="bi bi-shield-check me-1"></i> {isVendor ? 'Actions' : 'Review Decision'}
              </h6>
              <div className="d-flex flex-column gap-3">
                {canResubmit && (
                  <div className="alert alert-warning mb-0 small">
                    <p className="mb-2"><i className="bi bi-arrow-counterclockwise me-1"></i>
                      This claim is back with you. Attach corrected documents if needed, then re-submit.</p>
                    <Link to={`/vendor/claims/${id}/resubmit`} className="btn btn-sm btn-warning w-100 fw-semibold">
                      Revise &amp; Re-submit
                    </Link>
                  </div>
                )}

                {canApproveComplete && (
                  <RemarksAction id="approve-remarks" label="Approve & Complete" placeholder="Approval remarks (min 3 characters)..."
                    value={remarks.approve} onChange={setRemark('approve')} submitting={busy === 'approve'}
                    onSubmit={onSubmit('approve', (t) => claimsService.approve(id, t), 'Claim approved and completed.', { confirmText: 'Approve and complete this claim? This cannot be undone.' })}
                    buttonClass="btn-success" buttonIcon="bi-check2-circle" buttonText="Approve & Complete" />
                )}

                {canForward && (
                  <RemarksAction id="forward-remarks" label="Forward to next step" placeholder="Forward remarks (min 3 characters)..."
                    value={remarks.forward} onChange={setRemark('forward')} submitting={busy === 'forward'}
                    onSubmit={onSubmit('forward', (t) => claimsService.forward(id, t), 'Claim forwarded to the next step.')}
                    buttonClass="btn-success" buttonIcon="bi-send" buttonText="Forward" />
                )}

                {(canSendBackWorkflow || canSendBackManual) && (
                  <RemarksAction id="sendback-remarks" label={canSendBackManual ? 'Send back to vendor' : 'Send back'}
                    placeholder="Reason for sending back (min 3 characters)..."
                    value={remarks.sendback} onChange={setRemark('sendback')} submitting={busy === 'sendback'}
                    onSubmit={onSubmit('sendback', (t) => claimsService.sendback(id, t), 'Claim sent back.', { confirmText: 'Send this claim back?' })}
                    buttonClass="btn-outline-danger" buttonIcon="bi-reply" buttonText="Send Back" />
                )}

                {canAssign && (
                  <RemarksAction id="assign-remarks" label={isVendor ? 'Submit to officer' : 'Forward to officer'}
                    placeholder="Remarks (min 3 characters)..."
                    value={remarks.assign} onChange={setRemark('assign')} submitting={busy === 'assign'}
                    onSubmit={handleAssign} buttonClass="btn-primary" buttonIcon="bi-person-check" buttonText="Assign">
                    <select className="form-select form-select-sm mb-2" value={selectedOfficerId}
                      onChange={(e) => setSelectedOfficerId(e.target.value)} disabled={busy === 'assign'} aria-label="Select officer">
                      <option value="">Select an officer...</option>
                      {officers.filter((o) => o.id !== user?.id).map((off) => (
                        <option key={off.id} value={off.id}>{decodeEntities(off.name)} ({off.role_name})</option>
                      ))}
                    </select>
                  </RemarksAction>
                )}

                {canPullBack && (
                  <RemarksAction id="pullback-remarks" label="Pull back" placeholder="Reason for pulling back (min 3 characters)..."
                    value={remarks.pullback} onChange={setRemark('pullback')} submitting={busy === 'pullback'}
                    onSubmit={onSubmit('pullback', (t) => claimsService.pullBack(id, t), 'Claim pulled back.', { confirmText: 'Pull this claim back from the current officer?' })}
                    buttonClass="btn-outline-secondary" buttonIcon="bi-arrow-return-left" buttonText="Pull Back">
                    <p className="small text-muted mb-1">Possible until the officer you sent it to acts on it.</p>
                  </RemarksAction>
                )}

                {!hasActions && !isCompleted && (
                  <div className="alert alert-info mb-0 small py-2">
                    <i className="bi bi-info-circle me-1"></i>
                    {isReturned
                      ? 'Returned to the vendor for revision.'
                      : pkg.current_step_name
                        ? `Currently with: ${decodeEntities(pkg.current_step_name)}. Awaiting their action.`
                        : 'This claim has not been assigned yet.'}
                  </div>
                )}
                {isCompleted && (
                  <div className="alert alert-success mb-0 small py-2">
                    <i className="bi bi-check-circle-fill me-1"></i> This claim has been approved and completed.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card border shadow-sm mb-3">
            <div className="card-body p-3">
              <h6 className="text-uppercase text-secondary fw-bold mb-2 small">
                <i className="bi bi-paperclip me-1 text-primary"></i> Attachments ({files.length})
              </h6>
              <ul className="list-group list-group-flush mb-2 border-top border-bottom">
                {files.map((f) => (
                  <li key={f.id} className="list-group-item d-flex justify-content-between align-items-center px-0 py-2 gap-2">
                    <button className="btn btn-link btn-sm p-0 text-start text-decoration-none d-flex align-items-center min-w-0"
                      onClick={() => handleDownload(f)} title="Download">
                      <i className={`bi ${/\.pdf$/i.test(f.original_name) ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-image text-primary'} me-2`}></i>
                      <span className="fw-medium text-dark text-truncate">{decodeEntities(f.original_name)}</span>
                      {f.document_type === 'CERTIFICATION' && <span className="badge text-bg-info ms-2" style={{ fontSize: '0.65rem' }}>Certification</span>}
                      <span className="text-muted ms-2 text-nowrap" style={{ fontSize: '0.7rem' }}>({f.file_size ? (f.file_size / 1024).toFixed(1) : '0'} KB)</span>
                    </button>
                    {canEditFiles && (
                      <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => handleDeleteFile(f.id)} title="Remove file" aria-label={`Remove ${f.original_name}`}>
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </li>
                ))}
                {files.length === 0 && <li className="list-group-item px-0 text-muted small py-2">No files attached to this claim.</li>}
              </ul>

              {canEditFiles && (
                <form className="d-flex flex-column flex-sm-row gap-2" onSubmit={handleUpload}>
                  <select className="form-select form-select-sm" style={{ maxWidth: 150 }} value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Document type">
                    <option value="INVOICE">Invoice</option>
                    <option value="CERTIFICATION">Certification</option>
                  </select>
                  <input type="file" className="form-control form-control-sm" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label="Choose file" />
                  <button className="btn btn-sm btn-primary text-nowrap" disabled={!file || busy === 'upload'}>
                    {busy === 'upload' ? 'Uploading...' : 'Upload'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="card border shadow-sm">
            <div className="card-body p-3">
              <h6 className="text-uppercase text-secondary fw-bold mb-3 small">
                <i className="bi bi-clock-history me-1 text-primary"></i> Attestation Trail
              </h6>
              {history.length === 0 ? (
                <p className="text-muted small mb-0">No activity logged yet.</p>
              ) : (
                <ol className="list-unstyled mb-0">
                  {history.map((h) => (
                    <li key={h.id} className="mb-2 pb-2 border-bottom last-border-none">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                        <span className="small">
                          <span className={`badge ${ACTION_BADGE[h.action] || 'text-bg-secondary'} me-1`}>{ACTION_LABELS[h.action] || h.action}</span>
                          {h.from_step_name && <span className="text-muted">{decodeEntities(h.from_step_name)} → </span>}
                          {h.to_step_name && <span className="text-dark">{decodeEntities(h.to_step_name)}</span>}
                          {h.to_user_name && h.action !== 'CREATE' && <span className="text-muted"> → {decodeEntities(h.to_user_name)}</span>}
                        </span>
                        <span className="text-muted text-nowrap" style={{ fontSize: '0.7rem' }}>{formatDate(h.created_at, true)}</span>
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        By <span className="text-dark fw-medium">{decodeEntities(h.performed_by_name) || 'User'}</span>
                        {h.performed_by_role_name && <> ({h.performed_by_role_name})</>}
                      </div>
                      {h.remarks && (
                        <div className="small mt-1 bg-light p-2 rounded text-secondary border" style={{ fontSize: '0.75rem' }}>
                          <i className="bi bi-chat-left-quote me-1"></i>{decodeEntities(h.remarks)}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
