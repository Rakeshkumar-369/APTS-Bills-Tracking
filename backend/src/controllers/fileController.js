const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const ApiResponse = require('../utils/ApiResponse');
const claimService = require('../services/claimService');
const { assertCanViewClaim, assertCanViewPO } = require('../utils/accessControl');
const { mimeForStoredFile, contentDisposition } = require('../utils/fileValidator');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

// Streams a stored upload with safe headers. The path is resolved and checked to
// stay inside the uploads directory, and the Content-Type is derived from the
// stored (server-generated) file extension, never from client input.
const sendStoredFile = (res, file) => {
  // Rows written on Windows may contain backslashes — normalise before resolving
  const filePath = path.resolve(__dirname, '../..', String(file.file_path).replace(/\\/g, '/'));
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep) || !fs.existsSync(filePath)) {
    return res.status(404).json(ApiResponse.error('File not found on server', []));
  }

  res.setHeader('Content-Disposition', contentDisposition(file.original_name));
  res.setHeader('Content-Type', mimeForStoredFile(file.stored_name));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Uploaded documents must never run scripts, even if opened directly
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.sendFile(filePath);
};

const serveClaimFile = async (req, res, next) => {
  try {
    const claim = await claimService.getById(req.params.id);
    await assertCanViewClaim(claim, req.user);

    const [rows] = await pool.query(
      'SELECT * FROM claim_files WHERE id = ? AND claim_id = ? AND is_deleted = false',
      [req.params.fileId, req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json(ApiResponse.error('File not found', []));
    }
    sendStoredFile(res, rows[0]);
  } catch (error) {
    next(error);
  }
};

const servePOFile = async (req, res, next) => {
  try {
    await assertCanViewPO(req.params.id, req.user);

    const [rows] = await pool.query(
      'SELECT * FROM po_files WHERE id = ? AND po_id = ? AND is_deleted = false',
      [req.params.fileId, req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json(ApiResponse.error('File not found', []));
    }
    sendStoredFile(res, rows[0]);
  } catch (error) {
    next(error);
  }
};

module.exports = { serveClaimFile, servePOFile };
