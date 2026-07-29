import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { poService, projectsService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function VendorProjectPOs() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const vendorId = user?.vendor_id;

        // 1. Fetch Project Details
        try {
          if (projectsService.getById) {
            const projRes = await projectsService.getById(projectId);
            setProject(projRes?.data || projRes);
          } else {
            const projectListRes = await projectsService.list({ vendor_id: vendorId });
            const list = Array.isArray(projectListRes?.data?.items)
              ? projectListRes.data.items
              : Array.isArray(projectListRes?.data)
              ? projectListRes.data
              : Array.isArray(projectListRes)
              ? projectListRes
              : [];
            const found = list.find((p) => String(p.id) === String(projectId));
            setProject(found || null);
          }
        } catch (projErr) {
          console.warn('Could not fetch project by ID, falling back to list:', projErr);
        }

        // 2. Fetch POs matching this Vendor and Project
        try {
          const fetchMethod = poService.list || poService.getAll;
          const poResponse = await fetchMethod({ vendor_id: vendorId, project_id: projectId });

          const rawData = poResponse?.data?.items || poResponse?.data || poResponse || [];
          const allPOs = Array.isArray(rawData) ? rawData : [];

          // Filter POs strictly for this project
          const filteredPOs = allPOs.filter(
            (po) => String(po.project_id) === String(projectId)
          );

          setPurchaseOrders(filteredPOs);
        } catch (poErr) {
          console.error('Failed to load purchase orders:', poErr);
          setError('Failed to load purchase orders for this project.');
        }
      } catch (err) {
        console.error('Error in VendorProjectPOs:', err);
        setError('Something went wrong while fetching project details.');
      } finally {
        setLoading(false);
      }
    };

    if (projectId && user) {
      fetchData();
    }
  }, [projectId, user]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading purchase orders...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Back Button & Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <button
            onClick={() => navigate('/vendor/claims/create')}
            className="btn btn-sm btn-outline-secondary mb-2"
          >
            <i className="bi bi-arrow-left me-1"></i>
            Back to Projects
          </button>
          <h4 className="fw-bold mb-1">
            Purchase Orders for {project?.project_name || project?.name || `Project #${projectId}`}
          </h4>
          {(project?.project_code || project?.code) && (
            <span className="badge bg-primary bg-opacity-10 text-primary">
              Code: {project.project_code || project.code}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Purchase Orders Cards Grid */}
      {purchaseOrders.length === 0 ? (
        <div className="text-center py-5 bg-white rounded border">
          <i className="bi bi-receipt-cutoff fs-1 text-muted"></i>
          <h5 className="mt-3 text-muted">No Purchase Orders found for this project</h5>
          <p className="text-muted small">
            There are currently no purchase orders created under this project.
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {purchaseOrders.map((po) => (
            <div key={po.id || po.po_id} className="col-md-6 col-lg-4">
              <div
                className="card h-100 border-0 shadow-sm cursor-pointer hover-shadow transition-all"
                onClick={() =>
                  navigate(`/vendor/claims/project/${projectId}/po/${po.id || po.po_id}`)
                }
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div className="card-body p-4 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="badge bg-success bg-opacity-10 text-success px-3 py-2">
                        PO #{po.po_number || po.number || po.id}
                      </span>
                      <span className="badge bg-success">{po.status || 'ACTIVE'}</span>
                    </div>

                    <h5 className="fw-bold text-dark mb-2">
                      {po.title || po.description || `Purchase Order #${po.po_number || po.id}`}
                    </h5>

                    {po.description && (
                      <p className="text-muted small mb-3 text-truncate">{po.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted small">PO Amount:</span>
                      <span className="fw-bold text-dark">
                        ₹{Number(po.amount || po.total_value || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="d-flex justify-content-between align-items-center text-primary fw-semibold small mt-2">
                      <span>View Claim History</span>
                      <i className="bi bi-arrow-right"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}