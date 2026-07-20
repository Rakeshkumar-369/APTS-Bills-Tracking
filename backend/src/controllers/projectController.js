const projectService = require('../services/projectService');
const ApiResponse = require('../utils/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const getAllProjects = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const { search, is_active } = req.query;

    const result = await projectService.getAll({
      limit, offset, search,
      is_active: is_active !== undefined ? (is_active === 'true' || is_active === '1' ? 1 : 0) : undefined
    });

    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Projects fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await projectService.getById(req.params.id);
    res.json(ApiResponse.success('Project fetched successfully', [project]));
  } catch (error) {
    next(error);
  }
};

const createProject = async (req, res, next) => {
  try {
    const project = await projectService.create(req.body, req.user.user_id, req.ip);
    res.status(201).json(ApiResponse.success('Project created successfully', [project]));
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await projectService.update(req.params.id, req.body, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Project updated successfully', [project]));
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    await projectService.delete(req.params.id, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Project deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllProjects, getProjectById, createProject, updateProject, deleteProject };
