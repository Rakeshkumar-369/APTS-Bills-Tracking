const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const ApiResponse = require('../utils/ApiResponse');

const serveClaimFile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM claim_files WHERE id = ? AND claim_id = ?',
      [req.params.fileId, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json(ApiResponse.error('File not found', []));
    }

    const file = rows[0];
    const filePath = path.join(__dirname, '../..', file.file_path);

    if (!fs.existsSync(filePath)) {
      // Fallback: check old uploads/packages/ path for migrated records
      const oldPath = filePath.replace(/uploads[/\\]claims[/\\]/, 'uploads' + path.sep + 'packages' + path.sep);
      if (fs.existsSync(oldPath)) {
        res.setHeader('Content-Disposition', 'inline; filename="' + file.original_name + '"');
        res.setHeader('Content-Type', file.mime_type);
        return res.sendFile(oldPath);
      }
      return res.status(404).json(ApiResponse.error('File not found on server', []));
    }

    res.setHeader('Content-Disposition', 'inline; filename="' + file.original_name + '"');
    res.setHeader('Content-Type', file.mime_type);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

const servePOFile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM po_files WHERE id = ? AND po_id = ?',
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

module.exports = { serveClaimFile, servePOFile };
