// src/pages/ResubmitPackage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { packagesService } from '../services';
import { useAuth } from '../context/AuthContext';

export default function ResubmitPackage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [packageData, setPackageData] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const fetchPackage = async () => {
      try {
        const data = await packagesService.get(id);
        setPackageData(data);
      } catch (err) {
        console.error('Error fetching package:', err);
        setError('Failed to load package details');
      } finally {
        setLoading(false);
      }
    };
    fetchPackage();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!remarks || remarks.trim().length < 3) {
      setError('Please enter remarks (minimum 3 characters)');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await packagesService.resubmit(id, { remarks });
      
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          await packagesService.uploadFile(id, formData);
        }
      }

      setSuccess('Package resubmitted successfully!');
      setTimeout(() => {
        navigate('/vendor/packages');
      }, 2000);

    } catch (err) {
      console.error('Error resubmitting package:', err);
      setError(err.message || 'Failed to resubmit package. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles([...files, ...newFiles]);
  };

  const removeFile = (index) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading package details...</p>
      </div>
    );
  }

  if (!packageData) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          Package not found or you don't have access to it.
        </div>
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
                <i className="bi bi-arrow-counterclockwise text-warning me-2"></i>
                Resubmit Package: {packageData.package_code}
              </h4>
              <p className="text-muted small mb-0">This package was returned for revision. Please make necessary changes and resubmit.</p>
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

              <div className="bg-light p-3 rounded-3 mb-4">
                <h6 className="fw-semibold mb-2">Package Details</h6>
                <div className="row g-2">
                  <div className="col-md-6">
                    <small className="text-muted">Project</small>
                    <p className="mb-0 fw-semibold">{packageData.project_name || 'N/A'}</p>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted">Status</small>
                    <p className="mb-0 fw-semibold text-danger">{packageData.status}</p>
                  </div>
                  <div className="col-12">
                    <small className="text-muted">Return Remarks</small>
                    <p className="mb-0">{packageData.remarks || 'No remarks provided'}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-chat text-primary me-1"></i>
                    Resubmission Remarks <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Explain the changes you've made..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    required
                    minLength="3"
                  />
                  <small className="text-muted">
                    Describe the changes and clarifications you've made.
                  </small>
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-file-earmark-arrow-up text-primary me-1"></i>
                    Add New Files (Optional)
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                  />
                  <small className="text-muted">
                    Upload any revised or additional documents
                  </small>

                  {files.length > 0 && (
                    <div className="mt-3">
                      <label className="fw-semibold small">New Files:</label>
                      <div className="list-group mt-1">
                        {files.map((file, index) => (
                          <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                              <i className="bi bi-file-earmark text-primary me-2"></i>
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

                {packageData.files && packageData.files.length > 0 && (
                  <div className="mb-4">
                    <label className="fw-semibold small">Existing Files:</label>
                    <div className="list-group mt-1">
                      {packageData.files.map((file, index) => (
                        <div key={index} className="list-group-item">
                          <i className="bi bi-file-earmark-pdf text-danger me-2"></i>
                          {file.original_name || file.filename}
                          <span className="text-muted ms-2 small">
                            (Existing file - will be preserved)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Resubmitting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-arrow-counterclockwise me-1"></i>
                        Resubmit Package
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
          </div>
        </div>
      </div>
    </div>
  );
}