import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { packagesService, projectsService, poService, usersService } from '../services';
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
  const [officers, setOfficers] = useState([]);
  const [selectedOfficers, setSelectedOfficers] = useState([]);
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

        // Fetch projects
        try {
          const projectList = await projectsService.list({ vendor_id: vendorId });
          setProjects(Array.isArray(projectList) ? projectList : []);
        } catch (projectError) {
          console.error('Error fetching projects:', projectError);
          setProjects([]);
        }

        // Fetch POs
        try {
          const poResponse = await poService.list({ vendor_id: vendorId });
          const poData = poResponse?.data || poResponse || [];
          setPurchaseOrders(Array.isArray(poData) ? poData : []);
        } catch (poError) {
          console.error('Error fetching POs:', poError);
          setPurchaseOrders([]);
        }

        // Fetch officers using the dedicated endpoint
        try {
          const officersList = await usersService.getOfficers();
          setOfficers(Array.isArray(officersList) ? officersList : []);
          console.log('Officers fetched:', officersList);
        } catch (officerError) {
          console.warn('Could not fetch officers:', officerError.message);
          setOfficers([]);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load required data. Please try again.');
        setProjects([]);
        setPurchaseOrders([]);
        setOfficers([]);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchInitialData();
  }, [user]);

  // Get project-specific POs
  const getProjectPOs = () => {
    if (!formData.project_id) return [];
    return (Array.isArray(purchaseOrders) ? purchaseOrders : [])
      .filter(po => po.status === 'ACTIVE' && po.project_id === parseInt(formData.project_id));
  };

  const handleProjectSelect = (projectId) => {
    setFormData(prev => ({ 
      ...prev, 
      project_id: projectId, 
      po_id: '' // Reset PO when project changes
    }));
  };

  const handlePOSelect = (e) => {
    const poId = e.target.value;
    setFormData(prev => ({ ...prev, po_id: poId }));
  };

  const handleOfficerToggle = (officerId) => {
    setSelectedOfficers(prev => {
      if (prev.includes(officerId)) {
        return prev.filter(id => id !== officerId);
      } else {
        return [...prev, officerId];
      }
    });
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
    
    // Only validate officers if there are officers available
    if (officers.length > 0 && selectedOfficers.length === 0) {
      setError('Please select at least one officer for claim review');
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

      if (createdPackage && createdPackage.id && selectedOfficers.length > 0) {
        const claimPromises = selectedOfficers.map((officerId) => {
          const officer = officers.find(o => o.id === officerId);
          const officerName = officer?.name || officer?.username || 'Unknown';
          
          const claimRemarks = `Claim assigned to ${officerName}
${formData.remarks}`;

          const claimData = {
            ...packageData,
            remarks: claimRemarks,
          };

          return packagesService.create(claimData, formData.files);
        });

        const createdClaims = await Promise.all(claimPromises);
        console.log('Created claims for officers:', createdClaims);

        const assignPromises = createdClaims.map((claim, index) => {
          const officerId = selectedOfficers[index];
          return packagesService.assign(
            claim.id, 
            officerId, 
            `Claim assigned to officer for review`
          );
        });

        await Promise.all(assignPromises);

        setSuccess(`${createdClaims.length} claim(s) created successfully and assigned to selected officers for review!`);
      } else {
        setSuccess('Claim created successfully! You can assign officers later from the claims list.');
      }
      
      setTimeout(() => navigate('/vendor/packages'), 3000);
    } catch (err) {
      console.error('Error creating claims:', err);
      setError(err.message || 'Failed to create claims. Please try again.');
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

  // Get selected project details
  const selectedProject = projects.find(p => p.id === parseInt(formData.project_id));
  const projectPOs = getProjectPOs();

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
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1 fw-bold">
            <i className="bi bi-plus-circle text-primary me-2"></i>
            Claim Submission
          </h4>
          <p className="text-muted mb-0">Submit a claim for review by officers</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate('/vendor/packages')}
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
      {success && (
        <div className="alert alert-success alert-dismissible fade show">
          <i className="bi bi-check-circle-fill me-2"></i>
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Select Project - Card Grid */}
        <div className="mb-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <div className="bg-primary bg-opacity-10 p-2 rounded me-2">
                  <i className="bi bi-folder text-primary fs-4"></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold">Step 1: Select Project</h6>
                  <small className="text-muted">Choose the project for this claim</small>
                  {formData.project_id && selectedProject && (
                    <span className="badge bg-success ms-2">
                      <i className="bi bi-check-circle me-1"></i>
                      Selected: {selectedProject.project_name || selectedProject.name}
                    </span>
                  )}
                </div>
              </div>
              
              {Array.isArray(projects) && projects.length > 0 ? (
                <div className="row g-3">
                  {projects.map(project => (
                    <div key={project.id} className="col-md-4 col-lg-3">
                      <div 
                        className={`card h-100 cursor-pointer transition-all ${formData.project_id === String(project.id) ? 'border-primary border-3 shadow-lg' : 'border-0 shadow-sm'}`}
                        onClick={() => handleProjectSelect(project.id)}
                        style={{ 
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          transform: formData.project_id === String(project.id) ? 'scale(1.02)' : 'scale(1)'
                        }}
                      >
                        <div className="card-body text-center">
                          {formData.project_id === String(project.id) && (
                            <div className="position-absolute top-0 end-0 m-2">
                              <span className="badge bg-primary rounded-circle p-2">
                                <i className="bi bi-check-lg"></i>
                              </span>
                            </div>
                          )}
                          <div className="rounded-circle bg-primary bg-opacity-10 p-3 d-inline-flex mb-3">
                            <i className="bi bi-building fs-1 text-primary"></i>
                          </div>
                          <h6 className="mb-1 fw-bold">{project.project_name || project.name}</h6>
                          {project.project_code && (
                            <small className="text-muted d-block">{project.project_code}</small>
                          )}
                          {project.location && (
                            <small className="text-muted d-block">
                              <i className="bi bi-geo-alt me-1"></i>
                              {project.location}
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-light rounded">
                  <i className="bi bi-folder-x fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No projects assigned to you</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Select Purchase Order - Dropdown (Conditional) */}
        <div className="mb-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <div className="bg-success bg-opacity-10 p-2 rounded me-2">
                  <i className="bi bi-receipt text-success fs-4"></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold">Step 2: Select Purchase Order</h6>
                  <small className="text-muted">Choose the PO for this claim</small>
                  {formData.po_id && (
                    <span className="badge bg-success ms-2">
                      <i className="bi bi-check-circle me-1"></i>
                      Selected
                    </span>
                  )}
                </div>
              </div>
              
              {!formData.project_id ? (
                // Default message when no project is selected
                <div className="text-center py-4 bg-light rounded">
                  <i className="bi bi-info-circle fs-2 text-primary"></i>
                  <h6 className="mt-2 mb-1">Please select a project first</h6>
                  <p className="text-muted mb-0 small">
                    Choose a project from Step 1 above to see available Purchase Orders
                  </p>
                </div>
              ) : projectPOs.length > 0 ? (
                <select
                  className="form-select form-select-lg"
                  value={formData.po_id}
                  onChange={handlePOSelect}
                  required
                  style={{ fontSize: '1rem' }}
                >
                  <option value="">Choose a PO...</option>
                  {projectPOs.map(po => (
                    <option 
                      key={po.id} 
                      value={po.id}
                      style={{ 
                        fontSize: '0.95rem', 
                        padding: '8px 12px'
                      }}
                    >
                      {po.po_number} - ₹{parseFloat(po.amount).toLocaleString('en-IN')}
                      {po.start_date && po.end_date && 
                        ` (${new Date(po.start_date).toLocaleDateString()} - ${new Date(po.end_date).toLocaleDateString()})`
                      }
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-center py-4 bg-light rounded">
                  <i className="bi bi-receipt-cutoff fs-2 text-warning"></i>
                  <h6 className="mt-2 mb-1">No Purchase Orders Available</h6>
                  <p className="text-muted mb-0 small">
                    No active Purchase Orders found for the selected project
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Select Officers - Dropdown with Multi-select */}
        <div className="mb-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <div className="bg-purple bg-opacity-10 p-2 rounded me-2" style={{ backgroundColor: '#6f42c1' }}>
                  <i className="bi bi-people text-purple fs-4" style={{ color: '#6f42c1' }}></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold">Step 3: Select Officers for Review</h6>
                  <small className="text-muted">Choose officers who will review this claim</small>
                  {selectedOfficers.length > 0 && (
                    <span className="badge bg-primary ms-2">
                      <i className="bi bi-check-circle me-1"></i>
                      {selectedOfficers.length} selected
                    </span>
                  )}
                </div>
              </div>
              
              {Array.isArray(officers) && officers.length > 0 ? (
                <>
                  <select
                    className="form-select form-select-lg mb-3"
                    onChange={(e) => {
                      const officerId = parseInt(e.target.value);
                      if (officerId) {
                        handleOfficerToggle(officerId);
                        e.target.value = ''; // Reset select
                      }
                    }}
                    value=""
                    style={{ fontSize: '1rem' }}
                  >
                    <option value="">Select an officer to add...</option>
                    {officers
                      .filter(o => !selectedOfficers.includes(o.id))
                      .map(officer => (
                        <option key={officer.id} value={officer.id}>
                          {officer.name || officer.username} 
                          {officer.role_name && ` (${officer.role_name})`}
                          {officer.designation && ` - ${officer.designation}`}
                        </option>
                      ))
                    }
                  </select>

                  {/* Selected Officers */}
                  {selectedOfficers.length > 0 ? (
                    <div className="mt-3">
                      <label className="fw-semibold small text-muted">Selected Officers:</label>
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        {selectedOfficers.map(officerId => {
                          const officer = officers.find(o => o.id === officerId);
                          return officer ? (
                            <span 
                              key={officer.id} 
                              className="badge bg-primary d-flex align-items-center gap-2 p-2"
                              style={{ fontSize: '0.9rem' }}
                            >
                              <i className="bi bi-person-circle"></i>
                              {officer.name || officer.username}
                              {officer.role_name && ` (${officer.role_name})`}
                              <button
                                type="button"
                                className="btn btn-sm text-white p-0 ms-1"
                                onClick={() => handleOfficerToggle(officer.id)}
                                style={{ background: 'none', border: 'none' }}
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 bg-light rounded">
                      <i className="bi bi-person-plus fs-4 text-muted"></i>
                      <p className="text-muted mt-1 mb-0">No officers selected. Select from the dropdown above.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 bg-light rounded">
                  <i className="bi bi-person-x fs-4 text-muted"></i>
                  <p className="text-muted mt-1 mb-0">No officers available. Please contact your administrator.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 4: Remarks & Files */}
        <div className="row g-4 mb-4">
          <div className="col-md-8">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-3">
                  <div className="bg-primary bg-opacity-10 p-2 rounded me-2">
                    <i className="bi bi-chat text-primary fs-4"></i>
                  </div>
                  <div>
                    <h6 className="mb-0 fw-bold">Step 4: Remarks</h6>
                    <small className="text-muted">Provide details about this claim</small>
                    {formData.remarks && formData.remarks.length >= 3 && (
                      <span className="badge bg-success ms-2">
                        <i className="bi bi-check-circle me-1"></i>
                        Added
                      </span>
                    )}
                  </div>
                </div>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Describe the claim details, work completed, and any supporting information..."
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  required
                  minLength="3"
                />
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-3">
                  <div className="bg-success bg-opacity-10 p-2 rounded me-2">
                    <i className="bi bi-file-earmark-arrow-up text-success fs-4"></i>
                  </div>
                  <div>
                    <h6 className="mb-0 fw-bold">Attach Documents</h6>
                    <small className="text-muted">Supporting documents</small>
                    {formData.files.length > 0 && (
                      <span className="badge bg-info ms-2">
                        <i className="bi bi-check-circle me-1"></i>
                        {formData.files.length} file(s)
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="file"
                  className="form-control"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                <small className="text-muted d-block mt-2">
                  PDF, Word, Excel, Images (Max 10MB each)
                </small>

                {formData.files.length > 0 && (
                  <div className="mt-3">
                    {formData.files.map((file, index) => (
                      <div key={index} className="d-flex justify-content-between align-items-center bg-light p-2 rounded mb-1">
                        <div className="d-flex align-items-center">
                          <i className="bi bi-file-earmark-pdf text-danger me-2"></i>
                          <span className="small">{file.name}</span>
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
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Summary */}
        {(formData.project_id || formData.po_id || selectedOfficers.length > 0) && (
          <div className="card border-0 shadow-sm bg-light mb-4">
            <div className="card-body">
              <h6 className="fw-bold mb-2">Selection Summary</h6>
              <div className="d-flex flex-wrap gap-2">
                {formData.project_id && selectedProject && (
                  <span className="badge bg-primary">
                    <i className="bi bi-folder me-1"></i>
                    {selectedProject.project_name || selectedProject.name}
                  </span>
                )}
                {formData.po_id && (
                  <span className="badge bg-success">
                    <i className="bi bi-receipt me-1"></i>
                    {purchaseOrders.find(p => p.id === parseInt(formData.po_id))?.po_number}
                  </span>
                )}
                {selectedOfficers.length > 0 && (
                  <span className="badge bg-info">
                    <i className="bi bi-people me-1"></i>
                    {selectedOfficers.length} officer(s) selected
                  </span>
                )}
                {formData.remarks && (
                  <span className="badge bg-secondary">
                    <i className="bi bi-chat me-1"></i>
                    Remarks added
                  </span>
                )}
                {formData.files.length > 0 && (
                  <span className="badge bg-warning text-dark">
                    <i className="bi bi-file-earmark me-1"></i>
                    {formData.files.length} file(s)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="d-flex gap-2 justify-content-end">
          <button
            type="button"
            className="btn btn-outline-secondary btn-lg px-4"
            onClick={() => navigate('/vendor/packages')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg px-4"
            disabled={submitting || !Array.isArray(projects) || projects.length === 0}
          >
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

        {/* Info Footer */}
        <div className="mt-4">
          <div className="card border-0 shadow-sm bg-light">
            <div className="card-body">
              <div className="d-flex align-items-start gap-3">
                <i className="bi bi-info-circle text-primary fs-4"></i>
                <div>
                  <h6 className="mb-1 fw-semibold">Claim Submission Workflow</h6>
                  <p className="mb-0 small text-muted">
                    This will create a claim package. If you select officers, they will be assigned for review.
                    You can also assign officers later from the claims list.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}