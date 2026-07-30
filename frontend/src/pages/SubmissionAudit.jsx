// src/components/SubmissionAudit.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * SubmissionAudit
 * -----------------
 * Split layout: PDF viewer on the left, claim details on the right
 * Matches the design from the second image
 */
export default function SubmissionAudit({
  submission,
  daysElapsed,
  actionRemarks,
  onRemarksChange,
  onBack,
  onOpenPdf,
  onSendBack,
  onForward,
  hasDigitalSignature,
}) {
  const topRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Force scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    let node = topRef.current?.parentElement;
    while (node) {
      if (node.scrollTop > 0) {
        node.scrollTop = 0;
      }
      node = node.parentElement;
    }
  }, [submission?.id, submission?.claimId]);

  if (!submission) return null;

  const statusMap = {
    PENDING: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending' },
    SUBMITTED: { color: '#3b82f6', bg: '#dbeafe', label: 'Submitted' },
    IN_PROGRESS: { color: '#8b5cf6', bg: '#ede9fe', label: 'In Progress' },
    COMPLETED: { color: '#10b981', bg: '#d1fae5', label: 'Completed' },
    APPROVED: { color: '#10b981', bg: '#d1fae5', label: 'Approved' },
    CLEARED: { color: '#10b981', bg: '#d1fae5', label: 'Cleared' },
    RETURNED: { color: '#ef4444', bg: '#fee2e2', label: 'Returned' },
    SENT_BACK: { color: '#ef4444', bg: '#fee2e2', label: 'Sent Back' },
    REJECTED: { color: '#ef4444', bg: '#fee2e2', label: 'Rejected' },
  };

  const statusKey = (submission.status || '').toUpperCase();
  const s = statusMap[statusKey] || { 
    color: '#6b7280', 
    bg: '#f3f4f6', 
    label: submission.status || 'Unknown' 
  };

  const lastEntry = submission.history && submission.history.length > 0
    ? submission.history[submission.history.length - 1]
    : null;

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }
    setUploading(true);
    try {
      // Implement your file upload logic here
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('File uploaded successfully!');
      setSelectedFile(null);
    } catch (err) {
      alert('Failed to upload file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div ref={topRef} className="container-fluid p-0" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header with Back Button */}
      <div className="bg-white border-bottom px-4 py-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <button
            onClick={onBack}
            className="btn btn-outline-secondary btn-sm rounded-circle px-2 py-1 border-0 bg-white shadow-sm"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <div>
            <h5 className="mb-0 fw-bold text-dark">{submission.id}</h5>
            <span className="text-muted small">{submission.vendor} • {submission.projectType}</span>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span 
            className="px-3 py-1 rounded-pill fw-semibold small" 
            style={{ backgroundColor: s.bg, color: s.color }}
          >
            {s.label}
          </span>
          <span className="text-muted small">
            Stage: {submission.currentStage || 'PM Verification'}
          </span>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="row g-0" style={{ height: 'calc(100vh - 80px)' }}>
        {/* LEFT COLUMN - PDF Viewer */}
        <div className="col-12 col-lg-7" style={{ height: '100%', backgroundColor: '#ffffff' }}>
          <div className="p-3 h-100 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-semibold small text-muted">DOCUMENT</span>
              <span className="text-muted small">
                {submission.fileName} ({submission.fileSize || '4.8 KB'})
              </span>
            </div>
            <div 
              className="border rounded-3 flex-grow-1 d-flex align-items-center justify-content-center"
              style={{ 
                backgroundColor: '#f8fafc',
                minHeight: '400px',
                backgroundImage: 'radial-gradient(circle at 10px 10px, #e5e7eb 1px, transparent 0)',
                backgroundSize: '20px 20px'
              }}
            >
              {submission.fileUrl ? (
                <div className="text-center">
                  <i className="bi bi-file-earmark-pdf text-danger" style={{ fontSize: '4rem' }}></i>
                  <div className="mt-2">
                    <button
                      onClick={() => onOpenPdf(submission)}
                      className="btn btn-primary"
                    >
                      <i className="bi bi-eye me-1"></i> View Document
                    </button>
                  </div>
                  <div className="mt-2 text-muted small">
                    {submission.fileName} ({submission.fileSize || '4.8 KB'})
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted">
                  <i className="bi bi-file-earmark" style={{ fontSize: '4rem' }}></i>
                  <p className="mt-2">No document available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Claim Details */}
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
                  <span className="fw-semibold small">{submission.vendor}</span>
                </div>
                <div className="d-flex justify-content-between py-1 border-top">
                  <span className="text-muted small">Project</span>
                  <span className="fw-semibold small">{submission.projectType}</span>
                </div>
                <div className="d-flex justify-content-between py-1 border-top">
                  <span className="text-muted small">PO Reference</span>
                  <span className="fw-semibold small">{submission.poReference || 'Workflow'}</span>
                </div>
                <div className="d-flex justify-content-between py-1 border-top">
                  <span className="text-muted small">PO Number</span>
                  <span className="fw-semibold small">{submission.poNumber || 'PO-2026-0003'}</span>
                </div>
                <div className="d-flex justify-content-between py-1 border-top">
                  <span className="text-muted small">Package</span>
                  <span className="fw-semibold small">{submission.package || 'Standard Vendor Package C...'}</span>
                </div>
                {submission.submissionNote && (
                  <div className="mt-2 pt-2 border-top">
                    <span className="text-muted small">Submission Note</span>
                    <p className="mb-0 small mt-1">{submission.submissionNote}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Officer Review Decision */}
            <div className="mb-4">
              <h6 className="fw-bold text-dark mb-3" style={{ fontSize: '0.85rem' }}>
                OFFICER REVIEW DECISION
              </h6>
              {onSendBack || onForward ? (
                <div className="bg-light rounded-3 p-3">
                  <textarea
                    className="form-control border-0 bg-white"
                    rows="3"
                    placeholder="Enter review decision..."
                    value={actionRemarks}
                    onChange={(e) => onRemarksChange(e.target.value)}
                  ></textarea>
                  <div className="d-flex gap-2 mt-2">
                    {onSendBack && (
                      <button
                        onClick={onSendBack}
                        className="btn btn-outline-danger btn-sm"
                        disabled={!actionRemarks.trim()}
                      >
                        <i className="bi bi-x-circle me-1"></i> Send Back
                      </button>
                    )}
                    {onForward && (
                      <button
                        onClick={onForward}
                        className={`btn btn-sm ${hasDigitalSignature ? 'btn-success' : 'btn-primary'}`}
                        disabled={!actionRemarks.trim()}
                      >
                        <i className={`bi ${hasDigitalSignature ? 'bi-patch-check' : 'bi-check-circle'} me-1`}></i>
                        {hasDigitalSignature ? 'Digital Sign' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-light rounded-3 p-3 text-center text-muted">
                  <i className="bi bi-info-circle me-2"></i>
                  No pending approval actions required for your role at this stage.
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="mb-4">
              <h6 className="fw-bold text-dark mb-3" style={{ fontSize: '0.85rem' }}>
                ATTACHMENTS
              </h6>
              <div className="bg-light rounded-3 p-3">
                {submission.fileName && (
                  <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-file-earmark-pdf text-danger"></i>
                      <div>
                        <div className="fw-semibold small">{submission.fileName}</div>
                        <div className="text-muted small">{submission.fileSize || '4.8 KB'}</div>
                      </div>
                    </div>
                    {submission.fileUrl && (
                      <button
                        onClick={() => onOpenPdf(submission)}
                        className="btn btn-sm btn-outline-primary"
                      >
                        View Document
                      </button>
                    )}
                  </div>
                )}
                <div className="d-flex gap-2 align-items-center">
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleFileUpload}
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    ) : (
                      <i className="bi bi-upload me-1"></i>
                    )}
                    Upload
                  </button>
                </div>
              </div>
            </div>

            {/* Workflow Audit Trail */}
            <div>
              <h6 className="fw-bold text-dark mb-3" style={{ fontSize: '0.85rem' }}>
                WORKFLOW AUDIT TRAIL
              </h6>
              <div className="bg-light rounded-3 p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {submission.history && submission.history.length > 0 ? (
                  submission.history.map((log, index) => {
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

      <style>{`
        .border-top {
          border-top: 1px solid #e5e7eb !important;
        }
        .bg-light {
          background-color: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}