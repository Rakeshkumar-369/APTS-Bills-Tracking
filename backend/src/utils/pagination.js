// src/utils/pagination.js

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 400; // sensible max for most lists

/**
 * Parse and sanitize limit/offset query parameters.
 * Returns { limit, offset } with safe numbers.
 */
function parsePagination(limit, offset, options = {}) {
  const parsedLimit = Math.min(
    parseInt(limit) || options.defaultLimit || DEFAULT_LIMIT,
    options.maxLimit || MAX_LIMIT
  );
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);
  return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Build a consistent pagination metadata object.
 * @param {number} total - total records count
 * @param {number} limit - items per page used
 * @param {number} offset - current offset
 * @param {number} itemCount - number of records in this page
 */
function buildPaginationMeta(total, limit, offset, itemCount) {
  return {
    total,
    limit,
    offset,
    hasMore: offset + itemCount < total,
  };
}

module.exports = { parsePagination, buildPaginationMeta };