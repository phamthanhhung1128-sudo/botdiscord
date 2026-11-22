/**
 * tests/smoke.test.js
 * ---------------------------------------------------------------------------
 * Test "khói" (smoke test) cho Giai đoạn 1: xác nhận nền tảng hoạt động.
 *
 *   npm test
 *
 * Bộ test đầy đủ (auth, điểm rèn luyện, media/profile, presence) sẽ được
 * viết ở Giai đoạn 4 theo đúng yêu cầu.
 */
'use strict';

// describe / it / expect / beforeAll / afterAll là global do vitest cung cấp
// (xem `globals: true` trong vitest.config.js) → giữ được code CommonJS.
const request = require('supertest');

let app;
let dbModule;
let server;

beforeAll(() => {
  const { ensureDatabase } = require('../src/db/initDb');
  ensureDatabase(); // database :memory: + chạy migration
  const { createApp } = require('../src/app');
  app = createApp();
  dbModule = require('../src/db');
});

afterAll(() => {
  dbModule?.closeDb();
});

describe('Nền tảng Express', () => {
  it('trả về trang chủ 200 và render HTML tiếng Việt', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Lá Đu Đủ');
  });

  it('thiết lập các header bảo mật quan trọng', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-security-policy']).toBeTruthy();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('GET /health trả JSON healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.database.tables).toBeGreaterThan(10);
  });

  it('trả 404 cho route không tồn tại', async () => {
    const res = await request(app).get('/khong-he-ton-tai');
    expect(res.status).toBe(404);
  });

  it('chặn POST thiếu CSRF token', async () => {
    const res = await request(app).post('/gi-do').type('form').send({ a: 1 });
    expect(res.status).toBe(403);
  });
});

describe('Database & migration', () => {
  it('tạo đủ bảng lõi của schema', () => {
    const tables = dbModule
      .all("SELECT name FROM sqlite_master WHERE type='table'")
      .map((r) => r.name);

    [
      'users',
      'posts',
      'sessions',
      'chat_rooms',
      'chat_messages',
      'dm_threads',
      'dm_messages',
      'presence',
      'conduct_criteria',
      'conduct_records',
      'shop_items',
      'orders',
      'cosmetics',
      'user_cosmetics',
      'media_links',
      'study_resources',
      'schema_migrations',
    ].forEach((t) => expect(tables).toContain(t));
  });

  it('ghi lại migration đã chạy', () => {
    const rows = dbModule.all('SELECT version, checksum FROM schema_migrations');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].checksum).toMatch(/^[a-f0-9]{16}$/);
  });

  it('bật khoá ngoại (foreign_keys = ON)', () => {
    expect(dbModule.get('PRAGMA foreign_keys').foreign_keys).toBe(1);
  });

  it('áp dụng CHECK constraint cho role', () => {
    expect(() =>
      dbModule.run(
        "INSERT INTO users (username, email, password_hash, display_name, role) VALUES ('x','x@x.vn','h','X','superuser')"
      )
    ).toThrow(/CHECK/i);
  });

  it('transaction rollback khi có lỗi', () => {
    const before = dbModule.get('SELECT COUNT(*) c FROM users').c;
    expect(() =>
      dbModule.tx(() => {
        dbModule.run(
          "INSERT INTO users (username, email, password_hash, display_name) VALUES ('t1','t1@x.vn','h','T1')"
        );
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(dbModule.get('SELECT COUNT(*) c FROM users').c).toBe(before);
  });

  it('view v_users_public không lộ password_hash', () => {
    const cols = dbModule.all('PRAGMA table_info(v_users_public)').map((c) => c.name);
    expect(cols).not.toContain('password_hash');
    expect(cols).not.toContain('email');
  });
});
