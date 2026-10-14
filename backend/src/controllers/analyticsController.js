const analyticsService = require('../services/analyticsService');
const ApiResponse = require('../utils/ApiResponse');

const getOverview = async (req, res, next) => {
  try {
    const { from, to, granularity } = req.query;
    const data = await analyticsService.getOverview({ from, to, granularity });
    res.json(ApiResponse.success('Analytics fetched successfully', [data]));
  } catch (error) {
    next(error);
  }
};

module.exports = { getOverview };