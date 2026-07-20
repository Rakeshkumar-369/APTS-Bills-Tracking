// src/pages/PackageCreate.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { packagesService, vendorsService, projectsService, workflowsService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function PackageCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [formData, setFormData] = useState({
    vendor_id: '',
    vendor_contact_user_id: '',
    project_id: '',
    workflow_id: '',
    remarks: ''
  });
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vendorsData, projectsData, workflowsData] = await Promise.all([
          vendorsService.list(),
          projectsService.list(),
          workflowsService.list()
        ]);
        setVendors(vendorsData || []);
        setProjects(projectsData || []);
        setWorkflows(workflowsData || []);
        
        // Set default workflow if available
        if (workflowsData && workflowsData.length > 0) {
          setFormData(prev => ({ ...prev, workflow_id: workflowsData[0].id }));
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load form data');
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-populate vendor contact when vendor is selected
    if (name === 'vendor_id') {
      const selectedVendor = vendors.find(v => v.id === parseInt(value));
      if (selectedVendor && selectedVendor.users && selectedVendor.users.length > 0) {
        // Set first user as contact
        setFormData(prev => ({
          ...prev,
          vendor_contact_user_id: selectedVendor.users[0].id
        }));
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
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
    } else {
      setFileName('No file chosen');
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.vendor_id) {
      setError('Please select a vendor');
      return;
    }
    if (!formData.project_id) {
      setError('Please select a project');
      return;
    }
    if (!formData.workflow_id) {
      setError('Please select a workflow');
      return;
    }
    if (!formData.remarks || formData.remarks.length < 3) {
      setError('Please provide remarks (minimum 3 characters)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Create package
      const newPackage = await packagesService.create({
        vendor_id: formData.vendor_id,
        vendor_contact_user_id: formData.vendor_contact_user_id || null,
        project_id: formData.project_id,
        workflow_id: formData.workflow_id,
        remarks: formData.remarks
      });

      const packageId = newPackage?.id || newPackage?.package_id;
      
      if (!packageId) {
        throw new Error('Package ID not returned from server');
      }

      // Upload file if selected
      if (selectedFile) {
        await packagesService.uploadFile(packageId, selectedFile);
      }

      setSuccess('Package created successfully!');
      
      // Reset form
      setFormData({
        vendor_id: '',
        vendor_contact_user_id: '',
        project_id: '',
        workflow_id: workflows.length > 0 ? workflows[0].id : '',
        remarks: ''
      });
      setSelectedFile(null);
      setFileName('No file chosen');
      document.getElementById('fileInput').value = '';

      setTimeout(() => {
        navigate('/admin');
      }, 2000);
      
    } catch (err) {
      console.error('Error creating package:', err);
      setError(err.message || 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>
          <i className="bi bi-plus-circle me-2"></i>
          Create New Package
        </h4>
        <button 
          className="btn btn-outline-secondary btn-sm"
          onClick={() => navigate('/admin')}
        >
          <i className="bi bi-arrow-left me-1"></i>
          Back to Dashboard
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

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              {/* Vendor Selection */}
              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-building me-1"></i>
                  Vendor *
                </label>
                <select
                  className="form-select"
                  name="vendor_id"
                  value={formData.vendor_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a vendor</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name} {vendor.vendor_code ? `(${vendor.vendor_code})` : ''}
                    </option>
                  ))}
                </select>
                {formData.vendor_id && (
                  <small className="text-muted">
                    Contact user will be auto-assigned
                  </small>
                )}
              </div>

              {/* Project Selection */}
              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-folder me-1"></i>
                  Project *
                </label>
                <select
                  className="form-select"
                  name="project_id"
                  value={formData.project_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.project_name} {project.project_code ? `(${project.project_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Workflow Selection */}
              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-diagram-3 me-1"></i>
                  Workflow *
                </label>
                <select
                  className="form-select"
                  name="workflow_id"
                  value={formData.workflow_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a workflow</option>
                  {workflows.map(workflow => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.workflow_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-file-earmark me-1"></i>
                  Upload Document
                </label>
                <div className="input-group">
                  <input
                    id="fileInput"
                    type="file"
                    className="d-none"
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => document.getElementById('fileInput').click()}
                  >
                    <i className="bi bi-folder-open me-1"></i>
                    Choose File
                  </button>
                  <span className="form-control bg-light">{fileName}</span>
                </div>
                {selectedFile && (
                  <div className="mt-2">
                    <span className="badge bg-info">
                      <i className="bi bi-file-earmark me-1"></i>
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
                <small className="text-muted">
                  <i className="bi bi-info-circle me-1"></i>
                  Optional - PDF or image files, max 10MB
                </small>
              </div>

              {/* Remarks */}
              <div className="col-12 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-chat me-1"></i>
                  Remarks *
                </label>
                <textarea
                  className="form-control"
                  name="remarks"
                  rows="3"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  placeholder="Enter creation remarks (minimum 3 characters)..."
                  required
                />
              </div>

              {/* Submit Button */}
              <div className="col-12">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Creating Package...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-plus-circle me-2"></i>
                      Create Package
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}