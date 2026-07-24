import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { packagesService, projectsService, poService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function PackageCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [projects, setProjects] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [formData, setFormData] = useState({
    project_id: '',
    po_id: '',
    remarks: '',
    files: [],
  });

  // Fetch vendor's projects and purchase orders on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const vendorId = user?.vendor_id;
        if (!vendorId) {
          setError('No vendor ID found. Please contact administrator.');
          setLoading(false);
          return;
        }

        // Fetch projects assigned to this vendor
        const projectList = await projectsService.list({ vendor_id: vendorId });
        setProjects(projectList || []);

        // Fetch all POs for this vendor (will be filtered later by project)
        const { data: poList } = await poService.list({ vendor_id: vendorId });
        setPurchaseOrders(poList || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load required data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchInitialData();
  }, [user]);

  // Filter POs based on selected project (and ensure they are active)
  const filteredPOs = purchaseOrders.filter(
    po => po.status === 'ACTIVE' && (!formData.project_id || po.project_id === parseInt(formData.project_id))
  );

  // Reset PO selection when project changes
  const handleProjectChange = (e) => {
    const projectId = e.target.value;
    setFormData(prev => ({ ...prev, project_id: projectId, po_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.project_id) {
      setError('Please select a project');
      return;
    }
    if (!formData.po_id) {
      setError('Please select a Purchase Order');
      return;
    }
    if (!formData.remarks || formData.remarks.trim().length < 3) {
      setError('Please enter remarks (minimum 3 characters)');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const vendorId = user?.vendor_id;
      const userId = user?.id;

      if (!vendorId) throw new Error('No vendor ID found. Please contact administrator.');

      const packageData = {
        vendor_id: parseInt(vendorId),
        project_id: parseInt(formData.project_id),
        po_id: parseInt(formData.po_id),
        remarks: formData.remarks.trim(),
      };
      if (userId) {
        packageData.vendor_contact_user_id = parseInt(userId);
      }

      const createdPackage = await packagesService.create(packageData, formData.files);
      console.log('Package created:', createdPackage);

      setSuccess('Package created successfully!');
      setTimeout(() => navigate('/vendor/packages'), 2000);
    } catch (err) {
      console.error('Error creating package:', err);
      setError(err.message || 'Failed to create package. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({ ...prev, files }));
  };

  const removeFile = (index) => {
    const newFiles = [...formData.files];
    newFiles.splice(index, 1);
    setFormData(prev => ({ ...prev, files: newFiles }));
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading your projects and purchase orders...</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <div className="card-header bg-white border-bottom p-4">
              <h4 className="mb-0 fw-bold">
                <i className="bi bi-plus-circle text-primary me-2"></i>
                Create New Package
              </h4>
              <p className="text-muted small mb-0">Submit a new package for approval workflow</p>
            </div>

            <div className="card-body p-4">
              {error && (
                <div className="alert alert-danger alert-dismissible fade show">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                  <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
              )}
              {success && (
                <div className="alert alert-success alert-dismissible fade show">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  {success}
                  <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Project */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-folder text-primary me-1"></i>
                    Select Project <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.project_id}
                    onChange={handleProjectChange}
                    required
                  >
                    <option value="">Choose a project...</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.project_name || project.name}
                        {project.project_code ? ` (${project.project_code})` : ''}
                      </option>
                    ))}
                  </select>
                  {projects.length === 0 && (
                    <div className="mt-2">
                      <small className="text-warning">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        No projects assigned to you. Please contact the administrator.
                      </small>
                    </div>
                  )}
                </div>

                {/* Purchase Order */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-receipt text-primary me-1"></i>
                    Select Purchase Order <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.po_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, po_id: e.target.value }))}
                    required
                    disabled={!formData.project_id}
                  >
                    <option value="">
                      {!formData.project_id ? 'Select a project first' : 'Choose a PO...'}
                    </option>
                    {filteredPOs.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} - ₹{parseFloat(po.amount).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                  {formData.project_id && filteredPOs.length === 0 && (
                    <div className="mt-2">
                      <small className="text-warning">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        No active Purchase Orders found for this project. Please contact the administrator.
                      </small>
                    </div>
                  )}
                </div>

                {/* Remarks */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-chat text-primary me-1"></i>
                    Remarks <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Provide details about this package..."
                    value={formData.remarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    required
                    minLength="3"
                  />
                  <small className="text-muted">
                    Minimum 3 characters. Describe the package contents and purpose.
                  </small>
                </div>

                {/* File attachments */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-file-earmark-arrow-up text-primary me-1"></i>
                    Attach Files
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                  />
                  <small className="text-muted">
                    Supported formats: PDF, Word, Excel, Images (Max 10MB each)
                  </small>

                  {formData.files.length > 0 && (
                    <div className="mt-3">
                      <label className="fw-semibold small">Selected Files:</label>
                      <div className="list-group mt-1">
                        {formData.files.map((file, index) => (
                          <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                              <i className="bi bi-file-earmark-pdf text-danger me-2"></i>
                              {file.name}
                              <span className="text-muted ms-2 small">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeFile(index)}
                            >
                              <i className="bi bi-x"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || projects.length === 0}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Creating Package...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-1"></i>
                        Create Package
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/vendor/packages')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>

            <div className="card-footer bg-light p-4">
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-info-circle text-primary mt-1"></i>
                <div>
                  <h6 className="mb-1 fw-semibold">Package Workflow Information</h6>
                  <p className="mb-0 small text-muted">
                    Once created, your package will be submitted to the Project Manager for review.
                    You will be notified of any updates or requests for revision.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}