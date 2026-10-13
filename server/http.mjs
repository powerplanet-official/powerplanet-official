import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';

export function apiHeaders(req, res, next) {
  // Correlate browser failures with origin logs, without logging customer data.
  const requestId = randomUUID();
  res.set('X-Request-Id', requestId);
  res.set('X-Powerplanet-API', '1');
  // JSON endpoints also exist on the separate API host. Product photos and the
  // public logo must remain indexable for image search and structured data.
  if (!/^\/(?:api\/)?(?:product-images\/|branding\/logo$)/.test(req.path)) {
    res.set('X-Robots-Tag', 'noindex');
  }
  // Never let shared proxies cache authentication, orders or error responses.
  res.set('Cache-Control', 'no-store');
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      console.error(JSON.stringify({ requestId, method: req.method, status: res.statusCode }));
    }
  });
  next();
}

export function apiRateLimit(options) {
  return rateLimit({
    ...options,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: 'Too many requests. Please try again shortly.',
        code: 'RATE_LIMITED',
        requestId: res.get('X-Request-Id'),
      }),
  });
}
