# 🏗 Kiến trúc dự án — Lá Đu Đủ Community

Tài liệu này giải thích **vì sao** dự án được tổ chức như hiện tại, không chỉ
liệt kê file. Mục tiêu: một người mới join vẫn đọc hiểu và sửa được trong 30 phút.

---

## 1. Nguyên tắc thiết kế

| # | Nguyên tắc | Cách thể hiện trong code |
| --- | --- | --- |
| 1 | **Một trách nhiệm mỗi file** | `app.js` chỉ ráp middleware; DB nằm trong `src/db`; validate trong `config/env.js` |
| 2 | **Fail fast** | Sai `.env` → process dừng ngay kèm thông báo tiếng Việt |
| 3 | **Không phụ thuộc nặng** | Tổng chỉ 11 dependency; không ORM, không bundler |
| 4 | **Test được từ đầu** | `app.js` tách khỏi `server.js` → supertest import trực tiếp |
| 5 | **An toàn mặc định** | CSP, CSRF, session `httpOnly`, prepared statement |
| 6 | **60fps trước, hiệu ứng sau** | Chỉ animate `transform`/`opacity`; không `window.onscroll` |

---

## 2. Luồng xử lý một request

```
HTTP request
   │
   ├─ trust proxy (IP thật khi sau Nginx)
   ├─ cspNonce        → sinh nonce cho <script>
   ├─ helmet          → CSP + header bảo mật
   ├─ compression     → gzip/brotli (bỏ qua ảnh)
   ├─ static          → /css /js /img /fonts /uploads (cache 7 ngày ở prod)
   ├─ urlencoded/json → giới hạn 1MB
   ├─ methodOverride  → POST + _method=DELETE
   ├─ session         → đọc từ SQLite (bảng sessions)
   ├─ flash           → thông báo 1 lần
   ├─ csrf            → kiểm tra token với POST/PUT/PATCH/DELETE
   ├─ attachUser      → req.user + res.locals.currentUser
   ├─ viewLocals      → app, navItems, fmt.*, isActive()
   ├─ rate limit      → 300 req / 15 phút / IP
   ├─ routes          → src/routes/index.js
   ├─ notFound        → 404 (JSON nếu /api/*)
   └─ errorHandler    → log server-side, không lộ stack ở prod
```

Thứ tự này quan trọng: **session phải trước flash/CSRF/attachUser**, và
**error handler luôn cuối cùng**.

---

## 3. Vì sao chọn các công nghệ này?

### 3.1 SQLite qua `node:sqlite` (thay vì MySQL/Postgres/`better-sqlite3`)

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| MySQL/Postgres | Mạnh, nhiều tính năng | Người mới phải cài server, tạo user, cấu hình |
| `better-sqlite3` | API đẹp, phổ biến | Phải biên dịch native (cần Python/Build Tools) |
| **`node:sqlite`** ✅ | Có sẵn trong Node, 0 native build, API đồng bộ | Còn gắn nhãn *experimental* |

Với dự án cộng đồng nhỏ–vừa, SQLite dư sức chịu tải (hàng nghìn request/giây khi
bật WAL). Toàn bộ truy vấn đi qua `src/db/index.js` nên **khi cần chuyển sang
Postgres, chỉ phải sửa 1 file**.

> ⚠️ Node in cảnh báo `ExperimentalWarning: SQLite...` khi khởi động. Đây là
> bình thường. Muốn ẩn: `NODE_NO_WARNINGS=1 npm start`.

### 3.2 Session store tự viết

`express-session` mặc định dùng `MemoryStore` — rò rỉ bộ nhớ và mất session khi
restart. Các store có sẵn trên npm đều kéo thêm dependency hoặc yêu cầu
`better-sqlite3`. Interface của store chỉ có 4 method (`get/set/destroy/touch`)
nên tự viết ~100 dòng là hợp lý, kèm luôn tính năng dọn session hết hạn định kỳ
(`setInterval(...).unref()` để không giữ process sống).

### 3.3 Migration engine tự viết

Yêu cầu: chạy đúng thứ tự, trong transaction, biết cái nào đã chạy.
Thêm **checksum SHA-256** để phát hiện ai đó sửa migration cũ — lỗi rất hay gặp
khi làm việc nhóm. Tổng cộng ~150 dòng, không cần `knex`/`umzug`.

### 3.4 EJS + partials (không dùng layout engine)

EJS thuần với `include()` cho phép kiểm soát chính xác từng trang nạp CSS/JS nào
(quan trọng cho hiệu năng ở Giai đoạn 2). Không dùng `express-ejs-layouts` để
tránh "magic" khó debug.

Bốn partial bắt buộc theo yêu cầu dự án:

```
partials/head.ejs    → <head>, meta, CSS, mở <body>
partials/navbar.ejs  → thanh điều hướng + auth
partials/flash.ejs   → thông báo 1 lần
partials/footer.ejs  → chân trang + script defer + đóng </body>
```

---

## 4. Mô hình dữ liệu (22 bảng)

```
users ─┬─< posts ─< comments
       │        └─< post_likes
       ├─< user_cosmetics >─ cosmetics
       ├─< orders >─ shop_items
       ├─< chat_messages >─ chat_rooms
       ├─< dm_messages >─ dm_threads
       ├─< presence            (1–1)
       ├─< conduct_records
       ├─< study_resources
       ├─< media_links
       └─< audit_logs

guild_settings, guild_warnings   ← phía Bot Discord
sessions, schema_migrations      ← hạ tầng
```

**Chi tiết quan trọng**

| Bảng | Ghi chú thiết kế |
| --- | --- |
| `users` | `role` có CHECK 3 mức; `status` cho phép ban/mute; `coins`/`xp`/`level` phục vụ gamification |
| `sessions` | có `user_id` → xoá mọi session khi ban user hoặc đổi mật khẩu |
| `dm_threads` | luôn lưu `user_low_id < user_high_id` → 1 cặp chỉ có 1 thread, chặn trùng bằng UNIQUE + CHECK |
| `conduct_records` | lưu điểm từng tiêu chí + `total_score` + `rating` (snapshot lịch sử, không tính lại khi đổi thang điểm) |
| `conduct_criteria` | thang điểm nằm trong DB → admin đổi được mà không sửa code |
| `presence` | 1 dòng/user, có `current_page` để hiện "đang xem trang X" |
| `media_links` | `provider` có CHECK; `status` cho duyệt nội dung |
| view `v_users_public` | **không chứa** `password_hash`/`email` → dùng cho mọi truy vấn công khai |

---

## 5. Quy ước code

```
src/config/     cấu hình, không chứa logic nghiệp vụ
src/db/         chỉ truy vấn, không render
src/middleware/ hàm (req,res,next), không truy vấn phức tạp
src/routes/     mỏng: validate → gọi service/repo → render
src/services/   logic nghiệp vụ thuần (dễ unit test)
src/utils/      hàm tiện ích không phụ thuộc Express
```

- **CommonJS**, 2 space, luôn có `'use strict';`
- Comment tiếng Việt cho **lý do**, tiếng Anh cho **tên biến/hàm**
- Truy vấn SQL: luôn `?` tham số hoá, không nối chuỗi
- Mọi lỗi đi qua `HttpError` + `asyncHandler`

---

## 6. Hiệu năng (áp dụng từ Giai đoạn 2)

| Kỹ thuật | Lý do |
| --- | --- |
| Chỉ animate `transform`, `opacity` | Chạy trên GPU, không reflow/repaint |
| `will-change: transform` có kiểm soát | Tránh tạo quá nhiều layer |
| `IntersectionObserver` | Không gắn listener vào `scroll` (gây jank) |
| `content-visibility: auto` cho section dài | Bỏ qua render phần ngoài màn hình |
| `defer` cho mọi script | Không chặn parse HTML |
| `loading="lazy"` + `width`/`height` cho ảnh | Chống nhảy bố cục (CLS) |
| CSS tách module theo trang | File nhỏ, cache độc lập |
| `@media (prefers-reduced-motion: reduce)` | Tôn trọng người dùng, hỗ trợ máy yếu |
| `@media (hover: hover)` | Tách hiệu ứng chuột khỏi màn hình cảm ứng |

**Ngân sách hiệu năng mục tiêu:** LCP < 1.5s · CLS < 0.05 · JS < 60KB (nén) ·
không quá 1 font family.

### Mobile

- Không bao giờ tràn ngang: `overflow-x: hidden` + `min-width: 0` cho grid item
- Vùng chạm tối thiểu **44×44px** (`--tap`)
- Font ≥ 16px cho input (tránh iOS tự zoom)
- Bàn phím: `:focus-visible` rõ ràng, `skip-link`, đóng menu bằng `Escape`

---

## 7. Ghi chú triển khai

- **Graceful shutdown:** SIGINT/SIGTERM → `server.close()` → `db.closeDb()` (có
  `wal_checkpoint`) → `process.exit(0)`. Timeout cứng 10s.
- **Backup:** trước mỗi lần migrate bằng CLI, DB được copy sang `data/backups/`,
  giữ `DB_BACKUP_KEEP` bản gần nhất.
- **Web + bot cùng ghi DB:** `busy_timeout = 5000` và WAL xử lý việc này; nếu
  sau này tải cao, chuyển bot sang gọi HTTP API của web thay vì mở DB riêng.
