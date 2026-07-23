// src/pages/ADMIN/UsersAdmin.jsx
import React, { useState, useEffect } from 'react';
import { usersService, rolesService, vendorsService } from '../../services';

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role_id: '',
    vendor_id: '',
    designation: '',
    phone: '',
    is_active: true,
    has_digital_signature: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, rolesData, vendorsData] = await Promise.all([
        usersService.list(),
        rolesService.list(),
        vendorsService.list()
      ]);
      setUsers(usersData || []);
      setRoles(rolesData || []);
      setVendors(vendorsData || []);
    } catch (err) {
      setError('Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
  const { name, value, type, checked } = e.target;
  setFormData(prev => ({
    ...prev,
    [name]: type === 'checkbox' ? checked : value,
    ...(name === 'role_id' && String(value) !== '2' ? { vendor_id: '' } : {})
  }));
  if (error) setError(null);
};
 const handleSubmit = async (e) => {
  e.preventDefault();

  if (String(formData.role_id) === '2' && !formData.vendor_id) {
    setError('Vendor is required for this role');
    return;
  }

  try {
    setLoading(true);
    setError(null);
    
    if (editingUser) {
        // Update user
        await usersService.update(editingUser.id, formData);
        setSuccess('User updated successfully!');
      } else {
        // Create user
        await usersService.create(formData);
        setSuccess('User created successfully!');
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
  setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      setLoading(true);
      await usersService.remove(id);
      setSuccess('User deleted successfully!');
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role_id: '',
      vendor_id: '',
      designation: '',
      phone: '',
      is_active: true,
      has_digital_signature: false
    });
    setEditingUser(null);
  };

  const openCreateModal = () => {
    resetForm();
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role_id: user.role_id || '',
      vendor_id: user.vendor_id || '',
      designation: user.designation || '',
      phone: user.phone || '',
      is_active: user.is_active !== undefined ? user.is_active : true,
      has_digital_signature: user.has_digital_signature || false
    });
    setShowModal(true);
  };

  if (loading && !showModal) {
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
        <h4>User Management</h4>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <i className="bi bi-person-plus me-2"></i>
          Add User
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
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>Digital Signature</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">No users found</td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className="badge bg-info">
                          {roles.find(r => r.id === user.role_id)?.role_name || 'Unknown'}
                        </span>
                      </td>
                      <td>
                        {user.vendor_id ? 
                          vendors.find(v => v.id === user.vendor_id)?.vendor_name || 'N/A' 
                          : 'N/A'}
                      </td>
                      <td>
                        <span className={`badge ${user.is_active ? 'bg-success' : 'bg-danger'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${user.has_digital_signature ? 'bg-success' : 'bg-secondary'}`}>
                          {user.has_digital_signature ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => openEditModal(user)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(user.id)}
                          disabled={user.role_id === 1} // Prevent deleting Super Admin
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
                  {editingUser ? 'Edit User' : 'Create New User'}
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
        <label className="form-label">Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email *</label>
                      <input
                        type="email"
                        className="form-control"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        disabled={!!editingUser}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">
                        {editingUser ? 'Password (leave blank to keep current)' : 'Password *'}
                      </label>
                      <input
                        type="password"
                        className="form-control"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required={!editingUser}
                        minLength="6"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Role *</label>
                      <select
                        className="form-select"
                        name="role_id"
                        value={formData.role_id}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select Role</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.role_name} (Rank: {role.role_rank})
                          </option>
                        ))}
                      </select>
                    </div>
                   {String(formData.role_id) === '2' && (
  <div className="col-md-6 mb-3">
    <label className="form-label">Vendor *</label>
    <select
      className="form-select"
      name="vendor_id"
      value={formData.vendor_id}
      onChange={handleInputChange}
      required
    >
      <option value="">Select Vendor</option>
      {vendors.map(vendor => (
        <option key={vendor.id} value={vendor.id}>
          {vendor.vendor_name}
        </option>
      ))}
    </select>
  </div>
)}
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Designation</label>
                      <input
                        type="text"
                        className="form-control"
                        name="designation"
                        value={formData.designation}
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
                   {editingUser && (
  <div className="col-md-6 mb-3">
    <div className="form-check mt-4">
      <input
        type="checkbox"
        className="form-check-input"
        name="is_active"
        checked={formData.is_active}
        onChange={handleInputChange}
      />
      <label className="form-check-label">Active</label>
    </div>
    <div className="form-check">
      <input
        type="checkbox"
        className="form-check-input"
        name="has_digital_signature"
        checked={formData.has_digital_signature}
        onChange={handleInputChange}
      />
      <label className="form-check-label">Has Digital Signature</label>
    </div>
  </div>
)}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (editingUser ? 'Update' : 'Create')}
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