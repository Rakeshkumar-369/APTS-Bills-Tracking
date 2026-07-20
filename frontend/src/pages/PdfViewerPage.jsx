import React from 'react';

/**
 * PdfViewerPage
 * -------------------
 * Displays the submission's PDF across the entire page (not split with any
 * other panel). Reached only via the "View Document" link inside
 * SubmissionAudit. onBack returns to the audit view for that same submission.
 */
export default function PdfViewerPage({ submission, onBack }) {
  if (!submission) return null;

  return (
    <div className="d-flex flex-column" style={{ height: 'calc(100vh - 32px)' }}>
      <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between shadow-3xs">
        <div className="d-flex align-items-center gap-2 text-truncate pe-2">
          <button
            onClick={onBack}
            className="btn btn-outline-secondary btn-sm rounded-circle px-2 py-1 border-0 bg-white shadow-xs me-2"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
          <span className="fs-7.5 fw-bold text-dark text-truncate">{submission.fileName}</span>
          {submission.fileSize && (
            <span className="text-muted fs-8 font-monospace">({submission.fileSize})</span>
          )}
        </div>
        {submission.fileUrl && (
          <a
            href={submission.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline-primary btn-xs px-2 py-1 rounded d-flex align-items-center gap-1 font-monospace fs-8 fw-bold bg-white shadow-3xs"
          >
            <i className="bi bi-fullscreen"></i> Open In New Tab
          </a>
        )}
      </div>

      <div className="flex-grow-1 p-0 bg-secondary bg-opacity-10">
        {submission.fileUrl ? (
          <iframe
            src={submission.fileUrl}
            title="Workflow Particulars Document Canvas Layer"
            className="w-100 h-100 border-0"
          />
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 p-5 text-muted font-monospace fs-8 text-uppercase">
            <i className="bi bi-exclamation-triangle me-1 text-warning"></i> File buffer location path vector missing
          </div>
        )}
      </div>

      <div className="bg-light border-top p-2.5 text-center fs-8 fw-bold text-muted uppercase font-monospace">
        Portal Embedded Document Canvas Frame v3.0 &bull; Live Render Model
      </div>

      <style>{`
        .fs-7.5 { font-size: 0.825rem !important; }
        .shadow-3xs { box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important; }
      `}</style>
    </div>
  );
}
