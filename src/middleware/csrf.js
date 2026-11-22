/**
 * src/middleware/csrf.js
 * ---------------------------------------------------------------------------
 * Bảo vệ CSRF kiểu "synchronizer token" — tự viết, không cần package.
 *
 * Cách hoạt động:
 *   1. Mỗi session có 1 token ngẫu nhiên (32 byte).
 *   2. Token được nhúng vào form qua <input type="hidden" name="_csrf">
 *      (hoặc header X-CSRF-Token cho fetch/AJAX).
 *   3. Với mọi request ghi (POST/PUT/PATCH/DELETE) token phải khớp.
 *
 * So sánh bằng `timingSafeEqual` để tránh timing attack.
 */
'use strict';

const crypto = require('node:crypto');
const env = require('../config/env');
const { HttpError } = require('./errors');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FIELD_NAME = '_csrf';
const HEADER_NAME = 'x-csrf-token';

/** Lấy (hoặc tạo mới) token CSRF cho session hiện tại. */
function getToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/** So sánh 2 chuỗi an toàn về thời gian. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Middleware chính.
 * Gắn `res.locals.csrfToken` cho view và kiểm tra token khi ghi dữ liệu.
 */
function csrfProtection(req, res, next) {
  const token = getToken(req);
  res.locals.csrfToken = token;
  res.locals.csrfField = FIELD_NAME;

  // Tắt qua .env (dùng khi chạy test API bằng công cụ ngoài)
  if (!env.CSRF_ENABLED || SAFE_METHODS.has(req.method)) return next();

  // API dùng Bearer/không session thì bỏ qua (Giai đoạn 4 sẽ thêm API key)
  if (!req.session) return next();

  const sent = req.body?.[FIELD_NAME] || req.get(HEADER_NAME) || '';
  if (safeEqual(sent, token)) return next();

  return next(
    new HttpError(403, 'Phiên làm việc đã hết hạn hoặc không hợp lệ (CSRF). Vui lòng tải lại trang.')
  );
}

module.exports = { csrfProtection, getToken, FIELD_NAME, HEADER_NAME };
