// src/pages/ADMIN/RolesAdmin.jsx
import React, { useState, useEffect } from 'react';
import { rolesService } from '../../services';

// Known modules and their actions (any extra keys already on a role are kept and shown too)
const PERMISSION_CATALOG = {
  vendor: ['read', 'create', 'update', 'delete'],
  po: ['read', 'create', 'update', 'delete'],
  claim: ['read', 'create', 'update', 'delete', 'forward', 'sendback', 'approve'],
  payment: ['read', 'create'],
  procurement: ['read', 'create', 'update', 'delete', 'advance', 'comment', 'upload_document'],
  workflow: ['manage', 'configure_steps'],
  user_management: ['read', 'create', 'update', 'delete', 'assign_role'],
  role_management: ['read', 'create', 'update', 'delete', 'assign_permissions'],
  report: ['view', 'export'],
  audit: ['view'],
};

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
  const [showJsonEditor, setShowJsonEditor] = useState(false); // advanced raw-JSON mode
  const [viewRole, setViewRole] = useState(null); // role whose permissions are being viewed

  // Normalise permissions (object or JSON string) into { module: { action: bool } }
  const parsePermissions = (perms) => {
    if (!perms) return {};
    if (typeof perms === 'string') {
      try { return JSON.parse(perms) || {}; } catch { return {}; }
    }
    return perms;
  };

  const formatLabel = (key) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
    if (error) setError(null);
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
    if (error) setError(null);
  };

  // ── Checkbox-based permission editing ──
  const isChecked = (module, action) => Boolean(formData.permissions?.[module]?.[action]);

  const togglePermission = (module, action) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: { ...(prev.permissions?.[module] || {}), [action]: !prev.permissions?.[module]?.[action] }
      }
    }));
    if (error) setError(null);
  };

  const toggleModule = (module, actions, value) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: { ...(prev.permissions?.[module] || {}), ...Object.fromEntries(actions.map(a => [a, value])) }
      }
    }));
  };

  // Catalog modules + any extra modules/actions already present on the role
  const getModuleList = () => {
    const perms = formData.permissions || {};
    const modules = { ...PERMISSION_CATALOG };
    Object.entries(perms).forEach(([mod, acts]) => {
      const known = modules[mod] || [];
      const extra = acts && typeof acts === 'object' ? Object.keys(acts).filter(a => !known.includes(a)) : [];
      modules[mod] = [...known, ...extra];
    });
    return Object.entries(modules);
  };

  const toggleJsonEditor = () => {
    if (!showJsonEditor) {
      setPermissionsText(JSON.stringify(formData.permissions || {}, null, 2));
      setShowJsonEditor(true);
    } else {
      try {
        setFormData(prev => ({ ...prev, permissions: JSON.parse(permissionsText) }));
        setShowJsonEditor(false);
        setError(null);
      } catch (err) {
        setError('Invalid permissions JSON format — fix it before switching back');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      // Validate permissions JSON
      let permissions = formData.permissions;
      if (showJsonEditor) {
        try {
          permissions = JSON.parse(permissionsText);
        } catch (err) {
          setError('Invalid permissions JSON format');
          return;
        }
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
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save role');
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
    setShowJsonEditor(false);
    setEditingRole(null);
  };

  const openCreateModal = () => {
    resetForm();
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    const perms = parsePermissions(role.permissions);
    setPermissionsText(JSON.stringify(perms, null, 2));
    setShowJsonEditor(false);
    setFormData({
      role_name: role.role_name || '',
      role_rank: role.role_rank || '',
      description: role.description || '',
      permissions: perms,
      is_active: role.is_active !== undefined ? role.is_active : true
    });
    setError(null);
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
                          title="View permissions"
                          onClick={() => setViewRole(role)}
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
                <button type="button" className="btn-close" onClick={() => { setShowModal(false); setError(null); }}></button>
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
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label mb-0">Permissions</label>
                        <button type="button" className="btn btn-sm btn-link text-decoration-none p-0" onClick={toggleJsonEditor}>
                          <i className={`bi ${showJsonEditor ? 'bi-ui-checks' : 'bi-code-slash'} me-1`}></i>
                          {showJsonEditor ? 'Back to checkbox editor' : 'Advanced: edit as JSON'}
                        </button>
                      </div>

                      {showJsonEditor ? (
                        <>
                          <textarea
                            className="form-control"
                            rows="10"
                            value={permissionsText}
                            onChange={handlePermissionsChange}
                            placeholder='{"resource": {"action": true}}'
                            style={{ fontFamily: 'monospace', fontSize: '12px' }}
                          />
                          <small className="text-muted">Enter valid JSON.</small>
                        </>
                      ) : (
                        <div className="border rounded-3 p-2" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                          {getModuleList().map(([module, actions]) => {
                            const allOn = actions.length > 0 && actions.every(a => isChecked(module, a));
                            return (
                              <div key={module} className="border-bottom py-2 px-1">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <span className="fw-semibold">{module.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-decoration-none p-0 small"
                                    onClick={() => toggleModule(module, actions, !allOn)}
                                  >
                                    {allOn ? 'Clear all' : 'Select all'}
                                  </button>
                                </div>
                                <div className="d-flex flex-wrap gap-3">
                                  {actions.map(action => (
                                    <div className="form-check" key={action}>
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id={`perm-${module}-${action}`}
                                        checked={isChecked(module, action)}
                                        onChange={() => togglePermission(module, action)}
                                      />
                                      <label className="form-check-label small" htmlFor={`perm-${module}-${action}`}>
                                        {action.replace(/_/g, ' ')}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setError(null); }}>
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

      {/* View Permissions Modal */}
      {viewRole && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setViewRole(null)}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-shield-lock text-primary me-2"></i>
                  {viewRole.role_name} — Permissions
                </h5>
                <button type="button" className="btn-close" onClick={() => setViewRole(null)}></button>
              </div>
              <div className="modal-body">
                {Object.keys(parsePermissions(viewRole.permissions)).length === 0 ? (
                  <p className="text-muted mb-0">No permissions assigned to this role.</p>
                ) : (
                  <div className="row g-3">
                    {Object.entries(parsePermissions(viewRole.permissions)).map(([module, actions]) => (
                      <div className="col-md-6" key={module}>
                        <div className="border rounded-3 p-3 h-100">
                          <div className="fw-bold mb-2">{formatLabel(module)}</div>
                          <div className="d-flex flex-wrap gap-2">
                            {actions && typeof actions === 'object' ? (
                              Object.entries(actions).map(([action, allowed]) => (
                                <span
                                  key={action}
                                  className={`badge ${allowed ? 'bg-success' : 'bg-secondary bg-opacity-50'}`}
                                >
                                  <i className={`bi ${allowed ? 'bi-check-lg' : 'bi-x-lg'} me-1`}></i>
                                  {formatLabel(action)}
                                </span>
                              ))
                            ) : (
                              <span className={`badge ${actions ? 'bg-success' : 'bg-secondary bg-opacity-50'}`}>
                                {actions ? 'Allowed' : 'Denied'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setViewRole(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}