// src/config/db.js
const mysql = require('mysql2/promise');
const config = require('./index');
const logger = require('../utils/logger');

const pool = mysql.createPool(config.db);

// Test the connection
(async () => {
  try {
    const connection = await pool.getConnection();
    logger.info('✅ MySQL Database connected successfully [db.js]');
    connection.release();
  } catch (error) {
    logger.error(`❌ Database connection failed [db.js]: ${error.message}`);
    process.exit(1); // Exit if DB connection fails, since the app can't function without it   
  }
})();

module.exports = pool;
