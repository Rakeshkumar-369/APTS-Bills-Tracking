// src/pages/ResubmitClaim.jsx
// Vendor revises a returned (or pulled-back) claim: optionally attaches revised
// documents, then re-submits it to the officer / workflow step that returned it.
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { claimsService } from '../services';
import StatusBadge from '../components/StatusBadge';
import { decodeEntities, formatDate } from '../utils/text';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
const MAX_MB = 25;

function FileList({ list, setList }) {
  if (list.length === 0) return null;
  return (
  <ul className="list-group mt-2">
    {list.map((file, index) => (
      <li key={`${file.name}-${index}`} className="list-group-item d-flex justify-content-between align-items-center py-2">
        <span className="text-truncate small"><i className="bi bi-file-earmark text-primary me-2"></i>{file.name}
          <span className="text-muted ms-2">({(file.size / 1024).toFixed(1)} KB)</span></span>
        <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Remove ${file.name}`}
          onClick={() => setList((prev) => prev.filter((_, i) => i !== index))}>
          <i className="bi bi-x"></i>
        </button>
      </li>
    ))}
  </ul>
  );
}

export default function ResubmitClaim() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [claim, setClaim] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [files, setFiles] = useState([]);
  const [certFiles, setCertFiles] = useState([]);

  useEffect(() => {
    let cancelled = false;
    claimsService.get(id, { includeDetails: true })
      .then((data) => { if (!cancelled) setClaim(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load claim details'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // The latest SENDBACK / PULL_BACK entry explains why the claim is with the vendor
  const returnEntry = [...(claim?.history || [])].reverse().find((h) => ['SENDBACK', 'PULL_BACK'].includes(h.action));

  const addFiles = (setter) => (e) => {
    const picked = Array.from(e.target.files || []);
    const tooBig = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} is larger than ${MAX_MB} MB.`);
    } else {
      setter((prev) => [...prev, ...picked]);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (remarks.trim().length < 3) {
      setError('Please enter remarks (minimum 3 characters).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Documents can only be changed while the claim is with the vendor, so
      // upload revisions FIRST, then re-submit.
      for (const file of files) await claimsService.uploadFile(id, file, 'INVOICE');
      for (const file of certFiles) await claimsService.uploadFile(id, file, 'CERTIFICATION');
      await claimsService.resubmit(id, remarks.trim());
      navigate(`/vendor/claims/${id}`, { replace: true, state: { flash: 'Claim re-submitted successfully.' } });
    } catch (err) {
      setError(err.message || 'Failed to re-submit claim. Please try again.');
      // Refresh so already-uploaded documents are shown and not re-sent
      setFiles([]);
      setCertFiles([]);
      claimsService.get(id, { includeDetails: true }).then(setClaim).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
        <p className="mt-3 text-muted">Loading claim details...</p>
      </div>
    );
  }

  if (!claim) {
    return <div className="container py-4"><div className="alert alert-danger">{error || 'Claim not found or you do not have access to it.'}</div></div>;
  }

  if (claim.status !== 'SENT_BACK') {
    return (
      <div className="container py-4">
        <div className="alert alert-info">
          This claim is not awaiting revision (current status: <StatusBadge status={claim.status} />).{' '}
          <Link to={`/vendor/claims/${id}`}>Back to claim</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-3 py-md-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-header bg-white border-bottom p-3 p-md-4">
              <h4 className="mb-1 fw-bold">
                <i className="bi bi-arrow-counterclockwise text-warning me-2"></i>
                Revise &amp; Re-submit: {claim.claim_code}
              </h4>
              <p className="text-muted small mb-0">Attach any corrected documents and explain the changes, then re-submit.</p>
            </div>

            <div className="card-body p-3 p-md-4">
              {error && (
                <div className="alert alert-danger alert-dismissible">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setError(null)}></button>
                </div>
              )}

              <div className="bg-light p-3 rounded-3 mb-4">
                <div className="row g-2 small">
                  <div className="col-md-6"><span className="text-muted d-block">Project</span><strong>{decodeEntities(claim.project_name) || '—'}</strong></div>
                  <div className="col-md-6"><span className="text-muted d-block">Purchase Order</span><strong>{claim.po_number || '—'}</strong></div>
                  {returnEntry && (
                    <div className="col-12 border-top pt-2 mt-2">
                      <span className="text-muted d-block">
                        {returnEntry.action === 'PULL_BACK' ? 'You pulled this claim back' : `Returned by ${decodeEntities(returnEntry.performed_by_name) || 'officer'}`}
                        {' '}on {formatDate(returnEntry.created_at, true)}
                      </span>
                      <p className="mb-0 bg-white border rounded p-2 mt-1">{decodeEntities(returnEntry.remarks)}</p>
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="resubmit-remarks" className="form-label fw-semibold">
                    Re-submission remarks <span className="text-danger">*</span>
                  </label>
                  <textarea id="resubmit-remarks" className="form-control" rows="4" maxLength={500}
                    placeholder="Explain the changes you have made..." value={remarks}
                    onChange={(e) => setRemarks(e.target.value)} required minLength={3} />
                  <small className="text-muted">{remarks.length}/500</small>
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Revised invoice / bill documents</label>
                    <input type="file" className="form-control" multiple accept={ACCEPT} onChange={addFiles(setFiles)} />
                    <FileList list={files} setList={setFiles} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Certification documents (optional)</label>
                    <input type="file" className="form-control" multiple accept={ACCEPT} onChange={addFiles(setCertFiles)} />
                    <FileList list={certFiles} setList={setCertFiles} />
                  </div>
                  <div className="col-12"><small className="text-muted">PDF, JPG, PNG or WEBP, up to {MAX_MB} MB each.</small></div>
                </div>

                {claim.files?.length > 0 && (
                  <div className="mb-4">
                    <label className="fw-semibold small">Documents already attached</label>
                    <ul className="list-group mt-1">
                      {claim.files.map((file) => (
                        <li key={file.id} className="list-group-item small py-2">
                          <i className="bi bi-file-earmark-text text-danger me-2"></i>{decodeEntities(file.original_name)}
                          {file.document_type === 'CERTIFICATION' && <span className="badge text-bg-info ms-2">Certification</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2">
                  <button type="submit" className="btn btn-success" disabled={submitting}>
                    {submitting
                      ? <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Re-submitting...</>
                      : <><i className="bi bi-send me-1"></i>Re-submit claim</>}
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)} disabled={submitting}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
