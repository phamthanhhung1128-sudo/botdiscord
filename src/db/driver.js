/**
 * src/db/driver.js
 * ---------------------------------------------------------------------------
 * Lớp mỏng bọc quanh SQLite của Node (`node:sqlite`, có từ Node 22.5).
 *
 * Vì sao không dùng `better-sqlite3`?
 *   - `node:sqlite` có sẵn trong Node → không cần biên dịch native
 *     (người dùng chỉ cần `npm install`, không cần Python/Visual Studio Build Tools).
 *   - API gần như tương đương better-sqlite3 nên có thể thay thế về sau.
 *
 * Toàn bộ phần còn lại của app KHÔNG import trực tiếp `node:sqlite`
 * mà đi qua `src/db/index.js` → dễ swap driver (Postgres/MySQL) về sau.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/**
 * Mở (hoặc tạo) database SQLite và bật các PRAGMA an toàn/hiệu năng.
 * @param {string} filePath - đường dẫn file .db, hoặc ':memory:' cho test.
 * @returns {DatabaseSync}
 */
function openDatabase(filePath) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const db = new DatabaseSync(filePath);

  // WAL: đọc/ghi song song tốt hơn rất nhiều so với journal mặc định.
  // (Không áp dụng được cho :memory: nhưng lệnh này không lỗi.)
  db.exec('PRAGMA journal_mode = WAL');
  // Khoá ngoại mặc định TẮT trong SQLite → phải bật thủ công mỗi kết nối.
  db.exec('PRAGMA foreign_keys = ON');
  // Ghi nhanh hơn nhưng vẫn an toàn khi mất điện (chỉ mất commit cuối).
  db.exec('PRAGMA synchronous = NORMAL');
  // Chờ tối đa 5s khi file bị khoá bởi tiến trình khác (bot + web cùng chạy).
  db.exec('PRAGMA busy_timeout = 5000');
  // Lưu tạm bảng tạm trong RAM.
  db.exec('PRAGMA temp_store = MEMORY');

  return db;
}

module.exports = { openDatabase };
