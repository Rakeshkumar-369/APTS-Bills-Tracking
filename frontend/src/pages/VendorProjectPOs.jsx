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
  const [success, setSuccess] = useState('');

  // Date modal state
  const [datePo, setDatePo] = useState(null);
  const [dateForm, setDateForm] = useState({ vendor_delivery_date: '', installation_date: '' });
  const [dateError, setDateError] = useState('');
  const [savingDates, setSavingDates] = useState(false);

  const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');
  const formatDate = (v) => {
    const s = toDateInput(v);
    if (!s) return 'Not set';
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const openDateModal = (po) => {
    setDatePo(po);
    setDateError('');
    setDateForm({
      vendor_delivery_date: toDateInput(po.my_delivery_date),
      installation_date: toDateInput(po.my_installation_date),
    });
  };

  const handleSaveDates = async () => {
    if (
      dateForm.vendor_delivery_date && dateForm.installation_date &&
      dateForm.installation_date < dateForm.vendor_delivery_date
    ) {
      setDateError('Installation date cannot be before the delivery date');
      return;
    }
    try {
      setSavingDates(true);
      setDateError('');
      await poService.updateVendorDates(datePo.id, dateForm);
      setPurchaseOrders((prev) =>
        prev.map((p) =>
          p.id === datePo.id
            ? { ...p, my_delivery_date: dateForm.vendor_delivery_date || null, my_installation_date: dateForm.installation_date || null }
            : p
        )
      );
      setDatePo(null);
      setSuccess(`Dates saved for PO #${datePo.po_number}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setDateError(err?.response?.data?.message || err?.message || 'Failed to save dates');
    } finally {
      setSavingDates(false);
    }
  };

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

      {success && (
        <div className="alert alert-success alert-dismissible fade show">
          <i className="bi bi-check-circle-fill me-2"></i>
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
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

                    <div className="bg-light rounded-3 p-2 mb-2 small">
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Delivery Date:</span>
                        <span className="fw-semibold">{formatDate(po.my_delivery_date)}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Installation Date:</span>
                        <span className="fw-semibold">{formatDate(po.my_installation_date)}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary w-100 mt-2"
                        onClick={(e) => { e.stopPropagation(); openDateModal(po); }}
                      >
                        <i className="bi bi-calendar-event me-1"></i>
                        {po.my_delivery_date || po.my_installation_date ? 'Edit Dates' : 'Set Dates'}
                      </button>
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

      {/* Set Dates Modal */}
      {datePo && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setDatePo(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Delivery &amp; Installation Dates</h5>
                <button type="button" className="btn-close" onClick={() => setDatePo(null)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3">PO #{datePo.po_number}</p>
                {dateError && <div className="alert alert-danger py-2 small">{dateError}</div>}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Delivery Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateForm.vendor_delivery_date}
                    onChange={(e) => setDateForm({ ...dateForm, vendor_delivery_date: e.target.value })}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold">Installation Date</label>
                  <input
                    type="date"
                    className="form-control"
                    min={dateForm.vendor_delivery_date || undefined}
                    value={dateForm.installation_date}
                    onChange={(e) => setDateForm({ ...dateForm, installation_date: e.target.value })}
                  />
                </div>
                <small className="text-muted">Leave a field empty to clear it.</small>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setDatePo(null)} disabled={savingDates}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveDates} disabled={savingDates}>
                  {savingDates ? 'Saving...' : 'Save Dates'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}