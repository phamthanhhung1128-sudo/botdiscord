/**
 * src/config/sessionStore.js
 * ---------------------------------------------------------------------------
 * Session store tuỳ biến lưu trong SQLite (bảng `sessions`).
 *
 * Vì sao không dùng MemoryStore mặc định của express-session?
 *   → Nó rò rỉ bộ nhớ, mất session khi restart và KHÔNG dùng được production.
 * Vì sao tự viết thay vì dùng package ngoài?
 *   → Cần đúng 4 method (get/set/destroy/touch) — khoảng 60 dòng, không cần
 *     thêm dependency, và kiểm soát được cleanup định kỳ.
 */
'use strict';

const { Store } = require('express-session');
const log = require('../utils/logger').scope('session');

class SqliteSessionStore extends Store {
  /**
   * @param {object} options
   * @param {import('node:sqlite').DatabaseSync} options.db  kết nối database
   * @param {number} [options.ttlMs]  thời gian sống mặc định của session
   * @param {number} [options.cleanupIntervalMs]  chu kỳ dọn session hết hạn
   */
  constructor({ db, ttlMs = 7 * 24 * 3600 * 1000, cleanupIntervalMs = 15 * 60 * 1000 }) {
    super();
    this.db = db;
    this.ttlMs = ttlMs;

    this.stmts = {
      get: db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?'),
      upsert: db.prepare(
        `INSERT INTO sessions (sid, user_id, data, expires_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET
           user_id = excluded.user_id, data = excluded.data, expires_at = excluded.expires_at`
      ),
      del: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      touch: db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?'),
      purge: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
      clearUser: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    };

    // Dọn session hết hạn định kỳ. `.unref()` để không giữ process sống.
    this.cleanupTimer = setInterval(() => this.purgeExpired(), cleanupIntervalMs);
    if (typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref();
  }

  /** Tính thời điểm hết hạn (epoch ms) từ cookie của session. */
  #expiresAt(session) {
    const exp = session?.cookie?.expires;
    if (exp) return new Date(exp).getTime();
    const maxAge = session?.cookie?.maxAge ?? this.ttlMs;
    return Date.now() + maxAge;
  }

  get(sid, callback) {
    try {
      const row = this.stmts.get.get(sid);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        this.stmts.del.run(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.data));
    } catch (err) {
      log.error('session.get lỗi:', err.message);
      return callback(err);
    }
  }

  set(sid, session, callback) {
    try {
      this.stmts.upsert.run(
        sid,
        session?.userId ?? null,
        JSON.stringify(session),
        this.#expiresAt(session)
      );
      return callback?.(null);
    } catch (err) {
      log.error('session.set lỗi:', err.message);
      return callback?.(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.stmts.del.run(sid);
      return callback?.(null);
    } catch (err) {
      return callback?.(err);
    }
  }

  touch(sid, session, callback) {
    try {
      this.stmts.touch.run(this.#expiresAt(session), sid);
      return callback?.(null);
    } catch (err) {
      return callback?.(err);
    }
  }

  /** Xoá mọi session của 1 user (dùng khi đổi mật khẩu / ban tài khoản). */
  destroyUserSessions(userId, callback) {
    try {
      this.stmts.clearUser.run(userId);
      return callback?.(null);
    } catch (err) {
      return callback?.(err);
    }
  }

  /** Xoá session đã hết hạn — chạy định kỳ và khi shutdown. */
  purgeExpired() {
    try {
      const info = this.stmts.purge.run(Date.now());
      if (info.changes > 0) log.debug(`Đã dọn ${info.changes} session hết hạn.`);
    } catch (err) {
      log.warn('Không dọn được session hết hạn:', err.message);
    }
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}

module.exports = { SqliteSessionStore };
