// src/controllers/userController.js
const userService = require('../services/userService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { resolveIsActiveFilter } = require('../utils/isActiveFilter');

const getAllUsers = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const { search, role_id, is_active: rawIsActive, department_id } = req.query;

    const result = await userService.getAll({
      limit, offset, search,
      role_id: role_id ? Number(role_id) : undefined,
      is_active: resolveIsActiveFilter(req.user, rawIsActive),
      department_id: department_id ? Number(department_id) : undefined
    }, req.user);

    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Users fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id, req.user);
    const { password_hash, ...safeUser } = user;
    res.json(ApiResponse.success('User fetched successfully', [safeUser]));
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await userService.create(req.body, req.user.user_id, req.ip);
    const { password_hash, ...safeUser } = user;
    res.status(201).json(ApiResponse.success('User created successfully', [safeUser]));
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const updated = await userService.update(req.params.id, req.body, req.user.user_id, req.ip);
    const { password_hash, ...safeUser } = updated;
    res.json(ApiResponse.success('User updated successfully', [safeUser]));
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    await userService.delete(req.params.id, req.user.user_id, req.ip);
    res.json(ApiResponse.success('User deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

const getAllRoles = async (req, res, next) => {
  try {
    const rows = await userService.getAllRoles();
    res.json(ApiResponse.success('Roles fetched successfully', rows));
  } catch (error) {
    next(error);
  }
};

const getOfficers = async (req, res, next) => {
  try {
    const officers = await userService.getOfficers();
    res.json(ApiResponse.success('Officers fetched successfully', officers));
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser, getAllRoles, getOfficers };
