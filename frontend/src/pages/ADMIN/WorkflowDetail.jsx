// src/pages/ADMIN/WorkflowDetail.jsx
import React, { useState, useEffect } from 'react';
import { workflowsService } from '../../services';

export default function WorkflowDetail({ workflow, roles, onBack }) {
  const [steps, setSteps] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [editingTransition, setEditingTransition] = useState(null);
  const [stepForm, setStepForm] = useState({
    step_order: '',
    step_name: '',
    step_code: '',
    required_role_id: '',
    is_active: true
  });
  const [transitionForm, setTransitionForm] = useState({
    from_step_id: '',
    to_step_id: '',
    transition_type: 'FORWARD',
    allowed_role_id: '',
    is_active: true
  });

  useEffect(() => {
    fetchWorkflowDetails();
  }, [workflow.id]);

  const fetchWorkflowDetails = async () => {
    try {
      setLoading(true);
      const [stepsData, transitionsData] = await Promise.all([
        workflowsService.getSteps(workflow.id),
        workflowsService.getTransitions(workflow.id)
      ]);
      setSteps(stepsData || []);
      setTransitions(transitionsData || []);
    } catch (err) {
      setError('Failed to fetch workflow details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStepSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      if (editingStep) {
        await workflowsService.updateStep(editingStep.id, stepForm);
        setSuccess('Step updated successfully!');
      } else {
        await workflowsService.createStep(workflow.id, stepForm);
        setSuccess('Step created successfully!');
      }
      
      setShowStepModal(false);
      resetStepForm();
      fetchWorkflowDetails();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save step');
    } finally {
      setLoading(false);
    }
  };

  const handleTransitionSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      const data = {
        from_step_id: transitionForm.from_step_id || null,
        to_step_id: transitionForm.to_step_id,
        transition_type: transitionForm.transition_type,
        allowed_role_id: transitionForm.allowed_role_id
      };
      
      await workflowsService.createTransition(workflow.id, data);
      setSuccess('Transition created successfully!');
      
      setShowTransitionModal(false);
      resetTransitionForm();
      fetchWorkflowDetails();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create transition');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStep = async (id) => {
    if (!window.confirm('Are you sure you want to delete this step?')) return;
    
    try {
      setLoading(true);
      await workflowsService.removeStep(id);
      setSuccess('Step deleted successfully!');
      fetchWorkflowDetails();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete step');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransition = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transition?')) return;
    
    try {
      setLoading(true);
      await workflowsService.removeTransition(id);
      setSuccess('Transition deleted successfully!');
      fetchWorkflowDetails();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete transition');
    } finally {
      setLoading(false);
    }
  };

  const resetStepForm = () => {
    setStepForm({
      step_order: '',
      step_name: '',
      step_code: '',
      required_role_id: '',
      is_active: true
    });
    setEditingStep(null);
  };

  const resetTransitionForm = () => {
    setTransitionForm({
      from_step_id: '',
      to_step_id: '',
      transition_type: 'FORWARD',
      allowed_role_id: '',
      is_active: true
    });
    setEditingTransition(null);
  };

  const openStepModal = (step = null) => {
    if (step) {
      setEditingStep(step);
      setStepForm({
        step_order: step.step_order || '',
        step_name: step.step_name || '',
        step_code: step.step_code || '',
        required_role_id: step.required_role_id || '',
        is_active: step.is_active !== undefined ? step.is_active : true
      });
    } else {
      resetStepForm();
    }
    setShowStepModal(true);
  };

  const openTransitionModal = () => {
    resetTransitionForm();
    setShowTransitionModal(true);
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.role_name : 'Unknown';
  };

  const getStepName = (stepId) => {
    const step = steps.find(s => s.id === stepId);
    return step ? step.step_name : 'Start';
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
        <div>
          <button className="btn btn-outline-secondary me-2" onClick={onBack}>
            <i className="bi bi-arrow-left me-1"></i> Back
          </button>
          <h4 className="d-inline-block">{workflow.workflow_name}</h4>
        </div>
        <div>
          <button className="btn btn-primary me-2" onClick={() => openStepModal()}>
            <i className="bi bi-plus-circle me-1"></i> Add Step
          </button>
          <button className="btn btn-success" onClick={openTransitionModal}>
            <i className="bi bi-arrow-left-right me-1"></i> Add Transition
          </button>
        </div>
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

      <div className="row">
        {/* Steps Section */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Workflow Steps</h5>
            </div>
            <div className="card-body">
              {steps.length === 0 ? (
                <div className="text-center text-muted py-3">
                  No steps configured yet
                </div>
              ) : (
                <div className="list-group">
                  {steps
                    .sort((a, b) => a.step_order - b.step_order)
                    .map(step => (
                      <div key={step.id} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <span className="badge bg-secondary me-2">{step.step_order}</span>
                            <strong>{step.step_name}</strong>
                            <br />
                            <small className="text-muted">
                              Role: {getRoleName(step.required_role_id)}
                            </small>
                            {step.step_code && (
                              <span className="badge bg-info ms-2">{step.step_code}</span>
                            )}
                          </div>
                          <div>
                            <button 
                              className="btn btn-sm btn-outline-primary me-1"
                              onClick={() => openStepModal(step)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteStep(step.id)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transitions Section */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Workflow Transitions</h5>
            </div>
            <div className="card-body">
              {transitions.length === 0 ? (
                <div className="text-center text-muted py-3">
                  No transitions configured yet
                </div>
              ) : (
                <div className="list-group">
                  {transitions.map(transition => (
                    <div key={transition.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <span className="badge bg-primary me-2">
                            {getStepName(transition.from_step_id)} 
                            <i className="bi bi-arrow-right mx-1"></i> 
                            {getStepName(transition.to_step_id)}
                          </span>
                          <br />
                          <small className="text-muted">
                            Type: {transition.transition_type} | 
                            Role: {getRoleName(transition.allowed_role_id)}
                          </small>
                        </div>
                        <div>
                          <button 
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteTransition(transition.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step Modal */}
      {showStepModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingStep ? 'Edit Step' : 'Add New Step'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowStepModal(false)}></button>
              </div>
              <form onSubmit={handleStepSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Step Order *</label>
                    <input
                      type="number"
                      className="form-control"
                      name="step_order"
                      value={stepForm.step_order}
                      onChange={(e) => setStepForm({...stepForm, step_order: e.target.value})}
                      required
                      min="1"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Step Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      name="step_name"
                      value={stepForm.step_name}
                      onChange={(e) => setStepForm({...stepForm, step_name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Step Code</label>
                    <input
                      type="text"
                      className="form-control"
                      name="step_code"
                      value={stepForm.step_code}
                      onChange={(e) => setStepForm({...stepForm, step_code: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Required Role *</label>
                    <select
                      className="form-select"
                      name="required_role_id"
                      value={stepForm.required_role_id}
                      onChange={(e) => setStepForm({...stepForm, required_role_id: e.target.value})}
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
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowStepModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (editingStep ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transition Modal */}
      {showTransitionModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Transition</h5>
                <button type="button" className="btn-close" onClick={() => setShowTransitionModal(false)}></button>
              </div>
              <form onSubmit={handleTransitionSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">From Step (Optional)</label>
                    <select
                      className="form-select"
                      name="from_step_id"
                      value={transitionForm.from_step_id}
                      onChange={(e) => setTransitionForm({...transitionForm, from_step_id: e.target.value})}
                    >
                      <option value="">Start (Vendor Submission)</option>
                      {steps.map(step => (
                        <option key={step.id} value={step.id}>
                          {step.step_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">To Step *</label>
                    <select
                      className="form-select"
                      name="to_step_id"
                      value={transitionForm.to_step_id}
                      onChange={(e) => setTransitionForm({...transitionForm, to_step_id: e.target.value})}
                      required
                    >
                      <option value="">Select Step</option>
                      {steps.map(step => (
                        <option key={step.id} value={step.id}>
                          {step.step_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Transition Type *</label>
                    <select
                      className="form-select"
                      name="transition_type"
                      value={transitionForm.transition_type}
                      onChange={(e) => setTransitionForm({...transitionForm, transition_type: e.target.value})}
                      required
                    >
                      <option value="FORWARD">Forward</option>
                      <option value="SENDBACK">Sendback</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Allowed Role *</label>
                    <select
                      className="form-select"
                      name="allowed_role_id"
                      value={transitionForm.allowed_role_id}
                      onChange={(e) => setTransitionForm({...transitionForm, allowed_role_id: e.target.value})}
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
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowTransitionModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Transition'}
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