// src/config/index.js
require('dotenv').config();
const fs = require('fs');

const useSSL = process.env.DB_SSL === 'true';

const config = {
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN,
        refreshSecret: process.env.REFRESH_TOKEN_SECRET,
        refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN
    },
    db: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: useSSL
            ? {
                  ca: fs.readFileSync(process.env.DB_SSL_CA_PATH),
                  rejectUnauthorized: true
              }
            : undefined
    },
    cors: {
        origin: process.env.FRONTEND_ORIGIN
    }
};

// Validation
const requiredVars = [
    'NODE_ENV',
    'PORT',
    'HOST',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'REFRESH_TOKEN_SECRET',
    'REFRESH_TOKEN_EXPIRES_IN',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'FRONTEND_ORIGIN'
];

requiredVars.forEach(v => {
    if (!process.env[v]) {
        console.error(`Missing required environment variable: ${v}`);
        process.exit(1);
    }
});

// Additional validation for SSL
if (useSSL && !process.env.DB_SSL_CA_PATH) {
    console.error('DB_SSL is true but DB_SSL_CA_PATH is not set');
    process.exit(1);
}

module.exports = config;