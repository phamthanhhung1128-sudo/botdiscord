/**
 * src/db/initDb.js
 * ---------------------------------------------------------------------------
 * Tự khởi tạo database: tạo thư mục data/, mở file, chạy migration.
 *
 * npm run db:init    → tạo DB nếu chưa có + chạy migration còn thiếu
 * npm run db:reset   → XOÁ sạch DB rồi tạo lại (chỉ dùng ở máy dev!)
 *
 * Cũng được gọi tự động lúc server khởi động nếu AUTO_MIGRATE=true.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { openDatabase } = require('./driver');
const { runMigrations } = require('./migrate');
const env = require('../config/env');
const paths = require('../config/paths');
const log = require('../utils/logger').scope('initDb');

/** Xoá file DB + các file phụ của WAL (-wal, -shm). */
function removeDatabaseFiles(dbPath) {
  if (dbPath === ':memory:') return;
  for (const suffix of ['', '-wal', '-shm']) {
    const f = dbPath + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

/**
 * Khởi tạo DB.
 * @param {{ reset?: boolean, silent?: boolean }} options
 */
function initDatabase({ reset = false, silent = false } = {}) {
  const dbPath = env.DATABASE_PATH;

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.mkdirSync(paths.UPLOADS, { recursive: true });
  }

  if (reset) {
    if (env.isProd) {
      throw new Error('Từ chối reset database trong môi trường production!');
    }
    removeDatabaseFiles(dbPath);
    if (!silent) log.warn(`Đã xoá database cũ: ${dbPath}`);
  }

  // Sao lưu phiên bản cũ trước khi migrate (an toàn cho dữ liệu thật)
  if (!reset && env.DB_BACKUP_KEEP > 0 && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    backupDatabase(dbPath, silent);
  }

  const db = openDatabase(dbPath);
  const result = runMigrations(db, { silent });

  if (!silent) {
    const counts = tableCounts(db);
    log.info(`Database sẵn sàng: ${dbPath}`);
    log.info(`Bảng: ${counts.total} • Migration đã chạy: ${result.applied.length}`);
    if (Object.keys(counts.rows).length) {
      log.debug(
        Object.entries(counts.rows)
          .filter(([, n]) => n > 0)
          .map(([t, n]) => `${t}=${n}`)
          .join(' ')
      );
    }
  }

  return { db, ...result };
}

/** Đếm số dòng trong từng bảng (bỏ qua bảng hệ thống). */
function tableCounts(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);

  const rows = {};
  for (const t of tables) {
    try {
      rows[t] = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
    } catch {
      rows[t] = 0;
    }
  }
  return { total: tables.length, rows };
}

/** Giữ lại N bản backup gần nhất, xoá bản cũ nhất. */
function backupDatabase(dbPath, silent) {
  try {
    const dir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(dir, `${path.basename(dbPath, '.db')}-${stamp}.db`);
    fs.copyFileSync(dbPath, target);

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .sort();
    while (files.length > env.DB_BACKUP_KEEP) {
      fs.unlinkSync(path.join(dir, files.shift()));
    }
    if (!silent) log.info(`Đã sao lưu DB → ${path.relative(paths.ROOT, target)}`);
  } catch (err) {
    log.warn(`Không sao lưu được DB: ${err.message}`);
  }
}

/**
 * Chuẩn bị DB cho app đang chạy — DÙNG CHUNG kết nối singleton của src/db.
 *
 * Vì sao không gọi initDatabase() ở đây?
 *   initDatabase() mở một kết nối riêng. Với file .db điều đó chỉ là thừa,
 *   nhưng với ':memory:' thì mỗi kết nối là MỘT database riêng biệt → app sẽ
 *   thấy DB rỗng dù migration "đã chạy". Dùng singleton tránh hoàn toàn lỗi này.
 */
function ensureDatabase() {
  const db = require('./index').getDb();

  if (env.DATABASE_PATH !== ':memory:') {
    fs.mkdirSync(paths.UPLOADS, { recursive: true });
  }
  if (env.AUTO_MIGRATE) runMigrations(db, { silent: true });

  // Bảng session phải tồn tại trước khi express-session khởi tạo store
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions'").get()) {
    throw new Error(
      'Chưa có bảng sessions — hãy chạy "npm run db:init" trước khi khởi động server.'
    );
  }
  return db;
}

module.exports = { initDatabase, ensureDatabase, tableCounts, removeDatabaseFiles };

/* ------------------------------- CLI -------------------------------- */
if (require.main === module) {
  try {
    const { db } = initDatabase({ reset: process.argv.includes('--reset') });
    db.close();
    log.info('✅ Hoàn tất.');
  } catch (err) {
    log.error(err.message);
    process.exitCode = 1;
  }
}
