const claimService = require('../services/claimService');
const ApiResponse = require('../utils/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const getInbox = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const result = await claimService.getInbox(req.user, { limit, offset });
    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Inbox fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getOutbox = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const result = await claimService.getOutbox(req.user, { limit, offset });
    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Outbox fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getInboxStats = async (req, res, next) => {
  try {
    const stats = await claimService.getInboxStats(req.user);
    res.json(ApiResponse.success('Inbox stats fetched successfully', [stats]));
  } catch (error) {
    next(error);
  }
};

module.exports = { getInbox, getOutbox, getInboxStats };
