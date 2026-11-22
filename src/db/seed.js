/**
 * src/db/seed.js
 * ---------------------------------------------------------------------------
 * Tạo dữ liệu mẫu để phát triển giao diện (Giai đoạn 2–3 dùng tới).
 *
 *   npm run db:seed
 *
 * Script này IDEMPOTENT: chạy nhiều lần không tạo dữ liệu trùng
 * (dùng INSERT OR IGNORE / kiểm tra tồn tại trước khi insert).
 *
 * Tài khoản admin lấy từ .env (ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD).
 */
'use strict';

const bcrypt = require('bcryptjs');
const db = require('./index');
const env = require('../config/env');
const log = require('../utils/logger').scope('seed');

/** Bộ tiêu chí điểm rèn luyện chuẩn (tổng = 100 điểm). */
const CONDUCT_CRITERIA = [
  ['academic', 'Ý thức học tập', 20, 'Kết quả học tập, chuyên cần, thái độ học tập trên lớp.'],
  ['discipline', 'Chấp hành nội quy, pháp luật', 25, 'Tuân thủ quy định nhà trường, pháp luật, không vi phạm kỷ luật.'],
  ['social', 'Hoạt động xã hội', 20, 'Tham gia tình nguyện, hoạt động xã hội, phong trào của trường và lớp.'],
  ['community', 'Công dân trong cộng đồng', 20, 'Ý thức cộng đồng, giúp đỡ bạn bè, bảo vệ môi trường, ứng xử văn minh.'],
  ['culture', 'Văn hóa, thể thao', 15, 'Tham gia hoạt động văn nghệ, thể thao, hội thi, câu lạc bộ.'],
];

const COSMETICS = [
  ['frame-leaf-green', 'Khung Lá Xanh', 'frame', 'Khung avatar xanh mướt như lá đu đủ.', 'common', 0],
  ['frame-leaf-gold', 'Khung Lá Vàng', 'frame', 'Khung avatar ánh kim cho người nổi bật.', 'rare', 500],
  ['frame-neon-glow', 'Khung Neon', 'frame', 'Khung phát sáng rực rỡ.', 'epic', 1200],
  ['badge-founder', 'Huy hiệu Sáng Lập', 'badge', 'Dành cho thành viên đầu tiên của cộng đồng.', 'legendary', 0],
  ['badge-bookworm', 'Huy hiệu Mọt Sách', 'badge', 'Trao cho người chăm chỉ học tập.', 'rare', 300],
  ['banner-tropical', 'Ảnh bìa Nhiệt Đới', 'banner', 'Ảnh bìa vườn đu đủ nhiệt đới.', 'common', 0],
  ['theme-sunset', 'Theme Hoàng Hôn', 'banner', 'Giao diện hồ sơ màu hoàng hôn.', 'epic', 900],
];

const SHOP_ITEMS = [
  ['item-rename', 'Đổi tên hiển thị', 'Đổi tên hiển thị một lần.', 'utility', '✏️', 200],
  ['item-boost-xp', 'Nhân đôi XP (1 ngày)', 'Nhận gấp đôi XP trong 24 giờ.', 'perk', '⚡', 400],
  ['item-pin-post', 'Ghim bài viết (7 ngày)', 'Đưa bài viết của bạn lên đầu trang chủ.', 'perk', '📌', 600],
  ['item-frame-gold', 'Khung Lá Vàng', 'Mở khoá khung avatar Lá Vàng.', 'cosmetic', '🖼️', 500],
  ['item-badge-bookworm', 'Huy hiệu Mọt Sách', 'Mở khoá huy hiệu Mọt Sách.', 'cosmetic', '📚', 300],
];

const CHAT_ROOMS = [
  ['chung', 'Phòng chung', 'Nơi mọi người trò chuyện, chào hỏi và kết bạn.'],
  ['hoc-tap', 'Góc học tập', 'Trao đổi bài vở, hỏi đáp môn học, chia sẻ tài liệu.'],
  ['lap-trinh', 'Lập trình', 'Chia sẻ code, debug, tài nguyên học lập trình.'],
  ['giai-tri', 'Giải trí', 'Âm nhạc, phim ảnh, game và thư giãn.'],
];

function seed({ silent = false } = {}) {
  const pwdHash = bcrypt.hashSync(env.ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
  const log_ = (msg) => !silent && log.info(msg);

  db.tx(() => {
    /* ---------------------------- Admin ---------------------------- */
    const existingAdmin = db.get('SELECT id FROM users WHERE email = ?', [env.ADMIN_EMAIL]);
    if (!existingAdmin) {
      db.run(
        `INSERT INTO users (username, email, password_hash, display_name, role, coins, xp, level, bio)
         VALUES (?, ?, ?, ?, 'admin', 5000, 1200, 12, ?)`,
        [env.ADMIN_USERNAME, env.ADMIN_EMAIL, pwdHash, env.ADMIN_DISPLAY_NAME,
          'Quản trị viên của Lá Đu Đủ Community 🍃']
      );
      log_(`👤 Tạo tài khoản admin: ${env.ADMIN_USERNAME} <${env.ADMIN_EMAIL}>`);
    }

    /* ------------------------- Tiêu chí điểm ------------------------ */
    CONDUCT_CRITERIA.forEach(([code, name, max, desc], i) => {
      db.run(
        `INSERT INTO conduct_criteria (code, name, max_score, description, sort_order)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET name=excluded.name, max_score=excluded.max_score,
           description=excluded.description, sort_order=excluded.sort_order`,
        [code, name, max, desc, i]
      );
    });

    /* --------------------------- Cosmetics -------------------------- */
    COSMETICS.forEach(([code, name, type, desc, rarity, price]) => {
      db.run(
        `INSERT INTO cosmetics (code, name, type, description, rarity, price)
         VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING`,
        [code, name, type, desc, rarity, price]
      );
    });

    /* --------------------------- Shop items ------------------------- */
    SHOP_ITEMS.forEach(([code, name, desc, cat, icon, price]) => {
      db.run(
        `INSERT INTO shop_items (code, name, description, category, icon, price)
         VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING`,
        [code, name, desc, cat, icon, price]
      );
    });

    /* --------------------------- Chat rooms ------------------------- */
    CHAT_ROOMS.forEach(([slug, name, desc]) => {
      db.run(
        `INSERT INTO chat_rooms (slug, name, description) VALUES (?, ?, ?)
         ON CONFLICT(slug) DO NOTHING`,
        [slug, name, desc]
      );
    });
  });

  const summary = {
    users: db.get('SELECT COUNT(*) c FROM users').c,
    conductCriteria: db.get('SELECT COUNT(*) c FROM conduct_criteria').c,
    cosmetics: db.get('SELECT COUNT(*) c FROM cosmetics').c,
    shopItems: db.get('SELECT COUNT(*) c FROM shop_items').c,
    chatRooms: db.get('SELECT COUNT(*) c FROM chat_rooms').c,
  };

  if (!silent) {
    log.info('✅ Seed hoàn tất:', summary);
    log.info(`   Đăng nhập: ${env.ADMIN_USERNAME} / ${env.isProd ? '(mật khẩu trong .env)' : env.ADMIN_PASSWORD}`);
  }
  return summary;
}

module.exports = { seed, CONDUCT_CRITERIA };

if (require.main === module) {
  try {
    seed();
  } catch (err) {
    log.error(err.message);
    process.exitCode = 1;
  } finally {
    db.closeDb();
  }
}
