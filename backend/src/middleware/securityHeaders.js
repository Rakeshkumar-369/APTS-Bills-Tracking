// src/middleware/securityHeaders.js
const csp = [
    "default-src 'self'",
    "script-src 'self'",
    // React sets style attributes through the CSSOM (allowed); 'unsafe-inline'
    // is still required for the few style="" attributes PDF.js injects.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'self' blob:",
    "frame-ancestors 'self'",
    ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : [])
].join('; ');

const securityHeaders = (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=(), fullscreen=(self), payment=(), usb=(), interest-cohort=()'
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Origin-Agent-Cluster', '?1');
    res.removeHeader('X-Powered-By');

    // API responses (and the SPA shell) carry user data — never cache them.
    // Fingerprinted static assets under /assets get long-lived caching in server.js.
    if (!req.path.startsWith('/assets/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    next();
};

module.exports = securityHeaders;
