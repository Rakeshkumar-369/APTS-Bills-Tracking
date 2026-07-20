// src/utils/logger.js
const winston = require('winston');
const path = require('path');
const config = require('../config');

/**
 * Lean Production Logger
 * 1. No JSON blobs - Simple Text only.
 * 2. No audit files - Standard file transports.
 * 3. Split: access.log (traffic/info) & error.log (stacks).
 * 4. Silent Console in production.
 */

// Simple Text Format: [Date] LEVEL: Message (and Stack if available)
const leanFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Ensures we capture the stack trace
    winston.format.printf(({ timestamp, level, message, stack }) => {
        const logMessage = stack || message;
        return `[${timestamp}] ${level.toUpperCase()}: ${logMessage}`;
    })
);

const logger = winston.createLogger({
    // Global level: 'debug' in dev (show everything), 'info' in prod (hide trace/debug)
    level: config.env === 'development' ? 'debug' : 'info',
    format: leanFormat,
    transports: [
        // 1. Error Log: Dedicated for actual failures and stacks
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error'
        }),
        // 2. Access Log: Captures HTTP requests and general app info
        new winston.transports.File({
            filename: path.join('logs', 'access.log')
        })
    ]
});

// 3. Console Output: 
// ONLY add console transport if we're NOT in production
if (config.env !== 'production') {
    logger.add(new winston.transports.Console({
        level: 'debug',
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Morgan Stream: Routes HTTP logs specifically to the logger
logger.stream = {
    write: (message) => logger.info(message.trim())
};

module.exports = logger;
