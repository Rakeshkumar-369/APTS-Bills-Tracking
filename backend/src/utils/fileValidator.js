// src/utils/fileValidator.js
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

// Whitelists
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Validate file extension
 */
function validateExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  return ext;
}

/**
 * Validate file size
 */
function validateSize(size) {
  if (size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Max size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }
  if (size === 0) {
    throw new Error('File is empty');
  }
}

/**
 * Validate image magic bytes using sharp (from buffer)
 */
async function validateImageMagicBytes(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.format !== 'jpeg' && metadata.format !== 'png' && metadata.format !== 'webp') {
      throw new Error('Invalid image format');
    }
    return true;
  } catch (error) {
    throw new Error('Invalid image file or corrupted');
  }
}

/**
 * Validate PDF using header check (first 4 bytes must be '%PDF')
 */
async function validatePDFMagicBytes(buffer) {
  const header = buffer.toString('ascii', 0, 4);
  if (header !== '%PDF') {
    throw new Error('Invalid PDF file: missing PDF header');
  }
  // Optional: check for %%EOF at the end (last 5 bytes)
  // const footer = buffer.toString('ascii', buffer.length - 5, buffer.length);
  // if (footer !== '%%EOF') {
  //   throw new Error('Invalid PDF file: missing EOF marker');
  // }
  return true;
}

/**
 * Strip metadata from images using sharp (from buffer, save to file)
 */
async function stripImageMetadata(buffer, outputPath) {
  try {
    await sharp(buffer)
      .withMetadata(false) // Remove metadata
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.warn('Metadata stripping failed:', error.message);
    // If stripping fails, save original buffer
    await fs.writeFile(outputPath, buffer);
    return false;
  }
}

/**
 * Main file validation function (works with buffer)
 */
async function validateFileBuffer(file) {
  if (!file || !file.buffer) {
    throw new Error('No file provided');
  }

  // Validate size
  validateSize(file.size);

  // Validate extension
  const ext = validateExtension(file.originalname);
  
  // Validate magic bytes based on file type
  if (ext === '.pdf') {
    await validatePDFMagicBytes(file.buffer);
  } else {
    await validateImageMagicBytes(file.buffer);
  }

  // Sanitize filename
  const safeName = sanitizeFilename(file.originalname);
  
  return {
    isValid: true,
    extension: ext,
    safeName: safeName,
    originalName: file.originalname,
    size: file.size
  };
}

/**
 * Process file from buffer (validate and save to final location)
 */
async function processFileBuffer(file, targetPath) {
  // Validate file first
  const validation = await validateFileBuffer(file);
  
  // Create directory if needed
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });
  
  // Strip metadata if it's an image
  const ext = validation.extension;
  if (ext !== '.pdf') {
    await stripImageMetadata(file.buffer, targetPath);
  } else {
    // For PDFs, just save the buffer
    await fs.writeFile(targetPath, file.buffer);
  }
  
  return validation;
}

module.exports = {
  validateFileBuffer,
  processFileBuffer,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS
};