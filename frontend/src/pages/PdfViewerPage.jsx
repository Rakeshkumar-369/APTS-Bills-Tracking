// src/pages/PdfViewerPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { claimsService } from '../services';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const SERVER_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Converts any relative path returned by the backend into a full absolute URL
function toAbsoluteUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path.replace(/\\/g, '/');

  let normalized = path.replace(/\\/g, '/');
  normalized = normalized.replace(/^\/?/, '/');

  return `${SERVER_ORIGIN}${normalized}`;
}

export default function PdfViewerPage({ claimId: claimIdProp, onBack: onBackProp, embedded = false } = {}) {
  const navigate = useNavigate();
  const { claimId: claimIdFromRoute } = useParams();

  const claimId = claimIdProp ?? claimIdFromRoute;
  const handleBack = onBackProp ?? (() => navigate(-1));

  // claim/file metadata
  const [submission, setSubmission] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);

  // PDF.js state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfSrc, setPdfSrc] = useState(null);
  const [pagesRendered, setPagesRendered] = useState(0);

  const blobUrlRef = useRef(null);
  const containerRef = useRef(null);
  const renderAbortRef = useRef(false);
  const pageInputRef = useRef(null);

  // Step 1: fetch claim + file metadata
  useEffect(() => {
    if (!claimId) {
      setMetaError('No claim ID was provided.');
      setMetaLoading(false);
      return;
    }

    let cancelled = false;

    const loadMeta = async () => {
      try {
        setMetaLoading(true);
        setMetaError(null);

        const details = await claimsService.get(claimId, { includeDetails: true });
        if (cancelled) return;

        let fileUrl = null;
        let fileName = 'document.pdf';
        let fileSize = 'N/A';

        if (details?.files && details.files.length > 0) {
          const file = details.files[0];
          fileName = file.original_name || file.filename || 'document.pdf';
          fileSize = file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'N/A';

          if (file.id) {
            fileUrl = `${API_BASE}/claims/${claimId}/files/${file.id}/download`;
          } else {
            const rawUrl = file.url || file.file_path || file.download_url || file.public_url || null;
            fileUrl = toAbsoluteUrl(rawUrl);
          }
        }

        if (!fileUrl && details?.file_url) fileUrl = toAbsoluteUrl(details.file_url);
        if (!fileUrl && details?.attachment_url) fileUrl = toAbsoluteUrl(details.attachment_url);
        if (!fileUrl && details?.document_url) fileUrl = toAbsoluteUrl(details.document_url);

        setSubmission({
          id: details?.claim_code || details?.claimCode || claimId,
          claimId,
          vendor: details?.vendor_name || details?.vendor || 'N/A',
          fileName,
          fileSize,
          fileUrl,
        });
      } catch (err) {
        console.error('❌ Error fetching claim details:', err);
        if (!cancelled) setMetaError(err.message || 'Failed to load claim details');
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    };

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [claimId]);

  // Step 2: fetch the PDF
  useEffect(() => {
    if (!submission?.fileUrl) {
      if (!metaLoading) setLoading(false);
      return;
    }

    let cancelled = false;
    let fetchedDoc = null;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        setPagesRendered(0);
        setCurrentPage(1);

        const token = localStorage.getItem('accessToken');
        if (!token) throw new Error('Not authenticated. Please log in again.');

        const response = await fetch(submission.fileUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('You do not have access to this file.');
          }
          if (response.status === 404) {
            throw new Error('File not found on the server.');
          }
          throw new Error(`Failed to load PDF (status ${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setPdfSrc(blobUrl);

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        fetchedDoc = await loadingTask.promise;

        if (cancelled) {
          fetchedDoc.destroy();
          URL.revokeObjectURL(blobUrl);
          blobUrlRef.current = null;
          return;
        }

        setPdfDoc(fetchedDoc);
        setTotalPages(fetchedDoc.numPages);
      } catch (err) {
        console.error('❌ Error loading PDF:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (fetchedDoc) {
        try { fetchedDoc.destroy(); } catch (_) { /* ignore cleanup errors */ }
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [submission?.fileUrl, metaLoading]);

  // Render the current page only (single page view)
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;

    renderAbortRef.current = false;
    const container = containerRef.current;
    container.innerHTML = '';

    const renderPage = async () => {
      const dpr = window.devicePixelRatio || 1;
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      canvas.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)';
      canvas.style.borderRadius = '8px';
      canvas.style.background = 'white';
      canvas.style.maxWidth = '100%';

      ctx.scale(dpr, dpr);

      try {
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        if (err?.name === 'RenderingCancelledException') return;
        console.error('Render error:', err);
      }

      if (renderAbortRef.current) return;

      container.appendChild(canvas);
      setPagesRendered(currentPage);
    };

    renderPage();

    return () => {
      renderAbortRef.current = true;
      container.innerHTML = '';
    };
  }, [pdfDoc, currentPage, scale]);

  // Navigation functions
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPage = (pageNum) => {
    const num = parseInt(pageNum);
    if (num >= 1 && num <= totalPages) {
      setCurrentPage(num);
    }
  };

  const handlePageInputChange = (e) => {
    const val = parseInt(e.target.value);
    if (val >= 1 && val <= totalPages) {
      setCurrentPage(val);
    }
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(e.target.value);
      if (val >= 1 && val <= totalPages) {
        setCurrentPage(val);
      } else {
        e.target.value = currentPage;
      }
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3.0));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleZoomReset = () => setScale(1.0);

  const handleDownload = () => {
    if (!pdfSrc) return;
    const link = document.createElement('a');
    link.href = pdfSrc;
    let downloadName = (submission?.fileName || 'document').replace(/\s+/g, '_');
    if (!downloadName.endsWith('.pdf')) downloadName += '.pdf';
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==============================
  // Loading claim metadata
  // ==============================
  if (metaLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted small fw-semibold">Loading document details...</p>
        </div>
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="text-center bg-white p-5 rounded-3 shadow-sm border" style={{ maxWidth: '400px' }}>
          <i className="bi bi-exclamation-triangle fs-1 text-danger mb-3 d-block"></i>
          <h5 className="text-danger">Couldn't load this claim</h5>
          <p className="text-muted small mb-4">{metaError}</p>
          <button className="btn btn-secondary" onClick={handleBack}>
            <i className="bi bi-arrow-left me-1"></i> Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!submission?.fileUrl) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="text-center">
          <i className="bi bi-file-earmark-pdf fs-1 text-muted mb-3 d-block"></i>
          <h5 className="text-muted">No PDF available</h5>
          <p className="text-muted small">The document file could not be found for this claim</p>
          <button className="btn btn-secondary mt-3" onClick={handleBack}>
            <i className="bi bi-arrow-left me-1"></i> Go Back
          </button>
        </div>
      </div>
    );
  }

  // ==============================
  // Embedded mode (used in split layout)
  // ==============================
  if (embedded) {
    return (
      <div className="d-flex flex-column h-100">
        {/* Toolbar with navigation */}
        <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between" style={{ flexShrink: 0 }}>
          <div className="d-flex align-items-center gap-1">
            <button
              onClick={handleZoomOut}
              disabled={!pdfDoc}
              className="btn btn-outline-secondary btn-sm"
              title="Zoom Out"
            >
              <i className="bi bi-zoom-out"></i>
            </button>
            <button
              onClick={handleZoomReset}
              disabled={!pdfDoc}
              className="btn btn-outline-secondary btn-sm"
              style={{ minWidth: '50px' }}
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={!pdfDoc}
              className="btn btn-outline-secondary btn-sm"
              title="Zoom In"
            >
              <i className="bi bi-zoom-in"></i>
            </button>
            <span className="vr mx-1"></span>
            <button
              onClick={goToPreviousPage}
              disabled={!pdfDoc || currentPage <= 1}
              className="btn btn-outline-secondary btn-sm"
              title="Previous Page"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <div className="d-flex align-items-center gap-1">
              <input
                ref={pageInputRef}
                type="number"
                className="form-control form-control-sm"
                style={{ width: '50px', textAlign: 'center' }}
                value={currentPage}
                onChange={handlePageInputChange}
                onKeyDown={handlePageInputKeyDown}
                min={1}
                max={totalPages || 1}
                disabled={!pdfDoc}
              />
              <span className="text-muted small">/ {totalPages || '?'}</span>
            </div>
            <button
              onClick={goToNextPage}
              disabled={!pdfDoc || currentPage >= totalPages}
              className="btn btn-outline-secondary btn-sm"
              title="Next Page"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>

          <button
            onClick={handleDownload}
            disabled={!pdfSrc}
            className="btn btn-primary btn-sm"
          >
            <i className="bi bi-download me-1"></i> Download
          </button>
        </div>

        {/* PDF Canvas Area */}
        <div className="flex-grow-1" style={{ overflow: 'auto', backgroundColor: '#e2e8f0' }}>
          {loading && (
            <div className="d-flex align-items-center justify-content-center h-100">
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 text-muted small fw-semibold">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="d-flex align-items-center justify-content-center h-100">
              <div className="text-center bg-white p-5 rounded-3 shadow-sm border" style={{ maxWidth: '400px' }}>
                <i className="bi bi-exclamation-triangle fs-1 text-danger mb-3 d-block"></i>
                <h5 className="text-danger">Failed to load PDF</h5>
                <p className="text-muted small mb-4">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="py-4 px-3">
              <div ref={containerRef} />
              {pdfDoc && (
                <div className="text-center text-muted small mt-2">
                  Page {currentPage} of {totalPages}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==============================
  // Full page mode (standalone)
  // ==============================
  return (
    <div className="d-flex flex-column vh-100 bg-light">
      {/* Header */}
      <div className="bg-white border-bottom px-4 py-3 d-flex align-items-center justify-content-between shadow-sm" style={{ zIndex: 10, flexShrink: 0 }}>
        <div className="d-flex align-items-center gap-3">
          <button onClick={handleBack} className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-arrow-left me-1"></i> Back
          </button>
          <div>
            <h5 className="mb-0 fw-bold">
              <i className="bi bi-file-earmark-pdf-fill text-danger me-2"></i>
              {submission.fileName || 'Document'}
            </h5>
            <small className="text-muted">
              {submission.id} • {submission.fileSize || 'N/A'}
              {pdfDoc && totalPages > 0 && (
                <> • {totalPages} page{totalPages > 1 ? 's' : ''}</>
              )}
            </small>
          </div>
        </div>
      </div>

      {/* Toolbar with navigation */}
      <div className="bg-white border-bottom px-4 py-2 d-flex align-items-center justify-content-between shadow-sm" style={{ flexShrink: 0 }}>
        <div className="d-flex align-items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={!pdfDoc}
            className="btn btn-outline-secondary btn-sm"
            title="Zoom Out"
          >
            <i className="bi bi-zoom-out"></i>
          </button>
          <button
            onClick={handleZoomReset}
            disabled={!pdfDoc}
            className="btn btn-outline-secondary btn-sm"
            style={{ minWidth: '60px' }}
            title="Reset Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={!pdfDoc}
            className="btn btn-outline-secondary btn-sm"
            title="Zoom In"
          >
            <i className="bi bi-zoom-in"></i>
          </button>
          <span className="vr mx-2"></span>
          <button
            onClick={goToPreviousPage}
            disabled={!pdfDoc || currentPage <= 1}
            className="btn btn-outline-secondary btn-sm"
            title="Previous Page"
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <div className="d-flex align-items-center gap-1">
            <input
              ref={pageInputRef}
              type="number"
              className="form-control form-control-sm"
              style={{ width: '60px', textAlign: 'center' }}
              value={currentPage}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              min={1}
              max={totalPages || 1}
              disabled={!pdfDoc}
            />
            <span className="text-muted small">/ {totalPages || '?'}</span>
          </div>
          <button
            onClick={goToNextPage}
            disabled={!pdfDoc || currentPage >= totalPages}
            className="btn btn-outline-secondary btn-sm"
            title="Next Page"
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>

        <button
          onClick={handleDownload}
          disabled={!pdfSrc}
          className="btn btn-primary btn-sm"
        >
          <i className="bi bi-download me-1"></i> Download PDF
        </button>
      </div>

      {/* PDF Canvas Area */}
      <div className="flex-grow-1" style={{ overflow: 'auto', backgroundColor: '#e2e8f0' }}>
        {loading && (
          <div className="d-flex align-items-center justify-content-center h-100">
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 text-muted small fw-semibold">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="d-flex align-items-center justify-content-center h-100">
            <div className="text-center bg-white p-5 rounded-3 shadow-sm border" style={{ maxWidth: '400px' }}>
              <i className="bi bi-exclamation-triangle fs-1 text-danger mb-3 d-block"></i>
              <h5 className="text-danger">Failed to load PDF</h5>
              <p className="text-muted small mb-4">{error}</p>
              <button className="btn btn-secondary" onClick={handleBack}>
                <i className="bi bi-arrow-left me-1"></i> Go Back
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="py-4 px-3">
            <div ref={containerRef} />
            {pdfDoc && (
              <div className="text-center text-muted small mt-2">
                Page {currentPage} of {totalPages}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}