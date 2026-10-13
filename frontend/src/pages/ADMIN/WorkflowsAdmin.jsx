// src/pages/ADMIN/WorkflowsAdmin.jsx
import { useState, useEffect } from 'react';
import { workflowsService, rolesService } from '../../services';
import WorkflowDetail from './WorkflowDetail';

export default function WorkflowsAdmin() {
  const [workflows, setWorkflows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [formData, setFormData] = useState({
    workflow_name: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [workflowsData, rolesData] = await Promise.all([
        workflowsService.list({ includeDetails: true }),
        rolesService.list()
      ]);
      setWorkflows(workflowsData || []);
      setRoles(rolesData || []);
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
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      const payload = {
        workflow_name: formData.workflow_name,
        description: formData.description
      };
      
      await workflowsService.create(payload);
      setSuccess('Workflow created successfully!');
      
      setShowModal(false);
      resetForm();
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  // There is no hard delete for workflows (claims keep referencing them), so the
  // action deactivates / reactivates the workflow instead.
  const handleToggleActive = async (workflow) => {
    const activate = !workflow.is_active;
    const msg = activate
      ? `Reactivate workflow "${workflow.workflow_name}"?`
      : `Deactivate workflow "${workflow.workflow_name}"? Projects using it will not be able to start new claims until it is reactivated.`;
    if (!window.confirm(msg)) return;

    try {
      setLoading(true);
      await workflowsService.update(workflow.id, { is_active: activate });
      setSuccess(`Workflow ${activate ? 'reactivated' : 'deactivated'}`);
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update workflow');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      workflow_name: '',
      description: '',
      is_active: true
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openWorkflowDetail = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowDetail(true);
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

  if (showDetail && selectedWorkflow) {
    return (
      <WorkflowDetail 
        workflow={selectedWorkflow}
        roles={roles}
        onBack={() => {
          setShowDetail(false);
          setSelectedWorkflow(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Workflow Management</h4>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <i className="bi bi-diagram-3 me-2"></i>
          Create Workflow
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
                  <th>Workflow Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center">No workflows found</td>
                  </tr>
                ) : (
                  workflows.map(workflow => (
                    <tr key={workflow.id}>
                      <td><strong>{workflow.workflow_name}</strong></td>
                      <td>{workflow.description || 'N/A'}</td>
                      <td>
                        <span className={`badge ${workflow.is_active ? 'bg-success' : 'bg-danger'}`}>
                          {workflow.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => openWorkflowDetail(workflow)}
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                        <button 
                          className={`btn btn-sm ${workflow.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          onClick={() => handleToggleActive(workflow)}
                          title={workflow.is_active ? 'Deactivate' : 'Reactivate'}
                          aria-label={workflow.is_active ? 'Deactivate workflow' : 'Reactivate workflow'}
                        >
                          <i className={`bi ${workflow.is_active ? 'bi-slash-circle' : 'bi-check-circle'}`}></i>
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

      {/* Modal for Create Workflow */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create New Workflow</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Workflow Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      name="workflow_name"
                      value={formData.workflow_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      name="description"
                      rows="3"
                      value={formData.description}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Creating...' : 'Create'}
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