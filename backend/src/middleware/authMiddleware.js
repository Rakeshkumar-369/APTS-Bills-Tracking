const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');
const { parsePermissions } = require('../utils/permissionHelper');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
        data: []
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await userRepo.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
        data: []
      });
    }

    if (user.session_version !== decoded.sv) {
      return res.status(401).json({
        success: false,
        message: 'Session invalidated. Please login again.',
        data: []
      });
    }

    const permissions = parsePermissions(user.permissions);

    req.user = {
      user_id: decoded.sub,
      role_id: decoded.role_id,
      role_name: user.role_name,
      role_rank: user.role_rank,
      permissions: permissions,
      vendor_id: user.vendor_id || null,
      name: user.name,
      email: user.email,
      designation: user.designation,
      has_digital_signature: !!user.has_digital_signature
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        data: []
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        data: []
      });
    }
    res.status(401).json({
      success: false,
      message: error.message,
      data: []
    });
  }
};

module.exports = authMiddleware;
