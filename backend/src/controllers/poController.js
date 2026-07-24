const poService = require('../services/poService');
const ApiResponse = require('../utils/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { resolveIsActiveFilter } = require('../utils/isActiveFilter');

const getAllPOs = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const { project_id, vendor_id, status, search, is_active: rawIsActive } = req.query;

    const params = {
      limit, offset, project_id, vendor_id, status, search,
      is_active: resolveIsActiveFilter(req.user, rawIsActive)
    };

    // Vendor users can only see POs assigned to their vendor
    if (req.user.role_name === 'Vendor') {
      params.vendor_id = req.user.vendor_id;
    }

    const result = await poService.getAll(params);
    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Purchase Orders fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getPOById = async (req, res, next) => {
  try {
    const includeFiles = req.query.include_files !== 'false';
    const po = includeFiles
      ? await poService.getWithFiles(req.params.id)
      : await poService.getById(req.params.id);
    res.json(ApiResponse.success('Purchase Order fetched successfully', [po]));
  } catch (error) {
    next(error);
  }
};

const createPO = async (req, res, next) => {
  try {
    const po = await poService.create(req.body, req.files, req.user.user_id, req.ip);
    res.status(201).json(ApiResponse.success('Purchase Order created successfully', [po]));
  } catch (error) {
    next(error);
  }
};

const updatePO = async (req, res, next) => {
  try {
    const po = await poService.update(req.params.id, req.body, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Purchase Order updated successfully', [po]));
  } catch (error) {
    next(error);
  }
};

const deletePO = async (req, res, next) => {
  try {
    await poService.delete(req.params.id, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Purchase Order deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

// ── PO Files ──

const uploadPOFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(ApiResponse.error('No file provided', []));
    }
    const fileId = await poService.uploadFile(req.params.id, req.file, req.user);
    res.status(201).json(ApiResponse.success('File uploaded successfully', [{ id: fileId }]));
  } catch (error) {
    next(error);
  }
};

const deletePOFile = async (req, res, next) => {
  try {
    await poService.deleteFile(req.params.id, req.params.fileId, req.user);
    res.json(ApiResponse.success('File deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllPOs, getPOById, createPO, updatePO, deletePO, uploadPOFile, deletePOFile };
