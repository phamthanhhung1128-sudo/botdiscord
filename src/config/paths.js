/**
 * src/config/paths.js
 * ---------------------------------------------------------------------------
 * Đường dẫn tuyệt đối dùng trong toàn bộ app.
 * Tập trung một chỗ để không phải rải `path.join(__dirname, '../../..')`
 * khắp nơi (rất dễ sai khi refactor thư mục).
 */
'use strict';

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  ROOT,
  SRC: path.join(ROOT, 'src'),
  VIEWS: path.join(ROOT, 'src', 'views'),
  PUBLIC: path.join(ROOT, 'public'),
  DATA: path.join(ROOT, 'data'),
  UPLOADS: path.join(ROOT, 'public', 'uploads'),
  MIGRATIONS: path.join(ROOT, 'src', 'db', 'migrations'),
  LOCALES: path.join(ROOT, 'src', 'locales'),
  BOT: path.join(ROOT, 'bot'),
  ENV_FILE: path.join(ROOT, '.env'),
};
