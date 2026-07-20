// src/pages/ADMIN/RolesAdmin.jsx
import React, { useState, useEffect } from 'react';
import { rolesService } from '../../services';

export default function RolesAdmin() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    role_name: '',
    role_rank: '',
    description: '',
    permissions: {},
    is_active: true
  });
  const [permissionsText, setPermissionsText] = useState('{}');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await rolesService.list();
      setRoles(data || []);
    } catch (err) {
      setError('Failed to fetch roles');
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

  const handlePermissionsChange = (e) => {
    setPermissionsText(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      setFormData(prev => ({
        ...prev,
        permissions: parsed
      }));
    } catch (err) {
      // Invalid JSON, don't update
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      // Validate permissions JSON
      let permissions = formData.permissions;
      try {
        permissions = typeof permissionsText === 'string' ? JSON.parse(permissionsText) : permissionsText;
      } catch (err) {
        setError('Invalid permissions JSON format');
        return;
      }
      
      const payload = {
        ...formData,
        permissions
      };
      
      if (editingRole) {
        await rolesService.update(editingRole.id, payload);
        setSuccess('Role updated successfully!');
      } else {
        await rolesService.create(payload);
        setSuccess('Role created successfully!');
      }
      
      setShowModal(false);
      resetForm();
      fetchRoles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    
    try {
      setLoading(true);
      await rolesService.remove(id);
      setSuccess('Role deleted successfully!');
      fetchRoles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete role');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      role_name: '',
      role_rank: '',
      description: '',
      permissions: {},
      is_active: true
    });
    setPermissionsText('{}');
    setEditingRole(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    const permissionsStr = JSON.stringify(role.permissions || {}, null, 2);
    setPermissionsText(permissionsStr);
    setFormData({
      role_name: role.role_name || '',
      role_rank: role.role_rank || '',
      description: role.description || '',
      permissions: role.permissions || {},
      is_active: role.is_active !== undefined ? role.is_active : true
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
        <h4>Role Management</h4>
        <button className="btn btn-warning" onClick={openCreateModal}>
          <i className="bi bi-shield-plus me-2"></i>
          Add Role
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
                  <th>Role Name</th>
                  <th>Rank</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center">No roles found</td>
                  </tr>
                ) : (
                  roles.map(role => (
                    <tr key={role.id}>
                      <td><strong>{role.role_name}</strong></td>
                      <td>{role.role_rank}</td>
                      <td>{role.description || 'N/A'}</td>
                      <td>
                        <span className={`badge ${role.is_active ? 'bg-success' : 'bg-danger'}`}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-outline-info"
                          onClick={() => {
                            alert(JSON.stringify(role.permissions, null, 2));
                          }}
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => openEditModal(role)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(role.id)}
                          disabled={role.id === 1} // Prevent deleting Super Admin
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
                  {editingRole ? 'Edit Role' : 'Create New Role'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Role Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="role_name"
                        value={formData.role_name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Role Rank *</label>
                      <input
                        type="number"
                        className="form-control"
                        name="role_rank"
                        value={formData.role_rank}
                        onChange={handleInputChange}
                        required
                        min="1"
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Description</label>
                      <input
                        type="text"
                        className="form-control"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Permissions (JSON)</label>
                      <textarea
                        className="form-control"
                        rows="10"
                        value={permissionsText}
                        onChange={handlePermissionsChange}
                        placeholder='{"resource": {"action": true}}'
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      />
                      <small className="text-muted">
                        Enter valid JSON. Example: {"{"}"package": {"{"}"create": true, "read": true{"}"}{"}"}
                      </small>
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
                    {loading ? 'Saving...' : (editingRole ? 'Update' : 'Create')}
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