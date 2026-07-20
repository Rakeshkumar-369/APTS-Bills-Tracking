const packageService = require('../services/packageService');
const ApiResponse = require('../utils/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const getAllPackages = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const { status, vendor_id, project_id, workflow_id, search } = req.query;

    const result = await packageService.getAll({
      limit, offset,
      status,
      vendor_id: vendor_id ? Number(vendor_id) : undefined,
      project_id: project_id ? Number(project_id) : undefined,
      workflow_id: workflow_id ? Number(workflow_id) : undefined,
      search
    });

    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Packages fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getPackageById = async (req, res, next) => {
  try {
    const includeDetails = req.query.include_details !== 'false';
    const pkg = includeDetails
      ? await packageService.getWithDetails(req.params.id)
      : await packageService.getById(req.params.id);
    res.json(ApiResponse.success('Package fetched successfully', [pkg]));
  } catch (error) {
    next(error);
  }
};

const createPackage = async (req, res, next) => {
  try {
    const pkg = await packageService.create(req.body, req.user, req.ip);
    res.status(201).json(ApiResponse.success('Package created successfully', [pkg]));
  } catch (error) {
    next(error);
  }
};

const forwardPackage = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const pkg = await packageService.forward(req.params.id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Package forwarded successfully', [pkg]));
  } catch (error) {
    next(error);
  }
};

const sendbackPackage = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const pkg = await packageService.sendback(req.params.id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Package returned successfully', [pkg]));
  } catch (error) {
    next(error);
  }
};

const resubmitPackage = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const pkg = await packageService.resubmit(req.params.id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Package re-submitted successfully', [pkg]));
  } catch (error) {
    next(error);
  }
};

const getPackageHistory = async (req, res, next) => {
  try {
    const history = await packageService.getHistory(req.params.id);
    res.json(ApiResponse.success('Package history fetched successfully', history));
  } catch (error) {
    next(error);
  }
};

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(ApiResponse.error('No file provided', []));
    }
    const fileId = await packageService.uploadFile(req.params.id, req.file, req.user);
    res.status(201).json(ApiResponse.success('File uploaded successfully', [{ id: fileId }]));
  } catch (error) {
    next(error);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    await packageService.deleteFile(req.params.id, req.params.fileId, req.user);
    res.json(ApiResponse.success('File deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPackages, getPackageById, createPackage,
  forwardPackage, sendbackPackage, resubmitPackage,
  getPackageHistory, uploadFile, deleteFile
};
