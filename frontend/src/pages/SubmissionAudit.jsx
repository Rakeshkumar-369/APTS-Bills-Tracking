// src/components/SubmissionAudit.jsx
import React, { useEffect, useRef } from 'react';

/**
 * SubmissionAudit
 * -----------------
 * Renders the full activity/audit trail for a single submission ("claim").
 * The source PDF is shown as a link only — clicking it hands control back to
 * the parent (via onOpenPdf) which switches to the in-page PDF viewer.
 *
 * Props:
 *  - submission: the active submission object being audited
 *  - daysElapsed: number of days the claim has been sitting at this desk
 *  - actionRemarks / onRemarksChange: controlled textarea state
 *  - onBack: return to the inbox list
 *  - onOpenPdf: switch to the in-page PDF viewer for this submission
 *  - onSendBack / onForward: trigger the workflow movement actions
 *  - hasDigitalSignature: whether the current officer signs digitally
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

  // This view is swapped in via state (no real route change), so the
  // browser keeps whatever scroll position the previous list/table had.
  // Force every possible scroll container back to 0 whenever a (new)
  // submission is opened — window, html/body, AND any scrollable ancestor
  // div in a dashboard shell layout. scrollIntoView alone can stop short of
  // absolute 0 if there's padding/margin above, so we explicitly zero out
  // scrollTop on every ancestor as well.
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

  return (
    <div ref={topRef} className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white animate-fade-in">
      <div className="bg-light bg-opacity-60 border-bottom px-4 py-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={onBack}
            className="btn btn-outline-secondary btn-sm rounded-circle px-2 py-1 border-0 bg-white shadow-xs"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <div>
            <h5 className="mb-0 fw-extrabold text-dark tracking-tight">Auditing Node: {submission.id}</h5>
            <span className="text-muted fs-8 font-monospace">{submission.vendor} &bull; {submission.projectType} Scope</span>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span
            className="px-3 py-2 rounded-pill fs-8 fw-bold d-inline-flex align-items-center"
            style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
          >
            <i className="bi bi-hourglass-split me-1"></i> Desk Age: {daysElapsed} Days
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Document reference — shown only as a link. Clicking it opens the in-page PDF viewer */}
        <div className="mb-4">
          <label className="form-label fw-bold text-secondary fs-8 font-monospace text-uppercase tracking-wider mb-1">
            Document claim
          </label>
          <div className="bg-light bg-opacity-50 border border-light-subtle rounded-3 p-3 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2 text-truncate pe-2">
              <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
              <span className="fs-7.5 fw-bold text-dark text-truncate">{submission.fileName}</span>
              {submission.fileSize && (
                <span className="text-muted fs-8 font-monospace">({submission.fileSize})</span>
              )}
            </div>
            {submission.fileUrl ? (
              <button
                onClick={() => onOpenPdf(submission)}
                className="btn btn-link btn-sm fw-bold fs-8 text-decoration-underline d-flex align-items-center gap-1 text-primary"
              >
                <i className="bi bi-eye-fill"></i> View Document
              </button>
            ) : (
              <span className="text-muted fs-8 font-monospace text-uppercase">
                <i className="bi bi-exclamation-triangle me-1 text-warning"></i> File missing
              </span>
            )}
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <span className="d-block fw-bold text-secondary fs-8 font-monospace text-uppercase tracking-wider mb-2">
              Preceding Activity Trails
            </span>
            <div className="bg-light bg-opacity-50 border border-light-subtle rounded-3 p-3 overflow-auto" style={{ maxHeight: '320px' }}>
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
                    <div key={log.id || index} className="fs-8 border-bottom border-light-subtle pb-2 mb-2 last-border-0">
                      <div className="d-flex align-items-center justify-content-between mb-0.5">
                        <span className="fw-bold text-dark">{actionText}</span>
                        <span className="text-muted font-monospace">{dateText}</span>
                      </div>
                      <span className="d-block text-primary fw-semibold fs-8.5">
                        {actorName}{actorRole ? ` • ${actorRole}` : ''}
                      </span>
                      {remarksText && (
                        <p className="text-secondary italic mb-0 mt-0.5 bg-white p-1.5 rounded border shadow-3xs">"{remarksText}"</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted py-3">No activity history available</div>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-5 d-flex flex-column justify-content-between">
            <div>
              <label className="form-label fw-bold text-secondary fs-8 font-monospace text-uppercase tracking-wider mb-1">
                Workflow Lifecycle Audit Remarks
              </label>
              <textarea
                className="form-control border border-light-subtle rounded-3 fs-7.5 bg-light bg-opacity-20"
                rows="6"
                placeholder="Enter analytical review logs, query specifics, or validation checks..."
                value={actionRemarks}
                onChange={(e) => onRemarksChange(e.target.value)}
              ></textarea>
              <div className="form-text fs-8 text-muted mt-1">
                * Action Remarks are mandatory if triggering a back-movement query response loop.
              </div>
            </div>

            <div className="pt-4 border-top border-light-subtle d-flex flex-column gap-2 mt-4">
              <div className="row g-2">
                <div className="col-6">
                  <button
                    onClick={onSendBack}
                    className="btn btn-outline-danger w-100 py-2.5 rounded-3 fw-bold fs-7 d-flex align-items-center justify-content-center gap-1.5 shadow-sm"
                    disabled={!actionRemarks.trim()}
                    title="Add remarks to send claim back"
                  >
                    <i className="bi bi-reply-all-fill"></i> Send Back
                  </button>
                </div>
                <div className="col-6">
                  <button
                    onClick={onForward}
                    className={`btn w-100 py-2.5 rounded-3 fw-bold fs-7 d-flex align-items-center justify-content-center gap-1.5 shadow-sm ${
                      hasDigitalSignature ? 'btn-success' : 'btn-primary'
                    }`}
                  >
                    <i className={`bi ${hasDigitalSignature ? 'bi-patch-check-fill' : 'bi-arrow-right-circle-fill'}`}></i>
                    {hasDigitalSignature ? 'Digital Sign' : 'Approve & Move'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .fs-7.5 { font-size: 0.825rem !important; }
        .fs-8.5 { font-size: 0.775rem !important; }
        .shadow-3xs { box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important; }
      `}</style>
    </div>
  );
}