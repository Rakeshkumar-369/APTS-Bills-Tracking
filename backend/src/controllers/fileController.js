const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const ApiResponse = require('../utils/ApiResponse');

const servePackageFile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM package_files WHERE id = ? AND package_id = ?',
      [req.params.fileId, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json(ApiResponse.error('File not found', []));
    }

    const file = rows[0];
    const filePath = path.join(__dirname, '../..', file.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json(ApiResponse.error('File not found on server', []));
    }

    res.setHeader('Content-Disposition', 'inline; filename="' + file.original_name + '"');
    res.setHeader('Content-Type', file.mime_type);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

module.exports = { servePackageFile };
