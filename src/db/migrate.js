/**
 * src/db/migrate.js
 * ---------------------------------------------------------------------------
 * Migration engine tí hon (không cần thư viện ngoài).
 *
 * Cách hoạt động:
 *   1. Tạo bảng `schema_migrations` nếu chưa có.
 *   2. Đọc tất cả file trong src/db/migrations, sắp xếp theo tên (001_, 002_...).
 *   3. File nào chưa có trong `schema_migrations` → chạy trong transaction.
 *   4. Ghi lại version + checksum SHA-256.
 *
 * Checksum giúp phát hiện ai đó sửa file migration đã chạy → cảnh báo
 * (vì môi trường thật và máy dev sẽ lệch schema).
 *
 * CLI:
 *   node src/db/migrate.js           → chạy các migration còn thiếu
 *   node src/db/migrate.js --status  → chỉ xem trạng thái
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const paths = require('../config/paths');
const log = require('../utils/logger').scope('migrate');

const MIGRATION_RE = /^(\d{3,})_([a-z0-9_\-]+)\.sql$/i;

function checksum(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** Đảm bảo bảng theo dõi tồn tại. */
function ensureTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      checksum   TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
}

/** Đọc danh sách file migration từ đĩa, đã sắp xếp. */
function listMigrationFiles(dir = paths.MIGRATIONS) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => MIGRATION_RE.test(f))
    .sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)))
    .map((file) => {
      const [, version, name] = file.match(MIGRATION_RE);
      const full = path.join(dir, file);
      const sql = fs.readFileSync(full, 'utf8');
      return { version, name, file, sql, checksum: checksum(sql) };
    });
}

/**
 * Chạy mọi migration còn thiếu.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{ applied: string[], skipped: number, drifted: string[] }}
 */
function runMigrations(db, { dir = paths.MIGRATIONS, silent = false } = {}) {
  ensureTable(db);

  const done = new Map(
    db.prepare('SELECT version, checksum FROM schema_migrations').all().map((r) => [r.version, r.checksum])
  );

  const applied = [];
  const drifted = [];
  let skipped = 0;

  for (const mig of listMigrationFiles(dir)) {
    const prev = done.get(mig.version);

    if (prev) {
      skipped += 1;
      if (prev !== mig.checksum) {
        drifted.push(mig.file);
        if (!silent) {
          log.warn(
            `Migration ${mig.file} đã được sửa sau khi chạy (checksum lệch). ` +
              'KHÔNG sửa migration cũ — hãy tạo migration mới.'
          );
        }
      }
      continue;
    }

    const started = Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(mig.sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)'
      ).run(mig.version, mig.name, mig.checksum);
      db.exec('COMMIT');
      applied.push(mig.file);
      if (!silent) log.info(`✔ ${mig.file} (${Date.now() - started}ms)`);
    } catch (err) {
      db.exec('ROLLBACK');
      log.error(`✘ Lỗi khi chạy ${mig.file}: ${err.message}`);
      throw err;
    }
  }

  if (!silent && !applied.length) log.info(`Không có migration mới (đã có ${skipped} bản ghi).`);

  return { applied, skipped, drifted };
}

/** In trạng thái các migration (đã chạy / chưa chạy). */
function status(db) {
  ensureTable(db);
  const done = new Map(
    db.prepare('SELECT version, applied_at FROM schema_migrations').all().map((r) => [r.version, r.applied_at])
  );
  const rows = listMigrationFiles().map((m) => ({
    file: m.file,
    applied: done.has(m.version),
    appliedAt: done.get(m.version) || null,
  }));
  // eslint-disable-next-line no-console
  console.table(rows);
  return rows;
}

module.exports = { runMigrations, listMigrationFiles, status, ensureTable };

/* ------------------------------- CLI -------------------------------- */
if (require.main === module) {
  const { openDatabase } = require('./driver');
  const env = require('../config/env');

  const db = openDatabase(env.DATABASE_PATH);
  try {
    if (process.argv.includes('--status')) status(db);
    else runMigrations(db);
  } catch (err) {
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
