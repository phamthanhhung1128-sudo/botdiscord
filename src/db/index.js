/**
 * src/db/index.js
 * ---------------------------------------------------------------------------
 * Điểm truy cập DUY NHẤT tới database cho toàn bộ app.
 *
 *   const db = require('../db');
 *   db.get('SELECT * FROM users WHERE id = ?', [1]);
 *   db.all('SELECT * FROM posts LIMIT 10');
 *   db.run('UPDATE users SET coins = coins + ? WHERE id = ?', [10, 1]);
 *   db.tx(() => { ...nhiều lệnh ghi... });
 *
 * Tất cả đều ĐỒNG BỘ (SQLite rất nhanh, và Express handler vẫn là async).
 */
'use strict';

const { openDatabase } = require('./driver');
const env = require('../config/env');
const log = require('../utils/logger').scope('db');

let instance = null;

/** Lấy kết nối hiện có, hoặc mở mới nếu chưa có (lazy singleton). */
function getDb() {
  if (!instance) {
    instance = openDatabase(env.DATABASE_PATH);
    log.debug(`Đã mở database: ${env.DATABASE_PATH}`);
  }
  return instance;
}

/** Đóng kết nối (dùng khi shutdown hoặc trong test). */
function closeDb() {
  if (instance) {
    try {
      // WAL checkpoint để file .db gọn gàng trước khi đóng.
      instance.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      /* bỏ qua: DB có thể đang ở :memory: */
    }
    instance.close();
    instance = null;
    log.debug('Đã đóng database.');
  }
}

/** Trả về 1 dòng hoặc undefined. */
function get(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

/** Trả về mảng các dòng. */
function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

/** Chạy INSERT/UPDATE/DELETE → trả về { changes, lastInsertRowid }. */
function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

/** Chạy nhiều câu lệnh SQL (không tham số). */
function exec(sql) {
  return getDb().exec(sql);
}

/**
 * Chạy một khối lệnh trong transaction.
 * Nếu `fn` ném lỗi → ROLLBACK toàn bộ, giữ dữ liệu nhất quán.
 * Hỗ trợ lồng nhau nhờ SAVEPOINT.
 */
let depth = 0;
function tx(fn) {
  const db = getDb();
  const savepoint = `sp_${depth}`;

  if (depth === 0) db.exec('BEGIN IMMEDIATE');
  else db.exec(`SAVEPOINT ${savepoint}`);

  depth += 1;
  try {
    const result = fn();
    depth -= 1;
    if (depth === 0) db.exec('COMMIT');
    else db.exec(`RELEASE ${savepoint}`);
    return result;
  } catch (err) {
    depth -= 1;
    if (depth === 0) db.exec('ROLLBACK');
    else db.exec(`ROLLBACK TO ${savepoint}`);
    throw err;
  }
}

/** Thông tin nhanh về DB (dùng cho trang trạng thái / health check). */
function stats() {
  const db = getDb();
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map((r) => r.name);

  const fileSize =
    env.DATABASE_PATH === ':memory:'
      ? 0
      : (() => {
          try {
            return require('node:fs').statSync(env.DATABASE_PATH).size;
          } catch {
            return 0;
          }
        })();

  return {
    file: env.DATABASE_PATH,
    engine: 'sqlite (node:sqlite)',
    tables,
    tableCount: tables.length,
    fileSizeBytes: fileSize,
    journalMode: db.prepare('PRAGMA journal_mode').get()?.journal_mode,
  };
}

module.exports = { getDb, closeDb, get, all, run, exec, tx, stats };
