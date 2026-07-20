const vendorService = require('../services/vendorService');
const ApiResponse = require('../utils/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const getAllVendors = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const { search, is_active } = req.query;

    const result = await vendorService.getAll({
      limit, offset, search,
      is_active: is_active !== undefined ? (is_active === 'true' || is_active === '1' ? 1 : 0) : undefined
    });

    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Vendors fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getVendorById = async (req, res, next) => {
  try {
    const includeUsers = req.query.include_users === 'true';
    const vendor = includeUsers
      ? await vendorService.getWithUsers(req.params.id)
      : await vendorService.getById(req.params.id);
    res.json(ApiResponse.success('Vendor fetched successfully', [vendor]));
  } catch (error) {
    next(error);
  }
};

const createVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.create(req.body, req.user.user_id, req.ip);
    res.status(201).json(ApiResponse.success('Vendor created successfully', [vendor]));
  } catch (error) {
    next(error);
  }
};

const updateVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.update(req.params.id, req.body, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Vendor updated successfully', [vendor]));
  } catch (error) {
    next(error);
  }
};

const deleteVendor = async (req, res, next) => {
  try {
    await vendorService.delete(req.params.id, req.user.user_id, req.ip);
    res.json(ApiResponse.success('Vendor deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllVendors, getVendorById, createVendor, updateVendor, deleteVendor };
