import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

export default function OfficerClaimReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState('FORWARD'); // 'FORWARD' or 'SEND_BACK'
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchClaimDetails();
  }, [id]);

  const fetchClaimDetails = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/claims/${id}`);
      setClaim(res.data?.data || res.data);
    } catch (err) {
      console.error("Failed to load claim details:", err);
      alert("Failed to load claim details. Please check the network connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    if (!remarks.trim()) {
      alert("Please provide remarks for this action.");
      return;
    }

    try {
      setSubmitting(true);
      
      // Determine endpoint based on forward / send back selection
      const endpoint = actionType === 'FORWARD' 
        ? `/claims/${id}/approve` 
        : `/claims/${id}/reject`;

      await apiClient.post(endpoint, { remarks });

      alert(`Claim successfully ${actionType === 'FORWARD' ? 'forwarded' : 'sent back'}.`);

      // Navigate back to inbox after successful action
      navigate(-1);
    } catch (err) {
      console.error("Action submission error:", err);
      const errMsg = err.response?.data?.message || "Failed to submit action. Please try again.";
      alert(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light text-secondary font-medium">
        <div className="spinner-border me-2" role="status"></div>
        Loading Claim Review Session...
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-5 text-center text-danger font-semibold">
        Claim details could not be found or loaded.
      </div>
    );
  }

  // Handle PDF URL retrieval securely
  const pdfUrl = claim.fileUrl || (claim.attachmentPath ? `${apiClient.defaults.baseURL}/files/${claim.attachmentPath}` : null);

  return (
    <div className="d-flex flex-column vh-100 bg-light overflow-hidden">
      {/* Header Bar */}
      <header className="bg-white border-bottom px-4 py-3 d-flex justify-content-between align-items-center shadow-sm z-10">
        <div className="d-flex align-items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-outline-secondary font-semibold"
          >
            ← Back
          </button>
          <span className="vr"></span>
          <h5 className="mb-0 font-bold text-dark">
            Claim #{claim.claimNumber || claim.claim_code || claim.id}
          </h5>
          <span className={`badge ${
            claim.status === 'APPROVED' ? 'bg-success' :
            claim.status === 'REJECTED' ? 'bg-danger' : 'bg-warning text-dark'
          }`}>
            {claim.status || 'PENDING'}
          </span>
        </div>

        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-primary"
          >
            Open Document in New Tab ↗
          </a>
        )}
      </header>

      {/* Main Split-Pane Workspace */}
      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Left Pane: PDF Viewer */}
        <div className="w-50 border-end bg-secondary-subtle d-flex flex-column h-100">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Bill PDF Preview"
              className="w-100 h-100 border-0"
            />
          ) : (
            <div className="d-flex flex-column items-center justify-content-center h-100 text-muted p-5 text-center">
              <i className="bi bi-file-earmark-pdf fs-1 mb-2"></i>
              <p className="mb-0">No PDF document attached to this claim.</p>
            </div>
          )}
        </div>

        {/* Right Pane: Info Summary & Officer Decision Form */}
        <div className="w-50 bg-white d-flex flex-column h-100 overflow-y-auto p-4">
          
          {/* Section 1: Summary Details */}
          <div className="mb-4 bg-light p-3 rounded border">
            <h6 className="text-uppercase text-secondary fw-bold mb-3 small">
              Claim Summary
            </h6>
            <div className="row g-3 text-sm">
              <div className="col-6">
                <span className="text-muted d-block small">Vendor Name</span>
                <strong className="text-dark">{claim.vendor_name || claim.vendorName || claim.Vendor?.name || 'N/A'}</strong>
              </div>
              <div className="col-6">
                <span className="text-muted d-block small">Claim Amount</span>
                <strong className="text-success fs-6">
                  ₹{Number(claim.amount || 0).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="col-6">
                <span className="text-muted d-block small">PO Reference</span>
                <strong className="text-dark">{claim.po_number || claim.poNumber || 'N/A'}</strong>
              </div>
              <div className="col-6">
                <span className="text-muted d-block small">Project</span>
                <strong className="text-dark">{claim.project_name || claim.projectName || 'N/A'}</strong>
              </div>
              <div className="col-12 border-top pt-2">
                <span className="text-muted d-block small">Current Step</span>
                <span className="text-primary font-medium">{claim.current_step_name || claim.currentStageName || 'In Review'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Officer Decision Panel */}
          <div className="flex-grow-1 d-flex flex-column justify-between">
            <form onSubmit={handleSubmitAction} className="d-flex flex-column gap-3">
              <h6 className="text-uppercase text-secondary fw-bold mb-0 small">
                Officer Review Action
              </h6>

              {/* Action Selection */}
              <div className="row g-2">
                <div className="col-6">
                  <button
                    type="button"
                    onClick={() => setActionType('FORWARD')}
                    className={`btn w-100 py-2 btn-sm font-bold ${
                      actionType === 'FORWARD'
                        ? 'btn-primary shadow-sm'
                        : 'btn-outline-secondary'
                    }`}
                  >
                    1. Forward to Next Officer
                  </button>
                </div>

                <div className="col-6">
                  <button
                    type="button"
                    onClick={() => setActionType('SEND_BACK')}
                    className={`btn w-100 py-2 btn-sm font-bold ${
                      actionType === 'SEND_BACK'
                        ? 'btn-danger shadow-sm'
                        : 'btn-outline-secondary'
                    }`}
                  >
                    2. Send Back
                  </button>
                </div>
              </div>

              {/* Remarks Box */}
              <div>
                <label className="form-label text-dark fw-semibold small mb-1">
                  Officer Remarks <span className="text-danger">*</span>
                </label>
                <textarea
                  rows="4"
                  required
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={
                    actionType === 'FORWARD'
                      ? 'Add forward approval notes, compliance verification remarks...'
                      : 'Specify reasons for sending back or requested modifications...'
                  }
                  className="form-control form-control-sm"
                />
              </div>

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className={`btn w-100 py-2 font-bold text-white shadow-sm ${
                  actionType === 'FORWARD' ? 'btn-success' : 'btn-danger'
                }`}
              >
                {submitting
                  ? 'Processing Action...'
                  : actionType === 'FORWARD'
                  ? 'Confirm & Forward Claim'
                  : 'Confirm & Send Back Claim'}
              </button>
            </form>

            {/* Micro Helper Note */}
            <p className="text-muted small mt-4 text-center">
              * Action will log your digital audit signature and update the workflow sequence immediately.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}