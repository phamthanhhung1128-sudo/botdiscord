/**
 * src/config/version.js
 * ---------------------------------------------------------------------------
 * Phiên bản ứng dụng đọc trực tiếp từ package.json (1 nguồn sự thật).
 */
'use strict';

const pkg = require('../../package.json');

module.exports = {
  version: pkg.version,
  name: pkg.name,
  node: process.version,
};
