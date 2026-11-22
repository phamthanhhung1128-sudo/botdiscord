# 🍃 Lá Đu Đủ Community

Nền tảng web cộng đồng **mã nguồn mở** tích hợp **Bot Discord** — xây dựng bằng
**Node.js + Express + EJS + SQL + Discord.js**. Giao diện tiếng Việt, tối ưu cho
cả điện thoại và máy tính, hiệu ứng mượt 60fps.

> **Trạng thái:** đang phát triển theo 4 giai đoạn — hiện hoàn tất **Giai đoạn 1
> (Nền tảng)**. Xem [lộ trình](#-lộ-trình-phát-triển) bên dưới.

---

## 📚 Mục lục

- [Tính năng](#-tính-năng)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt nhanh](#-cài-đặt-nhanh-5-bước)
- [Các lệnh npm](#-các-lệnh-npm)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Biến môi trường](#-biến-môi-trường)
- [Database & migration](#-database--migration)
- [Bảo mật](#-bảo-mật)
- [Kiểm thử](#-kiểm-thử)
- [Triển khai production](#-triển-khai-production)
- [Lộ trình phát triển](#-lộ-trình-phát-triển)
- [Đóng góp](#-đóng-góp)

---

## ✨ Tính năng

| Nhóm | Chức năng | Trạng thái |
| --- | --- | --- |
| **Tài khoản** | Đăng ký, đăng nhập, phân quyền Admin/Moderator, thăng cấp admin | Giai đoạn 3 |
| **Cộng đồng** | Trang chủ, tạo/xem/sửa bài viết, bình luận, like | Giai đoạn 3 |
| **Hồ sơ & Shop** | Trang cá nhân, trang trí hồ sơ (khung/huy hiệu/bìa), cửa hàng | Giai đoạn 3 |
| **Giao tiếp** | Phòng chat, tin nhắn riêng, theo dõi online (presence) | Giai đoạn 3 |
| **Học tập** | Học liệu/video không quảng cáo, tính & theo dõi điểm rèn luyện | Giai đoạn 3 |
| **Media** | Quản lý và phát liên kết media (YouTube, Vimeo...) | Giai đoạn 3 |
| **Bot Discord** | `/clear`, `/avatar`, `/profile`, `/kick`, `/afk`, `/help`, `/warn` | ✅ Cơ bản |
| **Hiệu ứng** | Chuyển trang mượt, micro-interaction, scroll reveal 60fps | Giai đoạn 2 |
| **Nền tảng** | Express + EJS, SQL + migration, session, CSP, CSRF, rate limit | ✅ **Xong** |

**Đã có ngay bây giờ (Giai đoạn 1):**

- ✅ Express app hoàn chỉnh: EJS partials, nén gzip/brotli, static cache, graceful shutdown
- ✅ Schema SQL **22 bảng + 2 view + 21 index** với CHECK constraint & khoá ngoại
- ✅ Migration engine tự viết (có checksum, transaction, CLI `--status`)
- ✅ `initDb.js` tự tạo DB, tự sao lưu trước khi migrate
- ✅ Session lưu SQLite + flash message + CSRF + rate limit + CSP nonce
- ✅ Middleware xác thực: `attachUser`, `requireAuth`, `requireAdmin`, `requireModerator`
- ✅ Health check `/health` (JSON) và `/health/page` (HTML)
- ✅ Bộ test khói 11 test + tài liệu kiến trúc

---

## 💻 Yêu cầu hệ thống

| Thành phần | Yêu cầu | Ghi chú |
| --- | --- | --- |
| **Node.js** | **≥ 22.5.0** | Cần `node:sqlite` có sẵn trong Node |
| npm | ≥ 9 | đi kèm Node |
| RAM | ≥ 256 MB | rất nhẹ |
| Database | **không cần cài** | SQLite là file, đi kèm Node |

> ⚠️ **Không cần** Python, Visual Studio Build Tools hay MySQL/PostgreSQL.
> Dự án cố tình chọn `node:sqlite` để `npm install` chạy được ở mọi máy.

Kiểm tra phiên bản:

```bash
node -v   # phải >= v22.5.0
```

---

## 🚀 Cài đặt nhanh (5 bước)

```bash
# 1. Lấy mã nguồn
git clone https://github.com/phamthanhhung1128-sudo/botdiscord.git
cd botdiscord

# 2. Cài dependencies
npm install

# 3. Tạo file cấu hình
cp .env.example .env

# 4. Tạo database + dữ liệu mẫu
npm run db:init
npm run db:seed

# 5. Chạy
npm run dev        # chế độ phát triển (tự restart khi sửa code)
# hoặc
npm start          # chạy như production
```

Mở trình duyệt: **http://localhost:3000**

Tài khoản admin mặc định (từ `.env`):

| Tên đăng nhập | Mật khẩu |
| --- | --- |
| `admin` | `Admin@12345` |

> 🔐 **Đổi `ADMIN_PASSWORD` và `SESSION_SECRET` trong `.env` trước khi deploy thật.**

---

## 📜 Các lệnh npm

| Lệnh | Mô tả |
| --- | --- |
| `npm start` | Chạy web server |
| `npm run dev` | Chạy kèm nodemon, tự restart khi sửa file |
| `npm run start:all` | Chạy **cả web + bot Discord** khi có token |
| `npm run db:init` | Tạo database và chạy migration còn thiếu |
| `npm run db:reset` | **Xoá** database rồi tạo lại (chỉ dùng ở máy dev) |
| `npm run db:migrate` | Chạy migration còn thiếu |
| `npm run db:seed` | Thêm dữ liệu mẫu (admin, tiêu chí điểm, vật phẩm...) |
| `npm test` | Chạy toàn bộ test |
| `npm run test:watch` | Chạy test ở chế độ theo dõi |

Xem trạng thái migration:

```bash
node src/db/migrate.js --status
```

---

## 🗂 Cấu trúc thư mục

```
botdiscord/
├── src/
│   ├── app.js                  # Khởi tạo Express (không listen → test được)
│   ├── server.js               # Điểm khởi động + graceful shutdown
│   ├── config/
│   │   ├── env.js              # Đọc & validate .env bằng zod
│   │   ├── paths.js            # Đường dẫn tuyệt đối dùng chung
│   │   ├── sessionStore.js     # Session store trên SQLite
│   │   └── version.js          # Version đọc từ package.json
│   ├── db/
│   │   ├── driver.js           # Mở SQLite + PRAGMA (WAL, foreign_keys...)
│   │   ├── index.js            # API truy vấn: get/all/run/tx/stats
│   │   ├── migrate.js          # Migration engine (checksum, transaction)
│   │   ├── initDb.js           # Tự khởi tạo DB + sao lưu
│   │   ├── seed.js             # Dữ liệu mẫu
│   │   └── migrations/         # 001_initial.sql, 002_...
│   ├── middleware/
│   │   ├── auth.js             # attachUser, requireAuth/Admin/Moderator
│   │   ├── csrf.js             # Bảo vệ CSRF (synchronizer token)
│   │   ├── errors.js           # 404/403/429/500 + HttpError
│   │   ├── flash.js            # Flash message 1 lần
│   │   ├── security.js         # Helmet/CSP + rate limit
│   │   └── viewLocals.js       # Helper dùng chung trong EJS
│   ├── routes/                 # Mỗi nhóm chức năng 1 router
│   │   ├── index.js            # "Mục lục" mount các router
│   │   ├── home.js
│   │   └── health.js
│   ├── services/               # Logic nghiệp vụ (Giai đoạn 3)
│   ├── utils/logger.js         # Logger có màu, có scope
│   └── views/
│       ├── partials/           # head, navbar, flash, footer
│       ├── pages/              # home, health, posts, shop...
│       └── errors/             # 403, 404, 429, 500
├── public/                     # Tài nguyên tĩnh (CSS/JS/img/fonts/uploads)
├── bot/                        # Bot Discord
├── tests/                      # Unit test (vitest)
├── docs/                       # Tài liệu kiến trúc
├── data/                       # Database (tự sinh, KHÔNG commit)
├── legacy-static/              # Bản web tĩnh ban đầu (chỉ để tham khảo)
├── schema-reference.sql        # Schema tham chiếu đầy đủ
├── start-all.js                # Chạy web + bot cùng lúc
├── vitest.config.js
├── .env.example
└── package.json
```

Chi tiết quyết định kiến trúc: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## 🔧 Biến môi trường

Toàn bộ biến được mô tả trong [`.env.example`](.env.example). Những biến quan trọng:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `PORT` | `3000` | Cổng HTTP |
| `HOST` | `0.0.0.0` | Interface lắng nghe |
| `SESSION_SECRET` | *(bắt buộc khi prod)* | Khoá ký session — **phải đổi** |
| `DATABASE_FILE` | `data/app.db` | Đường dẫn file SQLite (`:memory:` cho test) |
| `BCRYPT_ROUNDS` | `12` | Số vòng hash mật khẩu |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | — | Tài khoản admin khi seed |
| `DISCORD_TOKEN` | *(trống)* | Token bot |

Tạo `SESSION_SECRET` an toàn:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 🗄 Database & migration

- Engine: **SQLite** qua module có sẵn của Node (`node:sqlite`) — không cần cài server.
- Bật sẵn `WAL`, `foreign_keys`, `busy_timeout` (web và bot có thể cùng ghi).
- `schema-reference.sql` là **bản đồ dữ liệu** đầy đủ để tra cứu và có thể chạy trực tiếp:

```bash
sqlite3 data/app.db < schema-reference.sql
```

### Thêm một migration mới

1. Tạo file mới theo mẫu số thứ tự: `src/db/migrations/002_ten_thay_doi.sql`
2. Viết SQL (dùng `ALTER TABLE` / `CREATE TABLE`...).
3. Chạy `npm run db:migrate`.

**Quy tắc vàng:** *không bao giờ sửa file migration đã chạy.* Engine lưu checksum
SHA-256 và sẽ cảnh báo nếu phát hiện file bị sửa — vì môi trường thật và máy dev
sẽ lệch schema.

---

## 🔒 Bảo mật

Đã bật sẵn:

- **Helmet + CSP** với nonce cho script nội tuyến (không dùng `unsafe-inline` cho JS)
- **Session** cookie `httpOnly` + `sameSite=lax` + `secure` khi production
- **CSRF** synchronizer token cho mọi request ghi, so sánh bằng `timingSafeEqual`
- **Rate limit** toàn site + giới hạn riêng cho đăng nhập (chống brute force)
- **bcrypt** 12 rounds cho mật khẩu
- **SQL injection**: 100% truy vấn dùng prepared statement có tham số
- **EJS escape** `<%= %>` mặc định; chỉ dùng `<%- %>` cho partial tin cậy
- **Không lộ stack trace** ra ngoài ở production

Nếu phát hiện lỗ hổng, vui lòng mở issue riêng tư hoặc liên hệ maintainer.

---

## 🧪 Kiểm thử

```bash
npm test
```

Test chạy trên database `:memory:` — **không** ảnh hưởng dữ liệu thật.

Hiện có (Giai đoạn 1): 11 test khói cho Express, header bảo mật, health check,
404, CSRF, schema, CHECK constraint, transaction rollback và view an toàn.

Giai đoạn 4 sẽ bổ sung bộ test cho: **xác thực admin**, **tính điểm rèn luyện**,
**media/profile** và **presence**.

---

## 🌐 Triển khai production

```bash
# 1. Cấu hình
NODE_ENV=production
SESSION_SECRET=<chuỗi ngẫu nhiên 48 byte>
APP_URL=https://your-domain.com

# 2. Chạy
npm ci --omit=dev
npm run db:init
npm start
```

Gợi ý dùng **PM2** (mã nguồn mở) để giữ tiến trình:

```bash
npm i -g pm2
pm2 start start-all.js --name ladudu
pm2 save
```

Với **Nginx**, nhớ đặt `proxy_set_header X-Forwarded-Proto $scheme;` và
`TRUST_PROXY=1` trong `.env` để cookie `secure` hoạt động.

---

## 🗺 Lộ trình phát triển

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| **1** | Kiến trúc, schema SQL, migration, cấu hình Express + Database | ✅ **Hoàn tất** |
| **2** | Partials, CSS chia module, `motion.css`, `transitions.js`, Mobile/PC | ⏳ Tiếp theo |
| **3** | Routes + Views: Auth/Admin → Posts → Profile/Shop → Chat/Messages/Presence → Study/Conduct/Media | ⏳ |
| **4** | Bot Discord: 7 slash command cơ bản; voice chưa triển khai | 🚧 |

---

## 🤝 Đóng góp

1. Fork dự án
2. Tạo nhánh: `git checkout -b feat/ten-tinh-nang`
3. Commit theo quy ước [Conventional Commits](https://www.conventionalcommits.org/):
   `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
4. Mở Pull Request, mô tả rõ thay đổi + ảnh chụp nếu là giao diện

**Quy ước code:** CommonJS, 2 space, dấu `;`, comment tiếng Việt cho logic nghiệp vụ,
tên biến/hàm tiếng Anh. Chỉ animate `transform` và `opacity`.

---

## 📄 Giấy phép

[MIT](LICENSE) © 2026 Lá Đu Đủ Community — miễn phí sử dụng, chỉnh sửa và phân phối.

> `legacy-static/` là bản website tĩnh đầu tiên của dự án, được giữ lại để tham khảo
> ý tưởng thiết kế. Không nằm trong luồng chạy của ứng dụng.

## 🤖 Bot Discord: lệnh quản trị và tiện ích

Bot hỗ trợ các **slash command** trong máy chủ: `/clear soluong` (1–100 tin nhắn), `/avatar [thanhvien]`, `/profile [thanhvien]` (hồ sơ Discord, không phải tài khoản website), `/kick thanhvien [lydo]`, `/afk [lydo]`, `/help` và `/warn thanhvien lydo`. Cảnh báo được lưu trong SQLite theo từng máy chủ; lệnh này không tự động kick hoặc gửi DM. AFK được lưu qua lần khởi động lại, tự xóa khi người dùng gửi tin nhắn trong cùng máy chủ; bot thông báo khi người AFK được nhắc đến.

1. Tạo ứng dụng/bot tại Discord Developer Portal, bật **Message Content Intent** trong mục Bot để tính năng AFK khi được nhắc hoạt động. Không cần Server Members Intent.
2. Điền `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` và tùy chọn `DISCORD_GUILD_ID` trong `.env`. Không chia sẻ token. Mời bot với scope `bot` và `applications.commands`, cấp quyền xem kênh/gửi tin nhắn, Manage Messages cho `/clear` và Kick Members cho `/kick`; vai trò bot phải cao hơn thành viên cần kick.
3. Chạy `npm install`, sau đó `npm run deploy-commands`. Có `DISCORD_GUILD_ID` thì đăng ký riêng cho máy chủ (cập nhật nhanh); bỏ trống thì đăng ký toàn cục (có thể mất thời gian cập nhật). **Lưu ý:** thao tác đăng ký thay thế toàn bộ slash command của ứng dụng tại phạm vi tương ứng.
4. Chạy `npm run bot` hoặc `npm run start:all` để chạy cùng website.

`/clear` yêu cầu người dùng và bot có quyền Manage Messages, và chỉ xóa hàng loạt được tin nhắn chưa quá 14 ngày. `/kick` yêu cầu Kick Members, `/warn` yêu cầu Moderate Members; cả hai kiểm tra thứ bậc vai trò và không áp dụng cho chủ máy chủ, chính người dùng hoặc bot. Bot tạo các bảng cần thiết nếu chưa có; hãy sao lưu SQLite trước khi nâng cấp hệ thống đang chạy.
