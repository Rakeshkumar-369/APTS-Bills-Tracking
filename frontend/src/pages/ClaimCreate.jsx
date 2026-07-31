import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { claimsService, projectsService, poService, usersService } from '../services';
import { useAuth } from '../context/AuthContext';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ClaimCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read URL query params if redirected from PO Claims History page
  const queryProjectId = searchParams.get('projectId');
  const queryPoId = searchParams.get('poId');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [projects, setProjects] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [formData, setFormData] = useState({
    project_id: queryProjectId || '',
    po_id: queryPoId || '',
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

        // Fetch projects (includes workflow_id / workflow_name via backend JOIN —
        // this is what tells us whether a project is workflow-routed or manual-assignment)
        try {
          const projectList = await projectsService.list({ vendor_id: vendorId });
          const list = Array.isArray(projectList?.data?.items)
            ? projectList.data.items
            : Array.isArray(projectList?.data)
            ? projectList.data
            : Array.isArray(projectList)
            ? projectList
            : [];
          setProjects(list);
        } catch (projectError) {
          console.error('Error fetching projects:', projectError);
          setProjects([]);
        }

        // Fetch POs
        try {
          const poResponse = await poService.list({ vendor_id: vendorId });
          const poData = poResponse?.data?.items || poResponse?.data || poResponse || [];
          setPurchaseOrders(Array.isArray(poData) ? poData : []);
        } catch (poError) {
          console.error('Error fetching POs:', poError);
          setPurchaseOrders([]);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load required data. Please try again.');
        setProjects([]);
        setPurchaseOrders([]);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchInitialData();
  }, [user]);

  // Get project-specific POs
  const getProjectPOs = () => {
    if (!formData.project_id) return [];
    return (Array.isArray(purchaseOrders) ? purchaseOrders : []).filter(
      (po) =>
        (po.status === 'ACTIVE' || !po.status) &&
        String(po.project_id) === String(formData.project_id)
    );
  };

  const selectedProject = projects.find((p) => String(p.id) === String(formData.project_id));

  // ---------------------------------------------------------------------
  // DYNAMIC MODE: derived from the selected project's workflow_id, per README:
  // "If a project has no workflow assigned (workflow_id = NULL), claims under
  // that project use manual officer assignment. Workflow is auto-derived
  // from the project." Vendors never choose the mode — it's a property of
  // the project itself.
  // ---------------------------------------------------------------------
  const isWorkflowMode = Boolean(selectedProject?.workflow_id);
  const workflowName = selectedProject?.workflow_name;

  // Only fetch officers when we actually land in manual-assignment mode —
  // there's no need to hit /api/users/officers for a workflow-routed project.
  useEffect(() => {
    if (!formData.project_id || !selectedProject) return;
    if (isWorkflowMode) {
      setOfficers([]);
      setSelectedOfficer(null);
      return;
    }

    const fetchOfficers = async () => {
      try {
        setOfficersLoading(true);
        const officersList = await usersService.getOfficers();
        const oList = Array.isArray(officersList?.data)
          ? officersList.data
          : Array.isArray(officersList)
          ? officersList
          : [];
        setOfficers(oList);
      } catch (officerError) {
        console.warn('Could not fetch officers:', officerError.message);
        setOfficers([]);
      } finally {
        setOfficersLoading(false);
      }
    };

    fetchOfficers();
  }, [formData.project_id, isWorkflowMode, selectedProject]);

  const handleProjectCardClick = (projectId) => {
    // Navigates to PO listing for this project
    navigate(`/vendor/claims/project/${projectId}`);
  };

  const handlePOSelect = (e) => {
    const poId = e.target.value;
    setFormData((prev) => ({ ...prev, po_id: poId }));
  };

  const handleOfficerSelect = (officerId) => {
    setSelectedOfficer(officerId);
  };

  const validateFiles = (files) => {
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      return `File(s) exceed the ${MAX_FILE_SIZE_MB}MB limit: ${oversized
        .map((f) => f.name)
        .join(', ')}`;
    }
    return null;
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

    // Officer selection is only required in manual-assignment mode
    // (i.e. the project has no workflow_id). Workflow-routed projects
    // auto-route to Step 1 on the backend, so there's nothing to pick here.
    if (!isWorkflowMode && officers.length > 0 && !selectedOfficer) {
      setError('Please select an officer for claim review');
      return;
    }

    const fileError = validateFiles(formData.files);
    if (fileError) {
      setError(fileError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const vendorId = user?.vendor_id;
      const userId = user?.id;

      if (!vendorId) throw new Error('No vendor ID found. Please contact administrator.');

      // Matches POST /api/claims fields exactly — workflow_id is intentionally
      // omitted, it's auto-derived server-side from project_id.
      const claimData = {
        vendor_id: parseInt(vendorId),
        project_id: parseInt(formData.project_id),
        po_id: parseInt(formData.po_id),
        remarks: formData.remarks.trim(),
      };

      if (userId) {
        claimData.vendor_contact_user_id = parseInt(userId);
      }

      const rawResponse = await claimsService.create(claimData, formData.files);
      // claimsService.create() returns the raw API response — normalize the
      // same way claimsService.get() does, in case a single created record
      // comes back array-wrapped (e.g. { data: [claim] }).
      const createdClaim =
        Array.isArray(rawResponse) && rawResponse.length === 1 ? rawResponse[0] : rawResponse;

      if (!isWorkflowMode && createdClaim?.id && selectedOfficer) {
        // Manual-assignment mode only: POST /api/claims/:id/assign
        try {
          await claimsService.assign(
            createdClaim.id,
            selectedOfficer,
            `Claim assigned to officer for review`
          );
          setSuccess('Claim created successfully and assigned to the selected officer for review!');
        } catch (assignError) {
          console.error('Claim created but assignment failed:', assignError);
          setSuccess(
            'Claim created successfully, but assigning the officer failed. You can assign it from the claims list.'
          );
        }
      } else if (isWorkflowMode) {
        setSuccess(
          `Claim created successfully! It has been automatically routed into the "${
            workflowName || 'project'
          }" workflow for review.`
        );
      } else {
        setSuccess('Claim created successfully! You can assign officers later from the claims list.');
      }

      setTimeout(() => navigate('/vendor/claims'), 2000);
    } catch (err) {
      console.error('Error creating claims:', err);
      setError(err.message || 'Failed to create claims. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const fileError = validateFiles(files);
    if (fileError) {
      setError(fileError);
    } else {
      setError(null);
    }
    setFormData((prev) => ({ ...prev, files }));
  };

  const removeFile = (index) => {
    const newFiles = [...formData.files];
    newFiles.splice(index, 1);
    setFormData((prev) => ({ ...prev, files: newFiles }));
  };

  const projectPOs = getProjectPOs();
  const selectedOfficerDetails = officers.find((o) => o.id === selectedOfficer);

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

  // =========================================================================
  // VIEW MODE A: If NO PO has been selected yet via Query Params,
  // Show ONLY the Project Cards for selection.
  // =========================================================================
  if (!queryProjectId && !formData.po_id) {
    return (
      <div className="container-fluid py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="mb-1 fw-bold">
              <i className="bi bi-folder-check text-primary me-2"></i>
              Select Project for Claim Submission
            </h4>
            <p className="text-muted mb-0">Choose a project below to view its Purchase Orders</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate('/vendor/claims')}
          >
            <i className="bi bi-arrow-left me-1"></i>
            Back to Claims
          </button>
        </div>

        {error && (
          <div className="alert alert-danger alert-dismissible fade show">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
          </div>
        )}

        {Array.isArray(projects) && projects.length > 0 ? (
          <div className="row g-4">
            {projects.map((project) => (
              <div key={project.id} className="col-md-6 col-lg-4">
                <div
                  className="card h-100 border-0 shadow-sm cursor-pointer hover-shadow transition-all"
                  onClick={() => handleProjectCardClick(project.id)}
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
                        <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
                          {project.project_code || project.code || `PRJ-${project.id}`}
                        </span>
                        <span className="badge bg-success">Active</span>
                      </div>
                      <h5 className="fw-bold text-dark mb-2">
                        {project.project_name || project.name}
                      </h5>
                      <p className="text-muted small mb-3">
                        {project.description || 'No description provided.'}
                      </p>
                      {project.location && (
                        <div className="small text-muted mb-3">
                          <i className="bi bi-geo-alt me-1 text-primary"></i>
                          {project.location}
                        </div>
                      )}
                      {/* Dynamic mode indicator, driven by project.workflow_id */}
                      <div className="small">
                        {project.workflow_id ? (
                          <span className="badge bg-info bg-opacity-10 text-info">
                            <i className="bi bi-diagram-3 me-1"></i>
                            {project.workflow_name || 'Workflow'} approval
                          </span>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-10 text-secondary">
                            <i className="bi bi-person-lines-fill me-1"></i>
                            Manual assignment
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-top d-flex justify-content-between align-items-center text-primary fw-semibold small">
                      <span>View Purchase Orders</span>
                      <i className="bi bi-arrow-right"></i>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-5 bg-white rounded border">
            <i className="bi bi-folder-x fs-1 text-muted"></i>
            <h5 className="mt-3 text-muted">No projects assigned to you</h5>
            <p className="text-muted small">Please contact your administrator if this is an error.</p>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE B: When project and PO are selected (e.g. from PO Claims page)
  // Show the Claim Form
  // =========================================================================
  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1 fw-bold">
            <i className="bi bi-plus-circle text-primary me-2"></i>
            Submit New Claim / Bill
          </h4>
          <p className="text-muted mb-0">Fill in the details to submit your claim</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() =>
            navigate(
              formData.project_id && formData.po_id
                ? `/vendor/claims/project/${formData.project_id}/po/${formData.po_id}`
                : '/vendor/claims/create'
            )
          }
        >
          <i className="bi bi-arrow-left me-1"></i>
          Back
        </button>
      </div>

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
        {/* Project & PO Summary Info Card */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0">Selected Project & Purchase Order</h6>
              {formData.project_id &&
                (isWorkflowMode ? (
                  <span className="badge bg-info bg-opacity-10 text-info px-3 py-2">
                    <i className="bi bi-diagram-3 me-1"></i>
                    {workflowName || 'Workflow'} approval
                  </span>
                ) : (
                  <span className="badge bg-secondary bg-opacity-10 text-secondary px-3 py-2">
                    <i className="bi bi-person-lines-fill me-1"></i>
                    Manual assignment
                  </span>
                ))}
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small text-muted">Project</label>
                <div className="form-control bg-light font-semibold">
                  {selectedProject?.project_name || selectedProject?.name || `Project #${formData.project_id}`}
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label small text-muted">Purchase Order</label>
                {projectPOs.length > 0 ? (
                  <select
                    className="form-select"
                    value={formData.po_id}
                    onChange={handlePOSelect}
                    required
                  >
                    <option value="">Select PO...</option>
                    {projectPOs.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.po_number || po.number} - ₹
                        {Number(po.amount || po.total_value || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="form-control bg-light font-semibold">
                    PO #{formData.po_id}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Officer selection — manual-assignment mode only. Workflow-mode
            projects skip this entirely, since routing is automatic. */}
        {!isWorkflowMode && (
          <div className="mb-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-3">
                  <div className="bg-primary bg-opacity-10 p-2 rounded me-2">
                    <i className="bi bi-person-check text-primary fs-4"></i>
                  </div>
                  <div>
                    <h6 className="mb-0 fw-bold">Select Officer for Review</h6>
                    <small className="text-muted">Choose the officer who will review this claim</small>
                  </div>
                </div>

                {officersLoading ? (
                  <div className="text-center py-3">
                    <span className="spinner-border spinner-border-sm text-primary me-2"></span>
                    <span className="text-muted small">Loading officers...</span>
                  </div>
                ) : Array.isArray(officers) && officers.length > 0 ? (
                  <select
                    className="form-select form-select-lg mb-3"
                    onChange={(e) => {
                      const officerId = e.target.value ? parseInt(e.target.value) : null;
                      handleOfficerSelect(officerId);
                    }}
                    value={selectedOfficer || ''}
                  >
                    <option value="">Select an officer...</option>
                    {officers.map((officer) => (
                      <option key={officer.id} value={officer.id}>
                        {officer.name || officer.username}{' '}
                        {officer.role_name && `(${officer.role_name})`}
                        {officer.designation && ` - ${officer.designation}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-center py-3 bg-light rounded">
                    <p className="text-muted mb-0 small">No officers available. Proceeding without pre-assignment.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Remarks & Documents */}
        <div className="row g-4 mb-4">
          <div className="col-md-8">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="fw-bold mb-3">Remarks / Description</h6>
                <textarea
                  className="form-control"
                  rows="5"
                  placeholder="Describe the claim details, work completed for this period, etc..."
                  value={formData.remarks}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                  required
                  minLength={3}
                />
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="fw-bold mb-3">Attach Invoice / Documents</h6>
                <input
                  type="file"
                  className="form-control"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                <small className="text-muted d-block mt-2">
                  PDF, Word, Excel, Images (Max {MAX_FILE_SIZE_MB}MB)
                </small>

                {formData.files.length > 0 && (
                  <div className="mt-3">
                    {formData.files.map((file, index) => (
                      <div
                        key={index}
                        className="d-flex justify-content-between align-items-center bg-light p-2 rounded mb-1"
                      >
                        <span className="small text-truncate" style={{ maxWidth: '180px' }}>
                          {file.name}{' '}
                          <span className="text-muted">
                            ({(file.size / (1024 * 1024)).toFixed(2)}MB)
                          </span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger border-0"
                          onClick={() => removeFile(index)}
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="d-flex gap-2 justify-content-end">
          <button
            type="button"
            className="btn btn-outline-secondary btn-lg px-4"
            onClick={() =>
              navigate(
                formData.project_id && formData.po_id
                  ? `/vendor/claims/project/${formData.project_id}/po/${formData.po_id}`
                  : '/vendor/claims/create'
              )
            }
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-lg px-4" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Submitting...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Submit Claim
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
