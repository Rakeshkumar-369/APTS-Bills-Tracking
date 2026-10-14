// src/pages/PdfViewerPage.jsx
// Authenticated document viewer for claim attachments. PDFs render with PDF.js
// (page-by-page, so large bills stay responsive); images render directly.
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
// "legacy" build = same PDF.js with polyfills, so bills render on the slightly
// older Chrome / Edge versions common on office PCs (the modern build needs
// very recent JS features such as Map.prototype.getOrInsertComputed).
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { api, saveBlob } from '../services/apiClient';
import { claimsService } from '../services';
import { decodeEntities } from '../utils/text';
import { useAuth } from '../context/AuthContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const isPdf = (f) => /\.pdf$/i.test(f?.original_name || '') || f?.mime_type === 'application/pdf';
const isImage = (f) => /\.(png|jpe?g|webp)$/i.test(f?.original_name || '') || /^image\//.test(f?.mime_type || '');

// Invoices first, then certification documents; newest first within each group
function orderFiles(files) {
  return [...(files || [])].sort((a, b) => {
    if (a.document_type !== b.document_type) return a.document_type === 'CERTIFICATION' ? 1 : -1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function Toolbar({ files, selectedId, onSelect, pdfDoc, scale, setScale, currentPage, totalPages, setCurrentPage, onDownload, canDownload }) {
  return (
    <div className="bg-white border-bottom px-2 px-md-3 py-2 d-flex flex-wrap align-items-center gap-2 justify-content-between" style={{ flexShrink: 0 }}>
      <div className="d-flex align-items-center gap-1 flex-wrap">
        {files.length > 1 && (
          <select
            className="form-select form-select-sm me-1"
            style={{ maxWidth: 220 }}
            value={selectedId ?? ''}
            onChange={(e) => onSelect(Number(e.target.value))}
            aria-label="Select document"
          >
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.document_type === 'CERTIFICATION' ? '[Cert] ' : ''}{decodeEntities(f.original_name)}
              </option>
            ))}
          </select>
        )}
        {pdfDoc && (
          <>
            <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.5))} className="btn btn-outline-secondary btn-sm" title="Zoom out" aria-label="Zoom out">
              <i className="bi bi-zoom-out"></i>
            </button>
            <button onClick={() => setScale(1)} className="btn btn-outline-secondary btn-sm" style={{ minWidth: 52 }} title="Reset zoom">
              {Math.round(scale * 100)}%
            </button>
            <button onClick={() => setScale((s) => Math.min(s + 0.2, 3))} className="btn btn-outline-secondary btn-sm" title="Zoom in" aria-label="Zoom in">
              <i className="bi bi-zoom-in"></i>
            </button>
            <span className="vr mx-1"></span>
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="btn btn-outline-secondary btn-sm" aria-label="Previous page">
              <i className="bi bi-chevron-left"></i>
            </button>
            <span className="text-muted small px-1">{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="btn btn-outline-secondary btn-sm" aria-label="Next page">
              <i className="bi bi-chevron-right"></i>
            </button>
          </>
        )}
      </div>
      <button onClick={onDownload} disabled={!canDownload} className="btn btn-primary btn-sm">
        <i className="bi bi-download me-1"></i> Download
      </button>
    </div>
  );
}

export default function PdfViewerPage({ claimId: claimIdProp, files: filesProp, embedded = false } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { claimId: claimIdFromRoute } = useParams();
  const claimId = claimIdProp ?? claimIdFromRoute;

  // Back button. The viewer is normally opened in a NEW browser tab, which has no
  // history, so navigate(-1) would land on a blank page. In that case close the tab
  // (returning to the original tab) or, if the browser refuses, go to the claim page.
  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1); // opened from inside the app — a normal step back works
      return;
    }
    const basePath =
      { 100: '/admin', 80: '/admin', 10: '/vendor', 30: '/officer', 40: '/officer', 50: '/officer', 60: '/manager' }[
        user?.role_rank
      ];
    const claimPath = basePath && basePath !== '/admin' ? `${basePath}/claims/${claimId}` : '/';
    window.close();
    // If the tab could not be closed by script, fall back to the claim page
    setTimeout(() => navigate(claimPath, { replace: true }), 200);
  };

  const [claimMeta, setClaimMeta] = useState(null);
  const [fetchedFiles, setFetchedFiles] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [doc, setDoc] = useState(null); // { blob, url, kind }
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  // Files come from the parent (ClaimDetail) when embedded; standalone page fetches them
  useEffect(() => {
    if (filesProp || !claimId) return undefined;
    let cancelled = false;
    claimsService.get(claimId, { includeDetails: true })
      .then((details) => {
        if (cancelled) return;
        setClaimMeta({ code: details?.claim_code, vendor: details?.vendor_name });
        setFetchedFiles(details?.files || []);
      })
      .catch((err) => { if (!cancelled) setMetaError(err.message || 'Failed to load claim'); });
    return () => { cancelled = true; };
  }, [claimId, filesProp]);

  const files = useMemo(
    () => orderFiles(filesProp || fetchedFiles || []).filter((f) => isPdf(f) || isImage(f)),
    [filesProp, fetchedFiles]
  );
  const selected = files.find((f) => f.id === selectedId) || files[0] || null;
  const selectedFileId = selected?.id ?? null;
  const selectedIsPdf = isPdf(selected);

  // Fetch the selected document through the authenticated API client
  useEffect(() => {
    if (!selectedFileId || !claimId) return undefined;
    let cancelled = false;
    let objectUrl = null;
    let loadedPdf = null;
    let loadingTask = null; // in pdfjs v6 destroy() lives on the loading task, not the document

    (async () => {
      setLoading(true);
      setError(null);
      setPdfDoc(null);
      setDoc(null);
      setCurrentPage(1);
      try {
        const { blob } = await api.blob(`/claims/${claimId}/files/${selectedFileId}/download`);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        if (selectedIsPdf) {
          loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(await blob.arrayBuffer()),
            isEvalSupported: false, // never use eval() while parsing untrusted PDFs
            enableXfa: false,
          });
          loadedPdf = await loadingTask.promise;
          if (cancelled) return;
          setPdfDoc(loadedPdf);
          setTotalPages(loadedPdf.numPages);
          setDoc({ blob, url: objectUrl, kind: 'pdf' });
        } else {
          setDoc({ blob, url: objectUrl, kind: 'image' });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.status === 404 ? 'File not found on the server.' : err.message || 'Failed to load document');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // Never let a cleanup error crash the page (this previously blanked the screen on Back)
      try {
        if (loadingTask) loadingTask.destroy()?.catch?.(() => {});
        else if (loadedPdf?.destroy) loadedPdf.destroy()?.catch?.(() => {});
      } catch { /* ignore */ }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [claimId, selectedFileId, selectedIsPdf]);

  // Render the current PDF page into a single reusable canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return undefined;
    let task = null;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      task = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      try { await task.promise; } catch { /* render cancelled */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdfDoc, currentPage, scale]);

  const handleDownload = () => {
    if (doc?.blob) saveBlob(doc.blob, decodeEntities(selected?.original_name) || 'document');
  };

  const toolbar = (
    <Toolbar
      files={files}
      selectedId={selected?.id}
      onSelect={setSelectedId}
      pdfDoc={pdfDoc}
      scale={scale}
      setScale={setScale}
      currentPage={currentPage}
      totalPages={totalPages}
      setCurrentPage={setCurrentPage}
      onDownload={handleDownload}
      canDownload={Boolean(doc)}
    />
  );

  let body;
  if (metaError) {
    body = <div className="alert alert-danger m-4">{metaError}</div>;
  } else if (!filesProp && fetchedFiles === null) {
    body = <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /></div>;
  } else if (!selected) {
    body = (
      <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted p-5 text-center">
        <i className="bi bi-file-earmark-pdf fs-1 mb-2"></i>
        <h6 className="fw-bold text-dark mb-1">No document available</h6>
        <p className="small mb-0">No PDF or image is attached to this claim.</p>
      </div>
    );
  } else {
    body = (
      <>
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
            <p className="mt-3 text-muted small fw-semibold">Loading document...</p>
          </div>
        )}
        {error && <div className="alert alert-danger m-4">{error}</div>}
        <div className="py-3 px-2 text-center" style={{ display: loading || error ? 'none' : 'block' }}>
          {doc?.kind === 'image' ? (
            <img src={doc.url} alt={decodeEntities(selected.original_name)} className="img-fluid rounded shadow-sm bg-white" />
          ) : (
            <canvas ref={canvasRef} className="rounded shadow-sm bg-white" style={{ maxWidth: '100%', height: 'auto' }} />
          )}
        </div>
      </>
    );
  }

  if (embedded) {
    return (
      <div className="d-flex flex-column h-100">
        {toolbar}
        <div className="flex-grow-1" style={{ overflow: 'auto', backgroundColor: '#e2e8f0' }}>{body}</div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column vh-100 bg-light">
      <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-3 shadow-sm" style={{ flexShrink: 0 }}>
        <button onClick={handleBack} className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left me-1"></i> Back
        </button>
        <div className="text-truncate">
          <h6 className="mb-0 fw-bold text-truncate">
            <i className="bi bi-file-earmark-text text-danger me-2"></i>
            {decodeEntities(selected?.original_name) || 'Document'}
          </h6>
          <small className="text-muted">{claimMeta?.code}{claimMeta?.vendor ? ` • ${decodeEntities(claimMeta.vendor)}` : ''}</small>
        </div>
      </div>
      {toolbar}
      <div className="flex-grow-1" style={{ overflow: 'auto', backgroundColor: '#e2e8f0' }}>{body}</div>
    </div>
  );
}