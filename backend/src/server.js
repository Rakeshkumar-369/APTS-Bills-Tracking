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
const { apiLimiter } = require('./middleware/rateLimiter');
const ApiResponse = require('./utils/ApiResponse');
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

// Behind Nginx / a load balancer set TRUST_PROXY (e.g. "loopback" or "1") so that
// req.ip — used for rate limiting and audit logs — is the real client address.
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? true : tp);
}

// Middlewares
app.use(securityHeaders);
app.use(cookieParser());
app.disable('x-powered-by');

app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Reject repeated / nested query parameters (?status=a&status=b). Every query
// param this API accepts is a single scalar; arrays would otherwise reach SQL
// builders as lists and cause errors (HTTP parameter pollution).
app.use('/api', (req, res, next) => {
  for (const value of Object.values(req.query || {})) {
    if (typeof value !== 'string') {
      return res.status(400).json(ApiResponse.error('Invalid query parameters', []));
    }
  }
  next();
});

app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/claims', claimRoutes);

app.use('/api/purchase-orders', poRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/inbox', inboxRoutes);

// Unknown API routes → JSON 404 (instead of Express' default HTML page)
app.use('/api', (req, res) => {
  res.status(404).json(ApiResponse.error('Resource not found', []));
});

// --- PRODUCTION SERVING LOGIC ---
if (config.env === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');

  // Fingerprinted build assets never change — let browsers cache them for a year
  app.use('/assets', express.static(path.join(frontendPath, 'assets'), {
    immutable: true,
    maxAge: '365d',
    index: false
  }));
  // Other static files (favicon etc.)
  app.use(express.static(frontendPath, { index: false }));

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