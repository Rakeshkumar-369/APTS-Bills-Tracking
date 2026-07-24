const workflowService = require('../services/workflowService');
const ApiResponse = require('../utils/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { resolveIsActiveFilter } = require('../utils/isActiveFilter');

// ── Workflow Master ──

const getAllWorkflows = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const { search, is_active: rawIsActive } = req.query;

    const result = await workflowService.getAll({
      limit, offset, search,
      is_active: resolveIsActiveFilter(req.user, rawIsActive)
    });

    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Workflows fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getWorkflowById = async (req, res, next) => {
  try {
    const includeDetails = req.query.include_details === 'true';
    const workflow = await workflowService.getById(req.params.id);

    if (includeDetails) {
      workflow.steps = await workflowService.getSteps(req.params.id);
      workflow.transitions = await workflowService.getTransitions(req.params.id);
    }

    res.json(ApiResponse.success('Workflow fetched successfully', [workflow]));
  } catch (error) {
    next(error);
  }
};

const createWorkflow = async (req, res, next) => {
  try {
    const workflow = await workflowService.create(req.body, req.user.user_id, req.ip);
    res.status(201).json(ApiResponse.success('Workflow created successfully', [workflow]));
  } catch (error) {
    next(error);
  }
};

const updateWorkflow = async (req, res, next) => {
  try {
    const workflow = await workflowService.update(req.params.id, req.body, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Workflow updated successfully', [workflow]));
  } catch (error) {
    next(error);
  }
};

// ── Workflow Steps ──

const getWorkflowSteps = async (req, res, next) => {
  try {
    const steps = await workflowService.getSteps(req.params.id);
    res.json(ApiResponse.success('Workflow steps fetched successfully', steps));
  } catch (error) {
    next(error);
  }
};

const createWorkflowStep = async (req, res, next) => {
  try {
    const step = await workflowService.createStep(
      { ...req.body, workflow_id: Number(req.params.id) },
      req.user.user_id,
      req.ip
    );
    res.status(201).json(ApiResponse.success('Workflow step created successfully', [step]));
  } catch (error) {
    next(error);
  }
};

const updateWorkflowStep = async (req, res, next) => {
  try {
    const step = await workflowService.updateStep(req.params.id, req.body, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Workflow step updated successfully', [step]));
  } catch (error) {
    next(error);
  }
};

const deleteWorkflowStep = async (req, res, next) => {
  try {
    await workflowService.deleteStep(req.params.id, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Workflow step deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

// ── Workflow Step Transitions ──

const getWorkflowTransitions = async (req, res, next) => {
  try {
    const transitions = await workflowService.getTransitions(req.params.id);
    res.json(ApiResponse.success('Workflow transitions fetched successfully', transitions));
  } catch (error) {
    next(error);
  }
};

const createWorkflowTransition = async (req, res, next) => {
  try {
    const transition = await workflowService.createTransition(
      { ...req.body, workflow_id: Number(req.params.id) },
      req.user.user_id,
      req.ip
    );
    res.status(201).json(ApiResponse.success('Workflow transition created successfully', [transition]));
  } catch (error) {
    next(error);
  }
};

const updateWorkflowTransition = async (req, res, next) => {
  try {
    const transition = await workflowService.updateTransition(
      req.params.id,
      req.body,
      req.user.user_id,
      req.ip
    );
    res.json(ApiResponse.success('Workflow transition updated successfully', [transition]));
  } catch (error) {
    next(error);
  }
};

const deleteWorkflowTransition = async (req, res, next) => {
  try {
    await workflowService.deleteTransition(req.params.id, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Workflow transition deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllWorkflows, getWorkflowById, createWorkflow, updateWorkflow,
  getWorkflowSteps, createWorkflowStep, updateWorkflowStep, deleteWorkflowStep,
  getWorkflowTransitions, createWorkflowTransition, updateWorkflowTransition, deleteWorkflowTransition
};
