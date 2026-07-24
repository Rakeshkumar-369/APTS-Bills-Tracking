// src/server.js
const config = require('./config'); // Load config hub
const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const securityHeaders = require('./middleware/securityHeaders');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const logger = require('./utils/logger');
const fs = require('fs');

// Routes
const authRoutes = require('./routes/authRoutes');
const workflowRoutes = require('./routes/workflowRoutes');
const userRoutes = require('./routes/userRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const projectRoutes = require('./routes/projectRoutes');
const claimRoutes = require('./routes/claimRoutes');
const poRoutes = require('./routes/poRoutes');
const roleRoutes = require('./routes/roleRoutes');
const inboxRoutes = require('./routes/inboxRoutes');

// Error Handler
const errorHandler = require('./middleware/errorMiddleware');
const { initCleanupJobs } = require('./services/cleanupService');

const app = express();

// Request ID (before everything else) ======
app.use((req, res, next) => {
  req.id = require('crypto').randomUUID();
  next();
});

// 1. Performance: HTTP Response Compression
app.use(compression());

// Hybrid Logging
if (config.env === 'production') {
  app.use(morgan('combined', { stream: logger.stream }));
} else {
  app.use(morgan('dev'));
}

// Initialize Background Tasks
initCleanupJobs();

// Ensure uploads directories exist
const uploadsClaimDir = path.join(__dirname, '..', 'uploads', 'claims');
fs.mkdirSync(uploadsClaimDir, { recursive: true });
const uploadsPODir = path.join(__dirname, '..', 'uploads', 'purchase-orders');
fs.mkdirSync(uploadsPODir, { recursive: true });

// app.set('trust proxy', 'loopback'); // Uncomment if behind a proxy like Nginx

// Middlewares
app.use(securityHeaders);
app.use(cookieParser());
app.disable('x-powered-by');

app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/claims', claimRoutes);

// Backward compatibility: serve the same claim routes under /api/packages
// so the frontend continues working until it's updated
app.use('/api/packages', claimRoutes);

app.use('/api/purchase-orders', poRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/inbox', inboxRoutes);

// --- PRODUCTION SERVING LOGIC ---
if (config.env === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');

  // Serve static assets (js, css, images)
  app.use(express.static(frontendPath));

  // Catch-All: Support React Router by serving index.html for any non-API route
  app.get('/*anythinghereexceptspaceandnothing', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// 3. ERROR HANDLING MIDDLEWARE (Must be after routes)
app.use(errorHandler);

const PORT = config.port;
const HOST = config.host;

// Start server
const server = app.listen(PORT, HOST, () => {
  logger.info(`Server running on ${HOST}:${PORT}`);
  // Also log the network URL
  if (HOST === '0.0.0.0') {
    const networkInterfaces = require('os').networkInterfaces();
    Object.keys(networkInterfaces).forEach((interfaceName) => {
      networkInterfaces[interfaceName].forEach((interface) => {
        if (interface.family === 'IPv4' && !interface.internal) {
          logger.info(`Network access: http://${interface.address}:${PORT}`);
        }
      });
    });
  }
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}\n${err.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}\n${err.stack}`);
  server.close(() => process.exit(1));
});