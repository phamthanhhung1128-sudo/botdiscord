/**
 * src/app.js
 * ---------------------------------------------------------------------------
 * Khởi tạo Express app. File này KHÔNG gọi listen() → nhờ vậy test
 * (supertest) có thể import app mà không mở cổng thật.
 *
 * Thứ tự middleware rất quan trọng, được ghi chú theo từng khối bên dưới.
 */
'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const methodOverride = require('method-override');

const env = require('./config/env');
const paths = require('./config/paths');
const version = require('./config/version');
const { SqliteSessionStore } = require('./config/sessionStore');

const { securityHeaders, cspNonce, globalLimiter } = require('./middleware/security');
const { csrfProtection } = require('./middleware/csrf');
const flashMiddleware = require('./middleware/flash');
const { attachUser } = require('./middleware/auth');
const { viewLocals } = require('./middleware/viewLocals');
const { notFound, errorHandler } = require('./middleware/errors');

const routes = require('./routes');
const { getDb } = require('./db');
const log = require('./utils/logger').scope('app');

function createApp() {
  const app = express();

  /* ------------------------------------------------------------------ *
   * 1. Tin cậy proxy (Nginx/Cloudflare) — cần để req.ip và cookie https
   *    hoạt động đúng khi deploy thật.
   * ------------------------------------------------------------------ */
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  /* ------------------------------------------------------------------ *
   * 2. View engine: EJS với thư mục partials riêng
   * ------------------------------------------------------------------ */
  app.set('views', paths.VIEWS);
  app.set('view engine', 'ejs');
  app.set('view options', { rmWhitespace: !env.isDev });
  app.enable('view cache'); // EJS cache template đã compile → render nhanh hơn
  app.disable('x-powered-by');

  /* ------------------------------------------------------------------ *
   * 3. Bảo mật header trước khi làm bất cứ việc gì khác
   * ------------------------------------------------------------------ */
  app.use(cspNonce);
  app.use(securityHeaders());

  /* ------------------------------------------------------------------ *
   * 4. Nén response (gzip/brotli) — giảm băng thông CSS/JS/HTML
   * ------------------------------------------------------------------ */
  app.use(
    compression({
      level: 6,
      // Ảnh đã nén sẵn → không nén lại (tốn CPU vô ích)
      filter: (req, res) => {
        if (/\.(png|jpe?g|webp|gif|svg|woff2?|mp4|webm)$/i.test(req.path)) return false;
        return compression.filter(req, res);
      },
    })
  );

  /* ------------------------------------------------------------------ *
   * 5. Tài nguyên tĩnh
   *    - /css, /js, /img, /fonts, /uploads
   *    - Cache 1 năm cho file có hash trong tên (Giai đoạn 2 sẽ bật),
   *      còn hiện tại dùng 7 ngày để tránh cache sai khi dev.
   * ------------------------------------------------------------------ */
  app.use(
    '/uploads',
    express.static(paths.UPLOADS, {
      maxAge: env.isProd ? '7d' : 0,
      index: false,
      dotfiles: 'deny',
    })
  );
  app.use(
    express.static(paths.PUBLIC, {
      maxAge: env.isProd ? '7d' : 0,
      etag: true,
      lastModified: true,
      setHeaders(res, filePath) {
        // Không cho trình duyệt đoán MIME → chặn XSS kiểu "upload ảnh chứa HTML"
        if (/\.(html|htm)$/i.test(filePath)) res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );

  /* ------------------------------------------------------------------ *
   * 6. Parser dữ liệu gửi lên
   *    Giới hạn 1MB để tránh payload khổng lồ làm nghẽn server.
   * ------------------------------------------------------------------ */
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));

  // Hỗ trợ <form method="POST"> + <input name="_method" value="DELETE">
  app.use(methodOverride('_method', { methods: ['POST'] }));

  /* ------------------------------------------------------------------ *
   * 7. Session (lưu trong SQLite) + flash message
   * ------------------------------------------------------------------ */
  const sessionStore = new SqliteSessionStore({
    db: getDb(),
    ttlMs: env.SESSION_MAX_AGE_MS,
  });
  app.locals.sessionStore = sessionStore;
  app.set('sessionCookieName', env.SESSION_COOKIE_NAME);

  app.use(
    session({
      name: env.SESSION_COOKIE_NAME,
      secret: env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false, // không tạo session cho khách vãng lai
      rolling: true, // gia hạn thời gian sống mỗi lần truy cập
      cookie: {
        httpOnly: true, // JS không đọc được → chặn đánh cắp bằng XSS
        sameSite: 'lax', // chặn CSRF cơ bản
        secure: env.isProd, // chỉ gửi qua HTTPS khi production
        maxAge: env.SESSION_MAX_AGE_MS,
        path: '/',
      },
    })
  );

  /* ------------------------------------------------------------------ *
   * 8. Ngữ cảnh request: flash, CSRF, user, biến view
   * ------------------------------------------------------------------ */
  app.use(flashMiddleware);
  app.use(csrfProtection);
  app.use(attachUser);
  app.use(viewLocals);

  /* ------------------------------------------------------------------ *
   * 9. Rate limit toàn site
   * ------------------------------------------------------------------ */
  app.use(globalLimiter());

  /* ------------------------------------------------------------------ *
   * 10. Log request ở môi trường dev (siêu nhẹ, không cần morgan)
   * ------------------------------------------------------------------ */
  if (env.isDev) {
    app.use((req, res, next) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        const color = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug';
        log[color](`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms.toFixed(1)}ms)`);
      });
      next();
    });
  }

  /* ------------------------------------------------------------------ *
   * 11. Routes
   * ------------------------------------------------------------------ */
  app.use('/', routes);

  /* ------------------------------------------------------------------ *
   * 12. 404 + xử lý lỗi (luôn đặt CUỐI CÙNG)
   * ------------------------------------------------------------------ */
  app.use(notFound);
  app.use(errorHandler);

  /* ------------------------------------------------------------------ *
   * 13. Dọn dẹp khi tắt app
   * ------------------------------------------------------------------ */
  app.on('shutdown', () => {
    sessionStore.close();
  });

  log.info(`Express app khởi tạo xong (${version.name} v${version.version}, ${env.NODE_ENV})`);
  return app;
}

module.exports = { createApp };
