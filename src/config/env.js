/**
 * src/config/env.js
 * ---------------------------------------------------------------------------
 * Đọc .env → validate bằng zod → xuất ra object `env` đã chuẩn hoá kiểu.
 *
 * Nguyên tắc: "fail fast". Nếu cấu hình sai, app phải dừng ngay lúc khởi động
 * với thông báo rõ ràng, thay vì lỗi khó hiểu lúc đang chạy.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const paths = require('./paths');

// Chỉ nạp .env nếu tồn tại (production thường set biến môi trường trực tiếp)
if (fs.existsSync(paths.ENV_FILE)) {
  require('dotenv').config({ path: paths.ENV_FILE });
}

const bool = (def) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));

const int = (def, min, max) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number(v)))
    .pipe(z.number().int().min(min).max(max));

const schema = z.object({
  /* ------------------------------ Chung ------------------------------ */
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('Lá Đu Đủ Community'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  PORT: int(3000, 1, 65535),
  HOST: z.string().default('0.0.0.0'),
  // Số hop proxy tin cậy (1 khi chạy sau Nginx/Cloudflare). Rỗng = tin hết.
  TRUST_PROXY: z.string().optional().default('1'),

  /* ---------------------------- Bảo mật ------------------------------ */
  SESSION_SECRET: z.string().min(16).optional(),
  SESSION_MAX_AGE_HOURS: int(168, 1, 24 * 365),
  SESSION_COOKIE_NAME: z.string().default('ladudu.sid'),
  BCRYPT_ROUNDS: int(12, 4, 15),
  RATE_LIMIT_WINDOW_MINUTES: int(15, 1, 1440),
  RATE_LIMIT_MAX: int(300, 10, 100000),
  AUTH_RATE_LIMIT_MAX: int(12, 3, 1000),
  CSRF_ENABLED: bool(true),

  /* ------------------------------ CSDL ------------------------------- */
  DATABASE_FILE: z.string().default('data/app.db'),
  DB_BACKUP_KEEP: int(5, 0, 100),

  /* ----------------------------- Ứng dụng ---------------------------- */
  AUTO_MIGRATE: bool(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  UPLOAD_MAX_MB: int(5, 1, 100),

  /* --------------------------- Tài khoản gốc -------------------------- */
  ADMIN_EMAIL: z.string().email().default('admin@ladudu.local'),
  ADMIN_USERNAME: z.string().min(3).max(32).default('admin'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_DISPLAY_NAME: z.string().default('Quản trị viên'),

  /* ----------------------------- Discord ----------------------------- */
  DISCORD_TOKEN: z.string().optional().default(''),
  DISCORD_CLIENT_ID: z.string().optional().default(''),
  DISCORD_GUILD_ID: z.string().optional().default(''),
  DISCORD_LOG_CHANNEL_ID: z.string().optional().default(''),
  DISCORD_DEFAULT_VOLUME: int(60, 1, 100),

  /* --------------------------- Bot / chung --------------------------- */
  BOT_PREFIX: z.string().default('!'),
  BOT_ACTIVITY: z.string().default('Lá Đu Đủ Community 🍃'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n❌ Cấu hình môi trường không hợp lệ:\n${issues}\n\n` +
    '👉 Hãy copy .env.example thành .env rồi điền lại.\n');
  process.exit(1);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === 'production';

/* ---------------------- Cảnh báo / giá trị dẫn xuất ---------------------- */
if (!raw.SESSION_SECRET) {
  if (isProd) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Thiếu SESSION_SECRET trong môi trường production.\n' +
      '   Tạo khoá ngẫu nhiên:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
    process.exit(1);
  }
}
if (!raw.ADMIN_PASSWORD && !isProd) {
  // eslint-disable-next-line no-console
  console.warn('⚠️  ADMIN_PASSWORD chưa được đặt — sẽ dùng mật khẩu demo "Admin@12345" khi seed.');
}

const env = Object.freeze({
  ...raw,
  isProd,
  isDev: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  // Ở dev/test cho phép secret tạm để không phải cấu hình gì cũng chạy được.
  SESSION_SECRET:
    raw.SESSION_SECRET ||
    'dev-only-insecure-secret-please-change-me-in-env-file-000',
  SESSION_MAX_AGE_MS: raw.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000,
  ADMIN_PASSWORD: raw.ADMIN_PASSWORD || 'Admin@12345',
  DATABASE_PATH:
    raw.DATABASE_FILE === ':memory:'
      ? ':memory:'
      : path.resolve(paths.ROOT, raw.DATABASE_FILE),
  TRUST_PROXY_HOPS: raw.TRUST_PROXY === '' ? true : Number(raw.TRUST_PROXY) || 0,
});

module.exports = env;
