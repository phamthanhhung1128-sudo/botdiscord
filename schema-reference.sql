-- ============================================================================
--  LÁ ĐU ĐỦ COMMUNITY — SCHEMA THAM CHIẾU (SQLite)
-- ============================================================================
--  Đây là "bản đồ dữ liệu" đầy đủ của dự án, dùng để:
--    1. Tra cứu nhanh cấu trúc DB khi đọc code.
--    2. Khởi tạo DB bằng tay:  sqlite3 data/app.db < schema-reference.sql
--
--  Nguồn chân lý (source of truth) khi chạy thật là các file trong
--  src/db/migrations/*.sql — mỗi thay đổi cấu trúc phải là một migration mới.
--  File này được cập nhật song song và bộ test (tests/schema.test.js) sẽ
--  cảnh báo nếu danh sách bảng bị lệch nhau.
--
--  Quy ước:
--    - Khoá chính  : INTEGER PRIMARY KEY AUTOINCREMENT
--    - Thời gian   : TEXT ISO-8601 UTC  (vd: 2026-11-22T10:41:00.000Z)
--    - Bật khoá ngoại: PRAGMA foreign_keys = ON (bật trong src/db/driver.js)
--    - Enum         : dùng CHECK (...) thay vì kiểu ENUM của MySQL
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================================
--  0. HỆ THỐNG
-- ============================================================================

-- Theo dõi migration đã chạy (do src/db/migrate.js quản lý)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,          -- '001', '002'...
  name       TEXT NOT NULL,             -- 'initial'
  checksum   TEXT NOT NULL,             -- SHA-256 nội dung file SQL
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Cấu hình theo từng guild Discord (prefix, volume, kênh thông báo...)
CREATE TABLE IF NOT EXISTS guild_settings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (guild_id, key)
);

-- Nhật ký thao tác quản trị (ai làm gì, lúc nào)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,            -- 'post.remove', 'user.promote', 'shop.purchase'...
  target_type TEXT,                     -- 'post' | 'user' | 'media' ...
  target_id   TEXT,
  meta        TEXT,                     -- JSON string
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);

-- ============================================================================
--  1. TÀI KHOẢN & PHÂN QUYỀN
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,                -- 3-32 ký tự [a-z0-9_]
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                       -- bcrypt (12 rounds)
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  bio           TEXT,
  role          TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'moderator', 'admin')),
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'muted', 'banned')),
  coins         INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  xp            INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level         INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  discord_id    TEXT UNIQUE,                         -- liên kết tài khoản Discord
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Session server-side (dùng bởi src/config/sessionStore.js)
CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  expires_at INTEGER NOT NULL              -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);

-- ============================================================================
--  2. CỘNG ĐỒNG — BÀI VIẾT
-- ============================================================================

CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  summary       TEXT,
  body          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('general','question','tutorial','news','showcase','study')),
  cover_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'published'
                CHECK (status IN ('draft','published','removed')),
  view_count    INTEGER NOT NULL DEFAULT 0,
  like_count    INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  is_pinned     INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0,1)),
  published_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_status  ON posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author  ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_cat     ON posts(category);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

-- ============================================================================
--  3. HỒ SƠ & CỬA HÀNG
-- ============================================================================

-- Trang trí hồ sơ: khung avatar, huy hiệu, ảnh bìa, theme
CREATE TABLE IF NOT EXISTS cosmetics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,      -- 'frame-leaf-gold'
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('frame','badge','banner','theme')),
  description TEXT,
  asset_url   TEXT,
  rarity      TEXT NOT NULL DEFAULT 'common'
              CHECK (rarity IN ('common','rare','epic','legendary')),
  price       INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id INTEGER NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  equipped    INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0,1)),
  acquired_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, cosmetic_id)
);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_equipped ON user_cosmetics(user_id, equipped);

-- Vật phẩm cửa hàng (dùng coin)
CREATE TABLE IF NOT EXISTS shop_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'utility'
              CHECK (category IN ('cosmetic','utility','perk','bundle')),
  icon        TEXT,                        -- emoji hoặc URL
  price       INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT -1, -- -1 = không giới hạn
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     INTEGER NOT NULL REFERENCES shop_items(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  INTEGER NOT NULL CHECK (unit_price >= 0),
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  status      TEXT NOT NULL DEFAULT 'paid'
              CHECK (status IN ('pending','paid','cancelled')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

-- ============================================================================
--  4. GIAO TIẾP — CHAT, TIN NHẮN RIÊNG, TRẠNG THÁI ONLINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_rooms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  is_private  INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id, id DESC);

-- Một "thread" = cặp 2 người, luôn lưu user_low_id < user_high_id để không trùng
CREATE TABLE IF NOT EXISTS dm_threads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_low_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_low_id, user_high_id),
  CHECK (user_low_id < user_high_id)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_dm_thread ON dm_messages(thread_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_dm_unread ON dm_messages(thread_id, read_at);

-- Trạng thái online (1 dòng / user, cập nhật từ AJAX hoặc Socket.IO sau này)
CREATE TABLE IF NOT EXISTS presence (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'offline'
               CHECK (status IN ('online','idle','dnd','offline')),
  current_page TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_presence_status ON presence(status, last_seen_at DESC);

-- ============================================================================
--  5. GÓC HỌC TẬP & ĐIỂM RÈN LUYỆN
-- ============================================================================

-- Thang điểm rèn luyện do admin cấu hình (tổng max = 100)
CREATE TABLE IF NOT EXISTS conduct_criteria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,     -- 'academic', 'discipline', ...
  name        TEXT NOT NULL,
  max_score   INTEGER NOT NULL CHECK (max_score > 0),
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

-- Bản ghi điểm rèn luyện theo học kỳ
CREATE TABLE IF NOT EXISTS conduct_records (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  semester       TEXT NOT NULL,          -- 'HK1-2025-2026'
  academic_score INTEGER NOT NULL DEFAULT 0,
  discipline_score INTEGER NOT NULL DEFAULT 0,
  social_score   INTEGER NOT NULL DEFAULT 0,
  community_score INTEGER NOT NULL DEFAULT 0,
  culture_score  INTEGER NOT NULL DEFAULT 0,
  total_score    INTEGER NOT NULL DEFAULT 0,
  rating         TEXT NOT NULL DEFAULT 'unrated'
                 CHECK (rating IN ('unrated','excellent','good','fair','average','weak')),
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, semester)
);
CREATE INDEX IF NOT EXISTS idx_conduct_user ON conduct_records(user_id, created_at DESC);

-- Học liệu / video bài giảng (nhúng không quảng cáo)
CREATE TABLE IF NOT EXISTS study_resources (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  subject       TEXT NOT NULL,           -- 'math' | 'literature' | ...
  kind          TEXT NOT NULL DEFAULT 'video'
                CHECK (kind IN ('video','document','exercise','link')),
  url           TEXT NOT NULL,
  provider      TEXT DEFAULT 'youtube',
  thumbnail_url TEXT,
  description   TEXT,
  is_approved   INTEGER NOT NULL DEFAULT 1 CHECK (is_approved IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_study_subject ON study_resources(subject, created_at DESC);

-- ============================================================================
--  6. MEDIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_links (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'youtube'
                CHECK (provider IN ('youtube','vimeo','soundcloud','image','other')),
  thumbnail_url TEXT,
  tags          TEXT,                    -- CSV: 'toán,python'
  status        TEXT NOT NULL DEFAULT 'published'
                CHECK (status IN ('pending','published','removed')),
  view_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_media_status ON media_links(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_user   ON media_links(user_id);

-- ============================================================================
--  7. BOT DISCORD — CẢNH BÁO THÀNH VIÊN (/canhbao)
-- ============================================================================

CREATE TABLE IF NOT EXISTS guild_warnings (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id             TEXT NOT NULL,
  discord_user_id      TEXT NOT NULL,
  moderator_discord_id TEXT NOT NULL,
  reason               TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_warnings_target ON guild_warnings(guild_id, discord_user_id);

-- ============================================================================
--  8. VIEW TIỆN DỤNG
-- ============================================================================

-- Hồ sơ công khai: không bao giờ lộ password_hash / email
CREATE VIEW IF NOT EXISTS v_users_public AS
SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.role,
       u.coins, u.xp, u.level, u.created_at,
       COALESCE(p.status, 'offline') AS presence_status,
       p.last_seen_at
FROM users u
LEFT JOIN presence p ON p.user_id = u.id;

-- Điểm rèn luyện mới nhất của từng user
CREATE VIEW IF NOT EXISTS v_latest_conduct AS
SELECT c.*
FROM conduct_records c
JOIN (
  SELECT user_id, MAX(created_at) AS mx
  FROM conduct_records GROUP BY user_id
) t ON t.user_id = c.user_id AND t.mx = c.created_at;
