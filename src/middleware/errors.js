/**
 * src/middleware/errors.js
 * ---------------------------------------------------------------------------
 * Xử lý 404 và lỗi tập trung.
 *
 * Nguyên tắc bảo mật: KHÔNG bao giờ trả stack trace cho người dùng ở
 * production (chỉ log server-side). Ở dev thì hiện để dễ debug.
 */
'use strict';

const env = require('../config/env');
const log = require('../utils/logger').scope('http');

/** Lỗi HTTP có mã trạng thái tuỳ chọn. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/** Bọc route handler async để tự động bắt lỗi (không cần try/catch mọi nơi). */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** 404 — không khớp route nào. */
function notFound(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Không tìm thấy endpoint.' });
  }
  res.status(404).render('errors/404', {
    title: 'Không tìm thấy trang',
    path: req.originalUrl,
  });
}

/** Error handler 4 tham số (Express nhận diện qua arity). */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  // Log: lỗi 5xx là lỗi thật, 4xx chỉ là thao tác sai của người dùng.
  if (status >= 500) {
    log.error(`${req.method} ${req.originalUrl} → ${status}`, err.stack || err.message);
  } else {
    log.debug(`${req.method} ${req.originalUrl} → ${status} (${err.message})`);
  }

  const payload = {
    ok: false,
    error: status >= 500 && env.isProd ? 'Đã có lỗi xảy ra, vui lòng thử lại sau.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  };

  if (req.path.startsWith('/api/')) {
    return res.status(status).json(payload);
  }

  res.status(status);
  return res.render(`errors/${status === 404 ? '404' : status === 403 ? '403' : '500'}`, {
    title: status >= 500 ? 'Lỗi hệ thống' : 'Có lỗi xảy ra',
    message: payload.error,
    stack: env.isProd ? null : err.stack,
  });
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
