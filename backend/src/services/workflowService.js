// src/services/workflowService.js
const workflowRepository = require('../repositories/workflowRepository');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');

class WorkflowService {
  async getAll(params) {
    return workflowRepository.getAll(params);
  }

  async getById(id) {
    const workflow = await workflowRepository.getById(id);
    if (!workflow) throw new ApiError(404, 'Workflow not found');
    return workflow;
  }

  async create({ workflow_name, description }, performedBy, ipAddress) {
    // Check for duplicate workflow name
    const existingWorkflows = await workflowRepository.getAll({ search: workflow_name, limit: 1, offset: 0 });
    const exactMatch = existingWorkflows.rows.find(
      w => w.workflow_name.toLowerCase() === workflow_name.toLowerCase()
    );
    if (exactMatch) {
      throw new ApiError(409, 'A workflow with this name already exists');
    }

    const id = await workflowRepository.create({ workflow_name, description });

    await auditService.log({
      table_name: 'workflow_master',
      record_id: id,
      action: 'CREATE',
      new_value: { workflow_name, description },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return workflowRepository.getById(id);
  }

  async update(id, { workflow_name, description, is_active }, performedBy, ipAddress) {
    const existing = await this.getById(id);

    // Check for duplicate workflow name if name is being changed
    if (workflow_name && workflow_name.toLowerCase() !== existing.workflow_name.toLowerCase()) {
      const existingWorkflows = await workflowRepository.getAll({ search: workflow_name, limit: 1, offset: 0 });
      const exactMatch = existingWorkflows.rows.find(
        w => w.workflow_name.toLowerCase() === workflow_name.toLowerCase()
      );
      if (exactMatch) {
        throw new ApiError(409, 'A workflow with this name already exists');
      }
    }

    await workflowRepository.update(id, { workflow_name, description, is_active });

    await auditService.log({
      table_name: 'workflow_master',
      record_id: id,
      action: 'UPDATE',
      old_value: { workflow_name: existing.workflow_name },
      new_value: { workflow_name, description, is_active },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return workflowRepository.getById(id);
  }

  // Steps
  async getSteps(workflowId) {
    return workflowRepository.getSteps(workflowId);
  }

  async getStepById(id) {
    return workflowRepository.getStepById(id);
  }

  async createStep({ workflow_id, step_order, step_name, step_code, is_optional, required_role_id }, performedBy, ipAddress) {
    const stepId = await workflowRepository.createStep({
      workflow_id, step_order, step_name, step_code, is_optional, required_role_id
    });

    await auditService.log({
      table_name: 'workflow_steps',
      record_id: stepId,
      action: 'CREATE',
      new_value: { workflow_id, step_order, step_name, step_code, is_optional, required_role_id },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return workflowRepository.getStepById(stepId);
  }

  async updateStep(id, { step_order, step_name, step_code, is_optional, is_active, required_role_id }, performedBy, ipAddress) {
    await workflowRepository.updateStep(id, {
      step_order, step_name, step_code, is_optional, is_active, required_role_id
    });

    await auditService.log({
      table_name: 'workflow_steps',
      record_id: id,
      action: 'UPDATE',
      new_value: { step_order, step_name, step_code, is_optional, is_active, required_role_id },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return workflowRepository.getStepById(id);
  }

  async deleteStep(id, performedBy, ipAddress) {
    await workflowRepository.deleteStep(id);

    await auditService.log({
      table_name: 'workflow_steps',
      record_id: id,
      action: 'DELETE',
      performed_by: performedBy,
      ip_address: ipAddress
    });
  }

  async getFirstStep(workflowId) {
    return workflowRepository.getFirstStep(workflowId);
  }

  async getNextStep(workflowId, currentStepOrder) {
    return workflowRepository.getNextStep(workflowId, currentStepOrder);
  }

  // ── Transitions ──

  async getTransitions(workflowId) {
    await this.getById(workflowId);
    return workflowRepository.getTransitions(workflowId);
  }

  async getTransitionById(id) {
    return workflowRepository.getTransitionById(id);
  }

  async createTransition({ workflow_id, from_step_id, to_step_id, transition_type, allowed_role_id }, performedBy, ipAddress) {
    const transitionId = await workflowRepository.createTransition({
      workflow_id, from_step_id, to_step_id, transition_type, allowed_role_id
    });

    await auditService.log({
      table_name: 'workflow_step_transitions',
      record_id: transitionId,
      action: 'CREATE',
      new_value: { workflow_id, from_step_id, to_step_id, transition_type, allowed_role_id },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return workflowRepository.getTransitionById(transitionId);
  }

  async updateTransition(id, data, performedBy, ipAddress) {
    const existing = await workflowRepository.getTransitionById(id);
    if (!existing) throw new ApiError(404, 'Transition not found');

    const { from_step_id, to_step_id, transition_type, allowed_role_id, is_active } = data;

    await workflowRepository.updateTransition(id, {
      from_step_id, to_step_id, transition_type, allowed_role_id, is_active
    });

    await auditService.log({
      table_name: 'workflow_step_transitions',
      record_id: id,
      action: 'UPDATE',
      old_value: {
        from_step_id: existing.from_step_id,
        to_step_id: existing.to_step_id,
        transition_type: existing.transition_type,
        allowed_role_id: existing.allowed_role_id,
        is_active: existing.is_active
      },
      new_value: { from_step_id, to_step_id, transition_type, allowed_role_id, is_active },
      performed_by: performedBy,
      ip_address: ipAddress
    });

    return workflowRepository.getTransitionById(id);
  }

  async deleteTransition(id, performedBy, ipAddress) {
    const existing = await workflowRepository.getTransitionById(id);
    if (!existing) throw new ApiError(404, 'Transition not found');

    await workflowRepository.deleteTransition(id);

    await auditService.log({
      table_name: 'workflow_step_transitions',
      record_id: id,
      action: 'DELETE',
      performed_by: performedBy,
      ip_address: ipAddress
    });
  }

  // ── Workflow Engine Helpers ──

  async findForwardTransition(workflowId, fromStepId, roleId) {
    return workflowRepository.findForwardTransition(workflowId, fromStepId, roleId);
  }

  async findSendbackTransition(workflowId, fromStepId, roleId) {
    return workflowRepository.findSendbackTransition(workflowId, fromStepId, roleId);
  }

  async findTransitionFromStart(workflowId, roleId) {
    return workflowRepository.findTransitionFromStart(workflowId, roleId);
  }
}

module.exports = new WorkflowService();
