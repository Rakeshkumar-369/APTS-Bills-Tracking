// src/pages/PdfViewerPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { claimsService } from '../services';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const SERVER_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Converts any relative path returned by the backend (e.g. "uploads\\claims\\10\\file.pdf")
// into a full absolute URL against the API server's origin, normalizing Windows-style
// backslashes to forward slashes along the way.
function toAbsoluteUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path.replace(/\\/g, '/');

  let normalized = path.replace(/\\/g, '/');
  normalized = normalized.replace(/^\/?/, '/');

  return `${SERVER_ORIGIN}${normalized}`;
}

export default function PdfViewerPage({ claimId: claimIdProp, onBack: onBackProp } = {}) {
  const navigate = useNavigate();
  const { claimId: claimIdFromRoute } = useParams();

  // Works both as a standalone route (/pdf-viewer/:claimId) and as an
  // inline view embedded directly inside another page (e.g. UnifiedDashboard),
  // which is what lets "Back" return to that page's own previous view/state
  // instead of unmounting everything via router navigation.
  const claimId = claimIdProp ?? claimIdFromRoute;
  const handleBack = onBackProp ?? (() => navigate(-1));

  // claim/file metadata, fetched independently by this page (not passed via
  // router state, which is unreliable across reloads/new tabs/HMR).
  const [submission, setSubmission] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);

  // PDF.js state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfSrc, setPdfSrc] = useState(null); // blob URL, used for download
  const [pagesRendered, setPagesRendered] = useState(0);

  const blobUrlRef = useRef(null);
  const containerRef = useRef(null);
  const renderAbortRef = useRef(false);

  // Step 1: fetch claim + file metadata for this claimId
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

          // Prefer the existing authenticated download endpoint (same one the
          // "Download" button already uses successfully) over a raw file_path.
          // file_path points at a static file location the backend doesn't
          // actually serve over HTTP, so it always 404s — the /api endpoint
          // is a real, working, authenticated route.
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

  // Step 2: once we know the fileUrl, fetch the PDF (with auth header) and hand it to pdf.js
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

        const token = localStorage.getItem('accessToken');
        if (!token) throw new Error('Not authenticated. Please log in again.');

        // Fetching directly (instead of using fileUrl as an <iframe>/<a> src) lets
        // us attach the Authorization header, which iframes/links cannot send.
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

  // Render every page as a canvas, stacked vertically for continuous scroll
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;

    renderAbortRef.current = false;
    const container = containerRef.current;
    container.innerHTML = '';

    const renderAllPages = async () => {
      const dpr = window.devicePixelRatio || 1;

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (renderAbortRef.current) return;

        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto 16px auto';
        canvas.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)';
        canvas.style.borderRadius = '8px';
        canvas.style.background = 'white';
        canvas.style.maxWidth = '100%';

        ctx.scale(dpr, dpr);

        try {
          await page.render({ canvasContext: ctx, viewport }).promise;
        } catch (err) {
          if (err?.name === 'RenderingCancelledException') return;
        }

        if (renderAbortRef.current) return;

        container.appendChild(canvas);
        setPagesRendered(i);
      }
    };

    renderAllPages();

    return () => {
      renderAbortRef.current = true;
      container.innerHTML = '';
    };
  }, [pdfDoc, scale]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3.0));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleZoomReset = () => setScale(1.2);

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
              {pdfDoc && pagesRendered > 0 && pagesRendered < totalPages && (
                <span className="text-warning"> • rendering {pagesRendered}/{totalPages}</span>
              )}
            </small>
          </div>
        </div>
      </div>

      {/* Toolbar */}
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

            {pdfDoc && pagesRendered > 0 && pagesRendered < totalPages && (
              <div className="mt-3 text-center">
                <div className="mx-auto bg-secondary bg-opacity-25 rounded-pill" style={{ maxWidth: '320px', height: '6px', overflow: 'hidden' }}>
                  <div
                    className="bg-primary h-100"
                    style={{ width: `${(pagesRendered / totalPages) * 100}%`, transition: 'width 0.3s ease' }}
                  />
                </div>
                <p className="text-muted small mt-2 fw-semibold">
                  Rendering page {pagesRendered} of {totalPages}…
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}