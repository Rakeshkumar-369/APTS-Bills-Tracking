// src/services/cleanupService.js
const cron = require('node-cron');
const pool = require('../config/db');
const logger = require('../utils/logger');

/**
 * Data Cleanup Service
 * Automatically purges expired records from the database.
 */

const initCleanupJobs = () => {
    logger.debug('🧹 [CleanupService] Initializing background cleanup jobs...');

    // Run every hour: '0 * * * *'
    cron.schedule('0 * * * *', async () => {
        const startTime = Date.now();

        try {
            // 1. Delete expired refresh tokens
            const [refreshResult] = await pool.query(
                'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
            );

            // 2. Delete expired block records
            const [blockedResult] = await pool.query(
                'DELETE FROM blocked_users WHERE blocked_until < NOW() AND blocked_until IS NOT NULL'
            );

            const duration = Date.now() - startTime;
            logger.debug(`✅ [CleanupService] Cleanup finished in ${duration}ms`);
            logger.debug(`   - Purged ${refreshResult.affectedRows} expired refresh tokens`);
            logger.debug(`   - Purged ${blockedResult.affectedRows} expired block records`);

        } catch (error) {
            logger.error(`❌ [CleanupService] Error during database cleanup: ${error.message}`);
        }
    });

    logger.info('✅ [CleanupService] Hourly cleanup job scheduled');
};

module.exports = { initCleanupJobs };