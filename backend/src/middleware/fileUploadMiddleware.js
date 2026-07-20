// src/middleware/fileUploadMiddleware.js
const multer = require('multer');
const { MAX_FILE_SIZE, ALLOWED_EXTENSIONS } = require('../utils/fileValidator');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: fileFilter
});

const uploadSingleFile = upload.single('file');
const uploadMultipleFiles = upload.array('files', 50);

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Max size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        data: []
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: `Too many files. Max ${uploadMultipleFiles.limits.files || 50} files.`,
        data: []
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
      data: []
    });
  }
  // Handle any other errors (e.g., file filter errors)
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
      data: []
    });
  }
  next(err);
};

module.exports = {
  uploadSingleFile,
  uploadMultipleFiles,
  handleMulterError
};