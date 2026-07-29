import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { poService, claimsService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function VendorPOClaimsHistory() {
  const { projectId, poId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [poDetails, setPoDetails] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const vendorId = user?.vendor_id;

        // 1. Fetch Purchase Order Details
        try {
          if (poService.getById) {
            const poRes = await poService.getById(poId);
            setPoDetails(poRes?.data || poRes);
          } else {
            const fetchList = poService.list || poService.getAll;
            const poListRes = await fetchList({ vendor_id: vendorId, project_id: projectId });
            const list = Array.isArray(poListRes?.data?.items)
              ? poListRes.data.items
              : Array.isArray(poListRes?.data)
              ? poListRes.data
              : Array.isArray(poListRes)
              ? poListRes
              : [];
            const found = list.find((p) => String(p.id) === String(poId));
            setPoDetails(found || null);
          }
        } catch (poErr) {
          console.warn('Error fetching PO details:', poErr);
        }

        // 2. Fetch Previously Submitted Claims for this PO
        try {
          const fetchClaims = claimsService.list || claimsService.getAll;
          const claimsRes = await fetchClaims({ po_id: poId, vendor_id: vendorId });
          
          const rawClaims = Array.isArray(claimsRes?.data?.items)
            ? claimsRes.data.items
            : Array.isArray(claimsRes?.data)
            ? claimsRes.data
            : Array.isArray(claimsRes)
            ? claimsRes
            : [];

          // Filter claims strictly for this PO
          const filteredClaims = rawClaims.filter(
            (c) => String(c.po_id) === String(poId)
          );

          setClaims(filteredClaims);
        } catch (claimsErr) {
          console.warn('No claims found or failed to fetch claims:', claimsErr);
          setClaims([]);
        }
      } catch (err) {
        console.error('Error in VendorPOClaimsHistory:', err);
        setError('Failed to fetch details for this purchase order.');
      } finally {
        setLoading(false);
      }
    };

    if (poId && user) {
      fetchData();
    }
  }, [poId, projectId, user]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading claims history...</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'APPROVED':
      case 'PAID':
        return 'bg-success';
      case 'REJECTED':
        return 'bg-danger';
      case 'PENDING':
      case 'UNDER_REVIEW':
        return 'bg-warning text-dark';
      default:
        return 'bg-secondary';
    }
  };

  return (
    <div className="container-fluid py-4">
      {/* Header & Back Button */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <button
            onClick={() => navigate(`/vendor/claims/project/${projectId}`)}
            className="btn btn-sm btn-outline-secondary mb-2"
          >
            <i className="bi bi-arrow-left me-1"></i>
            Back to Purchase Orders
          </button>
          <h4 className="fw-bold mb-1">
            PO #{poDetails?.po_number || poDetails?.number || poId} - Claims History
          </h4>
          <p className="text-muted mb-0">
            Total PO Value:{' '}
            <span className="fw-bold text-dark">
              ₹{Number(poDetails?.amount || poDetails?.total_value || 0).toLocaleString('en-IN')}
            </span>
          </p>
        </div>

        {/* Primary Action Button to Create New Claim */}
        <div>
          <button
            onClick={() =>
              navigate(`/vendor/claims/create?projectId=${projectId}&poId=${poId}`)
            }
            className="btn btn-primary btn-lg shadow-sm d-flex align-items-center gap-2"
          >
            <i className="bi bi-plus-circle-fill"></i>
            Submit New Claim / Bill
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Claims List Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3 border-bottom">
          <h6 className="fw-bold mb-0 text-dark">
            Previously Submitted Claims ({claims.length})
          </h6>
        </div>

        {claims.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="bi bi-receipt fs-1 text-muted"></i>
            <h6 className="mt-3 text-muted">No claims have been submitted yet for this Purchase Order</h6>
            <p className="text-muted small">
              Click "Submit New Claim / Bill" above to start a claim submission.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small text-uppercase">
                <tr>
                  <th className="ps-4">Claim Ref #</th>
                  <th>Submission Date</th>
                  <th>Claim Amount</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id || claim.claim_id}>
                    <td className="ps-4 fw-bold text-dark">
                      {claim.claim_number || claim.reference_no || `#${claim.id}`}
                    </td>
                    <td className="text-muted small">
                      {claim.created_at || claim.submission_date
                        ? new Date(claim.created_at || claim.submission_date).toLocaleString(
                            'en-IN',
                            { dateStyle: 'medium', timeStyle: 'short' }
                          )
                        : 'N/A'}
                    </td>
                    <td className="fw-bold text-dark">
                      ₹{Number(claim.amount || claim.claim_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(claim.status)}`}>
                        {claim.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        onClick={() => navigate(`/vendor/claims/${claim.id || claim.claim_id}`)}
                        className="btn btn-sm btn-outline-primary"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}