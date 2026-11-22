/**
 * src/server.js
 * ---------------------------------------------------------------------------
 * Điểm khởi động server.
 *   npm start        → chạy production-like
 *   npm run dev      → chạy với nodemon (tự restart khi sửa code)
 *
 * Trách nhiệm:
 *   1. Chuẩn bị database (tạo file + chạy migration nếu cần).
 *   2. Mở cổng HTTP.
 *   3. Tắt "êm" khi nhận SIGINT/SIGTERM (đóng server + DB, không mất dữ liệu).
 */
'use strict';

const env = require('./config/env');
const log = require('./utils/logger').scope('server');
const { ensureDatabase } = require('./db/initDb');
const db = require('./db');
const { createApp } = require('./app');

/** Mở server. Tách riêng để test có thể gọi mà không tự động chạy. */
async function start({ port = env.PORT, host = env.HOST } = {}) {
  ensureDatabase();

  const app = createApp();
  const server = app.listen(port, host, () => {
    const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
    log.info('─'.repeat(58));
    log.info(`  🍃 ${env.APP_NAME}`);
    log.info(`  Môi trường : ${env.NODE_ENV}`);
    log.info(`  Địa chỉ    : ${url}`);
    log.info(`  Database   : ${env.DATABASE_FILE}`);
    log.info('─'.repeat(58));
  });

  // Timeout chống "slow loris": kết nối treo không được chiếm tài nguyên mãi
  server.headersTimeout = 65_000;
  server.requestTimeout = 60_000;
  server.keepAliveTimeout = 60_000;

  /** Tắt êm: ngừng nhận request mới, đợi request đang chạy, rồi đóng DB. */
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.warn(`Nhận ${signal} — đang tắt server...`);

    const forceExit = setTimeout(() => {
      log.error('Quá 10s không tắt được — buộc dừng.');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async () => {
      try {
        app.emit('shutdown');
        db.closeDb();
        log.info('Đã đóng server và database. Tạm biệt! 👋');
      } catch (err) {
        log.error('Lỗi khi shutdown:', err.message);
      } finally {
        clearTimeout(forceExit);
        process.exit(0);
      }
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Không để 1 lỗi không bắt được làm sập cả app trong im lặng
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection:', reason instanceof Error ? reason.stack : reason);
  });
  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception:', err.stack || err.message);
    shutdown('uncaughtException');
  });

  return { app, server };
}

module.exports = { start };

// Chạy trực tiếp: node src/server.js
if (require.main === module) {
  start().catch((err) => {
    log.error('Không khởi động được server:', err.stack || err.message);
    process.exit(1);
  });
}
