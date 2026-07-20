// src/middleware/securityHeaders.js
const securityHeaders = (req, res, next) => {
    const frontendOrigin = process.env.FRONTEND_ORIGIN;
    const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        `frame-ancestors 'self' ${frontendOrigin}`, // your original rule (keep!)
    ].join('; ');

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
        'geolocation=(), microphone=(), camera=(), fullscreen=(self), payment=()'
    );

    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    res.setHeader('Expect-CT', 'max-age=86400, enforce');

    res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.removeHeader('X-Powered-By');

    next();
};

module.exports = securityHeaders;