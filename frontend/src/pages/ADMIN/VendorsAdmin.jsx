// src/pages/ADMIN/VendorsAdmin.jsx
import React, { useState, useEffect } from 'react';
import { vendorsService } from '../../services';

export default function VendorsAdmin() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const data = await vendorsService.list();
      setVendors(data || []);
    } catch (err) {
      setError('Failed to fetch vendors');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      if (editingVendor) {
        await vendorsService.update(editingVendor.id, formData);
        setSuccess('Vendor updated successfully!');
      } else {
        await vendorsService.create(formData);
        setSuccess('Vendor created successfully!');
      }
      
      setShowModal(false);
      resetForm();
      fetchVendors();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save vendor');
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
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (vendor) => {
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
    setShowModal(true);
  };

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
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Vendor Management</h4>
        <button className="btn btn-success" onClick={openCreateModal}>
          <i className="bi bi-building-add me-2"></i>
          Add Vendor
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

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
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">No vendors found</td>
                  </tr>
                ) : (
                  vendors.map(vendor => (
                    <tr key={vendor.id}>
                      <td><strong>{vendor.vendor_name}</strong></td>
                      <td>{vendor.vendor_code || 'N/A'}</td>
                      <td>{vendor.contact_person || 'N/A'}</td>
                      <td>{vendor.email || 'N/A'}</td>
                      <td>{vendor.phone || 'N/A'}</td>
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
                  ))
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