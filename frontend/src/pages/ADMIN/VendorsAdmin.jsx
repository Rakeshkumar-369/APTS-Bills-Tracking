// src/pages/ADMIN/VendorsAdmin.jsx
import React, { useState, useEffect } from 'react';
import { vendorsService, projectsService } from '../../services';

export default function VendorsAdmin() {
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]); // all projects, for the picker
  const [loading, setLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState({
    vendor_name: '',
    vendor_code: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    is_active: true
  });

  // Project assignment state
  const [selectedProjectIds, setSelectedProjectIds] = useState([]); // ids currently checked in the modal
  const [originalProjectIds, setOriginalProjectIds] = useState([]); // ids the vendor had when modal opened
  const [projectSearch, setProjectSearch] = useState('');

  // Map of vendorId -> assigned projects, for the table's Projects column
  const [vendorProjectsMap, setVendorProjectsMap] = useState({});

  useEffect(() => {
    fetchVendors();
    fetchProjects();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const data = await vendorsService.list();
      setVendors(data || []);
      fetchVendorProjectsForTable(data || []);
    } catch (err) {
      setError('Failed to fetch vendors');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setProjectsLoading(true);
      const data = await projectsService.list();
      setProjects(data || []);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setProjectsLoading(false);
    }
  };

  // Populate the "Projects" column badges for the table (non-blocking, best-effort)
  const fetchVendorProjectsForTable = async (vendorList) => {
    try {
      const entries = await Promise.all(
        vendorList.map(async (v) => {
          try {
            const projs = await vendorsService.getProjects(v.id);
            return [v.id, projs || []];
          } catch {
            return [v.id, []];
          }
        })
      );
      setVendorProjectsMap(Object.fromEntries(entries));
    } catch (err) {
      console.error('Failed to fetch vendor projects for table', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError(null);
  };

  const toggleProjectSelection = (projectId) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      let vendorId = editingVendor?.id;

      if (editingVendor) {
        await vendorsService.update(editingVendor.id, formData);
      } else {
        const created = await vendorsService.create(formData);
        // Handle either { id } or [{ id }] shaped responses
        vendorId = Array.isArray(created) ? created[0]?.id : created?.id;
      }

      // Sync project assignments (only issues calls for what actually changed)
      if (vendorId) {
        await vendorsService.syncProjects(vendorId, originalProjectIds, selectedProjectIds);
      }

      setSuccess(editingVendor ? 'Vendor updated successfully!' : 'Vendor created successfully!');
      setShowModal(false);
      resetForm();
      fetchVendors();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save vendor');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;

    try {
      setLoading(true);
      await vendorsService.remove(id);
      setSuccess('Vendor deleted successfully!');
      fetchVendors();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete vendor');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vendor_name: '',
      vendor_code: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      is_active: true
    });
    setEditingVendor(null);
    setSelectedProjectIds([]);
    setOriginalProjectIds([]);
    setProjectSearch('');
  };

  const openCreateModal = () => {
    resetForm();
    setError(null);
    setShowModal(true);
  };

  const openEditModal = async (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      vendor_name: vendor.vendor_name || '',
      vendor_code: vendor.vendor_code || '',
      contact_person: vendor.contact_person || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      is_active: vendor.is_active !== undefined ? vendor.is_active : true
    });
    setError(null);
    setProjectSearch('');
    setShowModal(true);

    // Load this vendor's currently assigned projects
    try {
      const assigned = await vendorsService.getProjects(vendor.id);
      const ids = (assigned || []).map(p => p.id);
      setSelectedProjectIds(ids);
      setOriginalProjectIds(ids);
    } catch (err) {
      console.error('Failed to load vendor projects', err);
      setSelectedProjectIds([]);
      setOriginalProjectIds([]);
    }
  };

  const filteredProjects = projects.filter(p => {
    const name = p.project_name || p.name || '';
    return name.toLowerCase().includes(projectSearch.toLowerCase());
  });

  if (loading && vendors.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Vendor Management</h4>
        <button className="btn btn-success" onClick={openCreateModal}>
          <i className="bi bi-building-add me-2"></i>
          Add Vendor
        </button>
      </div>

      {success && (
        <div className="alert alert-success alert-dismissible fade show">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Code</th>
                  <th>Contact Person</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Projects</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center">No vendors found</td>
                  </tr>
                ) : (
                  vendors.map(vendor => {
                    const assignedProjects = vendorProjectsMap[vendor.id] || [];
                    return (
                      <tr key={vendor.id}>
                        <td><strong>{vendor.vendor_name}</strong></td>
                        <td>{vendor.vendor_code || 'N/A'}</td>
                        <td>{vendor.contact_person || 'N/A'}</td>
                        <td>{vendor.email || 'N/A'}</td>
                        <td>{vendor.phone || 'N/A'}</td>
                        <td>
                          {assignedProjects.length === 0 ? (
                            <span className="text-muted small">No projects</span>
                          ) : (
                            <div className="d-flex flex-wrap gap-1">
                              {assignedProjects.slice(0, 2).map(p => (
                                <span key={p.id} className="badge bg-info text-dark">
                                  {p.project_name || p.name}
                                </span>
                              ))}
                              {assignedProjects.length > 2 && (
                                <span className="badge bg-secondary">
                                  +{assignedProjects.length - 2} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${vendor.is_active ? 'bg-success' : 'bg-danger'}`}>
                            {vendor.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => openEditModal(vendor)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(vendor.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingVendor ? 'Edit Vendor' : 'Create New Vendor'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {error && (
                    <div className="alert alert-danger fade show py-2 d-flex justify-content-between align-items-center">
                      <span>{error}</span>
                      <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                    </div>
                  )}
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Vendor Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="vendor_name"
                        value={formData.vendor_name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Vendor Code</label>
                      <input
                        type="text"
                        className="form-control"
                        name="vendor_code"
                        value={formData.vendor_code}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Contact Person</label>
                      <input
                        type="text"
                        className="form-control"
                        name="contact_person"
                        value={formData.contact_person}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Phone</label>
                      <input
                        type="text"
                        className="form-control"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Address</label>
                      <textarea
                        className="form-control"
                        name="address"
                        rows="2"
                        value={formData.address}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleInputChange}
                        />
                        <label className="form-check-label">Active</label>
                      </div>
                    </div>

                    {/* Vendor Project Management */}
                    <div className="col-md-12">
                      <hr />
                      <label className="form-label fw-bold d-flex justify-content-between align-items-center">
                        <span>
                          <i className="bi bi-kanban me-2"></i>
                          Assigned Projects
                        </span>
                        <span className="badge bg-primary rounded-pill">
                          {selectedProjectIds.length} selected
                        </span>
                      </label>

                      <input
                        type="text"
                        className="form-control form-control-sm mb-2"
                        placeholder="Search projects..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                      />

                      <div
                        className="border rounded p-2"
                        style={{ maxHeight: '220px', overflowY: 'auto' }}
                      >
                        {projectsLoading ? (
                          <div className="text-center text-muted small py-2">Loading projects...</div>
                        ) : filteredProjects.length === 0 ? (
                          <div className="text-center text-muted small py-2">No projects found</div>
                        ) : (
                          filteredProjects.map(project => (
                            <div className="form-check" key={project.id}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id={`project-${project.id}`}
                                checked={selectedProjectIds.includes(project.id)}
                                onChange={() => toggleProjectSelection(project.id)}
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`project-${project.id}`}
                              >
                                {project.project_name || project.name}
                                {project.project_code || project.code ? (
                                  <span className="text-muted small ms-1">
                                    ({project.project_code || project.code})
                                  </span>
                                ) : null}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="form-text">
                        Select which projects this vendor should have access to.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (editingVendor ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
