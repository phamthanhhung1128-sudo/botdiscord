/**
 * vitest.config.js
 * ---------------------------------------------------------------------------
 * Cấu hình bộ test. Test chạy trên DB trong RAM (:memory:) nên KHÔNG bao giờ
 * đụng vào data/app.db thật, và mỗi lần chạy đều bắt đầu từ schema sạch.
 */
'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: true, // describe/it/expect dùng trực tiếp (dự án dùng CommonJS)
    // Biến môi trường chỉ áp dụng cho tiến trình test
    env: {
      NODE_ENV: 'test',
      DATABASE_FILE: ':memory:',
      SESSION_SECRET: 'test-secret-test-secret-test-secret-1234',
      LOG_LEVEL: 'silent',
      AUTO_MIGRATE: 'true',
      BCRYPT_ROUNDS: '4', // hash nhanh trong test (không dùng cho production!)
      RATE_LIMIT_MAX: '100000',
    },
    // Mỗi file test chạy trong tiến trình riêng → DB :memory: độc lập
    pool: 'forks',
    reporters: 'default',
  },
});
