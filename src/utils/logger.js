/**
 * src/utils/logger.js
 * ---------------------------------------------------------------------------
 * Logger siêu nhẹ, không phụ thuộc thư viện ngoài.
 * - Có màu khi chạy trong terminal (tự tắt khi không phải TTY).
 * - Có mức log: debug < info < warn < error.
 * - Có `scope` để biết log phát ra từ module nào: logger.scope('db').
 */
'use strict';

const env = require('../config/env');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const COLORS = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

const threshold = LEVELS[env.LOG_LEVEL] ?? LEVELS.info;
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(color, text) {
  return useColor ? `${COLORS[color]}${text}${COLORS.reset}` : text;
}

function stamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function write(level, scope, args) {
  if (LEVELS[level] < threshold) return;
  const prefix =
    `${paint('dim', stamp())} ` +
    `${paint(level, level.toUpperCase().padEnd(5))} ` +
    `${scope ? paint('bold', `[${scope}]`) + ' ' : ''}`;
  const sink = level === 'error' || level === 'warn' ? console.error : console.log;
  sink(prefix, ...args);
}

function createLogger(scope = '') {
  return {
    debug: (...a) => write('debug', scope, a),
    info: (...a) => write('info', scope, a),
    warn: (...a) => write('warn', scope, a),
    error: (...a) => write('error', scope, a),
    /** Tạo logger con có tiền tố riêng: logger.scope('bot') */
    scope: (child) => createLogger(child),
  };
}

module.exports = createLogger();
