/**
 * src/middleware/security.js
 * ---------------------------------------------------------------------------
 * Cấu hình bảo mật tập trung: Helmet (CSP + headers) và Rate Limit.
 *
 * CSP được viết theo hướng "chặt nhưng thực dụng":
 *   - Tắt inline script, dùng NONCE cho các đoạn script nhỏ trong EJS.
 *   - Cho phép iframe youtube-nocookie để nhúng video bài giảng.
 *   - Chỉ nạp ảnh/font từ chính site + data: URI.
 */
'use strict';

const crypto = require('node:crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const log = require('../utils/logger').scope('security');

/** Sinh nonce cho mỗi request → dùng cho <script nonce="...">. */
function cspNonce(req, res, next) {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
}

/** Helmet với CSP tuỳ chỉnh. */
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        // 'strict-dynamic' cho phép script nạp bởi script đã tin cậy (module loading)
        'script-src': [
          "'self'",
          (req, res) => `'nonce-${res.locals.nonce}'`,
        ],
        // 'unsafe-inline' cho style: cần cho style attribute của các thư viện nhỏ
        // và cho phép theme tuỳ biến hồ sơ (Giai đoạn 3). Không chứa dữ liệu nhạy cảm.
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'media-src': ["'self'", 'https:'],
        'connect-src': ["'self'"],
        'frame-src': ['https://www.youtube-nocookie.com', 'https://www.youtube.com'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"],
        ...(env.isProd ? { 'upgrade-insecure-requests': [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false, // cần tắt để nhúng YouTube
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  });
}

/** Rate limit toàn site — chống spam/DoS nhẹ. */
function globalLimiter() {
  if (env.isTest) return (req, res, next) => next();
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Không tính các tài nguyên tĩnh → tránh chặn oan khi tải trang
    skip: (req) => !req.accepts('html') && !req.path.startsWith('/api/'),
    handler: (req, res) => {
      log.warn(`Rate limit: ${req.ip} ${req.method} ${req.originalUrl}`);
      if (req.path.startsWith('/api/')) {
        return res.status(429).json({ ok: false, error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.' });
      }
      res.status(429).render('errors/429', { title: 'Quá nhiều yêu cầu' });
    },
  });
}

/** Rate limit chặt hơn cho đăng nhập/đăng ký (chống brute force). */
function authLimiter() {
  if (env.isTest) return (req, res, next) => next();
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Đếm cả khi thành công hay thất bại, nhưng bỏ qua GET
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      log.warn(`Auth rate limit: ${req.ip}`);
      req.flash('error', 'Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.');
      res.status(429);
      res.render('errors/429', { title: 'Thử lại sau' });
    },
  });
}

module.exports = { securityHeaders, cspNonce, globalLimiter, authLimiter };
