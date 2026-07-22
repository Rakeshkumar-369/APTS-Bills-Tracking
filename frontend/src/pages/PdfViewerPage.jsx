// src/pages/PdfViewerPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function PdfViewerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const submission = location.state?.submission || null;
  const [loadError, setLoadError] = useState(false);

  console.log('📄 PdfViewerPage - Submission:', submission);

  useEffect(() => {
    // Log the file URL for debugging
    if (submission) {
      console.log('📄 File URL:', submission.fileUrl);
      console.log('📄 File Name:', submission.fileName);
    }
  }, [submission]);

  if (!submission) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="text-center">
          <i className="bi bi-file-earmark-pdf fs-1 text-muted mb-3 d-block"></i>
          <h5 className="text-muted">No document to display</h5>
          <p className="text-muted small">No submission data was provided</p>
          <button 
            className="btn btn-primary mt-3"
            onClick={() => navigate(-1)}
          >
            <i className="bi bi-arrow-left me-1"></i> Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check if fileUrl exists and is valid
  const hasValidFile = submission.fileUrl && 
                       submission.fileUrl !== 'null' && 
                       submission.fileUrl !== 'undefined' &&
                       submission.fileUrl.trim() !== '';

  console.log('📄 Has valid file:', hasValidFile);

  return (
    <div className="d-flex flex-column vh-100 bg-light">
      {/* Header */}
      <div className="bg-white border-bottom px-4 py-3 d-flex align-items-center justify-content-between shadow-sm" style={{ zIndex: 10, flexShrink: 0 }}>
        <div className="d-flex align-items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-outline-secondary btn-sm"
          >
            <i className="bi bi-arrow-left me-1"></i> Back
          </button>
          <div>
            <h5 className="mb-0 fw-bold">
              <i className="bi bi-file-earmark-pdf-fill text-danger me-2"></i>
              {submission.fileName || 'Document'}
            </h5>
            <small className="text-muted">
              {submission.id} • {submission.fileSize || 'N/A'}
            </small>
          </div>
        </div>
        {hasValidFile && (
          <a
            href={submission.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary btn-sm"
          >
            <i className="bi bi-box-arrow-up-right me-1"></i> Open in New Tab
          </a>
        )}
      </div>

      {/* PDF Viewer */}
      <div className="flex-grow-1 p-0" style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {hasValidFile ? (
          !loadError ? (
            <iframe
              src={submission.fileUrl}
              title="PDF Viewer"
              className="w-100 h-100 border-0"
              style={{ backgroundColor: '#f8fafc' }}
              onError={() => {
                console.error('❌ Iframe failed to load PDF:', submission.fileUrl);
                setLoadError(true);
              }}
            />
          ) : (
            <div className="d-flex align-items-center justify-content-center h-100">
              <div className="text-center">
                <i className="bi bi-exclamation-triangle fs-1 text-danger mb-3 d-block"></i>
                <h5 className="text-danger">Failed to load PDF</h5>
                <p className="text-muted small">The document could not be loaded. Please try opening in a new tab.</p>
                <a 
                  href={submission.fileUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-primary mt-2"
                >
                  <i className="bi bi-box-arrow-up-right me-1"></i> Open in New Tab
                </a>
                <button 
                  className="btn btn-secondary mt-2 ms-2"
                  onClick={() => navigate(-1)}
                >
                  <i className="bi bi-arrow-left me-1"></i> Go Back
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100">
            <div className="text-center">
              <i className="bi bi-file-earmark-pdf fs-1 text-muted mb-3 d-block"></i>
              <h5 className="text-muted">No PDF available</h5>
              <p className="text-muted small">The document file could not be found for this package</p>
              <button 
                className="btn btn-secondary mt-3"
                onClick={() => navigate(-1)}
              >
                <i className="bi bi-arrow-left me-1"></i> Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}