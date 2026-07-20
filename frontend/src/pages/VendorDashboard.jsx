// src/pages/VendorDashboard.jsx - Debug Version
import React, { useState, useEffect } from 'react';
import { packagesService, projectsService, workflowsService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function VendorDashboard({ currentTab }) {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [projectId, setProjectId] = useState('');
  const [remarks, setRemarks] = useState('');

  // DEBUG: Log when component mounts
  useEffect(() => {
    console.log('🔍 VendorDashboard mounted');
    console.log('🔍 Current tab:', currentTab);
    console.log('🔍 User:', user);
    console.log('🔍 Projects service available:', !!projectsService);
    console.log('🔍 Packages service available:', !!packagesService);
  }, []);

  useEffect(() => {
    // Fetch projects on component mount
    const fetchData = async () => {
      console.log('🔄 Fetching projects and workflows...');
      try {
        const [projectsData, workflowsData] = await Promise.all([
          projectsService.list(),
          workflowsService.list()
        ]);
        console.log('📋 Projects loaded:', projectsData);
        console.log('📋 Workflows loaded:', workflowsData);
        setProjects(projectsData || []);
        setWorkflows(workflowsData || []);
      } catch (err) {
        console.error('❌ Error fetching data:', err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    // Fetch packages when tab changes
    if (currentTab === 'packages' || currentTab === 'upload') {
      fetchPackages();
    }
  }, [currentTab]);

  const fetchPackages = async () => {
    console.log('🔄 Fetching packages...');
    try {
      setLoading(true);
      setError(null);
      
      const data = await packagesService.list({ 
        vendor_id: user?.vendor_id 
      });
      
      console.log('📦 Vendor packages:', data);
      setPackages(data || []);
    } catch (err) {
      console.error('❌ Error fetching packages:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    console.log('📎 File selection triggered', e);
    const file = e.target.files[0];
    console.log('📎 Selected file:', file);
    
    if (file) {
      console.log('📎 File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      });
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload PDF or image files only');
        e.target.value = '';
        setFileName('No file chosen');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        e.target.value = '';
        setFileName('No file chosen');
        return;
      }
      
      setSelectedFile(file);
      setFileName(file.name);
      setError(null);
      setSuccess(null);
    } else {
      setFileName('No file chosen');
      setSelectedFile(null);
    }
  };

  // Handle package submission - DEBUG VERSION
  const handleSubmit = async (e) => {
    console.log('🚀 FORM SUBMISSION TRIGGERED!');
    console.log('📝 Event object:', e);
    e.preventDefault();
    
    console.log('📊 Form data at submission:', {
      projectId,
      selectedFile: selectedFile?.name,
      remarks,
      user: user?.id
    });

    // VALIDATION CHECKS
    if (!projectId) {
      console.warn('❌ Validation failed: No project selected');
      setError('Please select a project');
      return;
    }

    if (!selectedFile) {
      console.warn('❌ Validation failed: No file selected');
      setError('Please select a file to upload');
      return;
    }

    if (!remarks || remarks.length < 3) {
      console.warn('❌ Validation failed: Remarks too short');
      setError('Please provide remarks (minimum 3 characters)');
      return;
    }

    console.log('✅ All validations passed!');

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      // Get first workflow or use default
      const workflowId = workflows.length > 0 ? workflows[0].id : 1;
      console.log('📋 Using workflow ID:', workflowId);

      const packageData = {
        vendor_id: user?.vendor_id,
        vendor_contact_user_id: user?.id,
        project_id: projectId,
        workflow_id: workflowId,
        remarks: remarks
      };
      
      console.log('📦 Creating package with data:', packageData);

      // STEP 1: Create package
      console.log('⏳ Calling packagesService.create...');
      const newPackage = await packagesService.create(packageData);
      console.log('✅ Package created response:', newPackage);
      
      const packageId = newPackage?.id || newPackage?.package_id;
      console.log('📦 Extracted package ID:', packageId);
      
      if (!packageId) {
        throw new Error('Package ID not returned from server');
      }

      // STEP 2: Upload the file
      console.log('⏳ Calling packagesService.uploadFile...');
      const uploadResult = await packagesService.uploadFile(packageId, selectedFile);
      console.log('✅ File uploaded response:', uploadResult);

      setSuccess('Package submitted successfully! Your document has been routed to the verification desk.');
      
      // Reset form
      setSelectedFile(null);
      setFileName('No file chosen');
      setRemarks('');
      setProjectId('');
      document.getElementById('fileInput').value = '';
      
      // Refresh packages list
      await fetchPackages();
      
    } catch (err) {
      console.error('❌ Error submitting package:', err);
      console.error('❌ Error stack:', err.stack);
      setError(err.message || 'Failed to submit package');
    } finally {
      setUploading(false);
    }
  };

  const renderUploadForm = () => {
    console.log('🎨 Rendering upload form');
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <h4 className="card-title mb-3">Dispatch Particulars Package</h4>
          <p className="text-muted small mb-4">
            Route fresh documentation maps directly into the official administrative verification cycle streams
          </p>

          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          )}
          
          {success && (
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              <i className="bi bi-check-circle-fill me-2"></i>
              {success}
              <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
            </div>
          )}

          <form onSubmit={handleSubmit} id="packageForm">
            {/* Inbox/Outbox Section */}
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="d-flex align-items-center">
                  <i className="bi bi-inbox-fill text-primary fs-4 me-2"></i>
                  <span className="fw-bold">Inbox Desk</span>
                  <span className="badge bg-secondary ms-2">-</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="d-flex align-items-center">
                  <i className="bi bi-send-fill text-success fs-4 me-2"></i>
                  <span className="fw-bold">Outbox Dispatches</span>
                  <span className="badge bg-secondary ms-2">-</span>
                </div>
              </div>
            </div>

            {/* Target Project Agreement Classification */}
            <div className="mb-4">
              <label className="form-label fw-bold">
                Target Project Agreement Classification
              </label>
              <select 
                className="form-select form-select-lg"
                value={projectId}
                onChange={(e) => {
                  console.log('📋 Project selected:', e.target.value);
                  setProjectId(e.target.value);
                }}
                required
              >
                <option value="">-- Choose target project framework lane --</option>
                {projects.map(proj => (
                  <option key={proj.id} value={proj.id}>
                    {proj.project_name} {proj.project_code ? `(${proj.project_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Particulars PDF Document */}
            <div className="mb-4">
              <label className="form-label fw-bold">
                Upload Particulars PDF Document
              </label>
              <div className="input-group">
                <input 
                  id="fileInput"
                  type="file" 
                  className="form-control form-control-lg d-none"
                  onChange={handleFileSelect}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <button 
                  type="button" 
                  className="btn btn-outline-secondary btn-lg"
                  onClick={() => {
                    console.log('🖱️ Choose File button clicked');
                    document.getElementById('fileInput').click();
                  }}
                >
                  <i className="bi bi-folder-open me-2"></i>
                  Choose File
                </button>
                <span className="form-control form-control-lg bg-light" id="fileDisplay">
                  {fileName}
                </span>
              </div>
              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                Attach your official system PDF mapping configuration to upload directly.
              </small>
              {selectedFile && (
                <div className="mt-2">
                  <span className="badge bg-info">
                    <i className="bi bi-file-earmark-pdf me-1"></i>
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>

            {/* Vendor Audit Submission Log Remarks */}
            <div className="mb-4">
              <label className="form-label fw-bold">
                Vendor Audit Submission Log Remarks
              </label>
              <textarea 
                className="form-control form-control-lg"
                rows="3"
                value={remarks}
                onChange={(e) => {
                  console.log('📝 Remarks updated:', e.target.value);
                  setRemarks(e.target.value);
                }}
                placeholder="Provide analytical scope descriptors, compilation tracking numbers, or notes for the verifying desk..."
                required
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn btn-primary btn-lg w-100"
              disabled={uploading}
              onClick={() => console.log('🖱️ Submit button clicked')}
            >
              {uploading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Uploading & Routing...
                </>
              ) : (
                <>
                  <i className="bi bi-cloud-upload me-2"></i>
                  Upload & Route to Desk Network
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderPackages = () => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <h4 className="card-title mb-3">My Submitted Packages</h4>
          {packages.length === 0 ? (
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              No packages found. Use the "Upload Package" tab to submit your first package.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Package Code</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Current Step</th>
                    <th>Files</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map(pkg => (
                    <tr key={pkg.id}>
                      <td>
                        <strong className="text-primary">{pkg.package_code}</strong>
                      </td>
                      <td>{pkg.project_name || 'N/A'}</td>
                      <td>
                        <span className={`badge ${pkg.status === 'completed' ? 'bg-success' : 
                          pkg.status === 'rejected' ? 'bg-danger' : 
                          pkg.status === 'in_progress' ? 'bg-warning' : 'bg-secondary'}`}>
                          {pkg.status || 'Pending'}
                        </span>
                      </td>
                      <td>{pkg.current_step?.step_name || 'Not Started'}</td>
                      <td>
                        {pkg.files && pkg.files.length > 0 ? (
                          <span className="badge bg-info">
                            <i className="bi bi-file-earmark me-1"></i>
                            {pkg.files.length}
                          </span>
                        ) : (
                          <span className="badge bg-secondary">No files</span>
                        )}
                      </td>
                      <td>{pkg.created_at ? new Date(pkg.created_at).toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    console.log('🎨 Rendering content for tab:', currentTab);
    switch (currentTab) {
      case 'upload':
        return renderUploadForm();
      case 'packages':
        return renderPackages();
      case 'history':
        return (
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h4 className="card-title mb-3">Package History & Audit Trail</h4>
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                View your complete package history and audit trail here.
              </div>
            </div>
          </div>
        );
      default:
        return renderUploadForm();
    }
  };

  return (
    <div className="p-3 vendor-dashboard">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">
          <i className="bi bi-person-vcard me-2"></i>
          Vendor Dashboard
        </h3>
        <span className="badge bg-primary">
          <i className="bi bi-building me-1"></i>
          {user?.vendor_name || 'Vendor Portal'}
        </span>
      </div>
      <hr />
      {renderContent()}
    </div>
  );
}