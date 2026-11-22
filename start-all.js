/**
 * start-all.js
 * ---------------------------------------------------------------------------
 * Chạy ĐỒNG THỜI web server (Express) và bot Discord trong cùng một tiến trình
 * cha, có quản lý vòng đời: nếu một bên chết → dừng bên còn lại và thoát.
 *
 *   npm run start:all
 *
 * Bot Discord được bật ở Giai đoạn 4. Script này đã sẵn sàng: chỉ cần có
 * bot/index.js và DISCORD_TOKEN trong .env là bot tự chạy cùng web.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const env = require('./src/config/env');
const log = require('./src/utils/logger').scope('start-all');

const BOT_ENTRY = path.join(__dirname, 'bot', 'index.js');

async function main() {
  log.info('🚀 Khởi động Lá Đu Đủ Community...');

  /* ---------------------------- 1. Web server --------------------------- */
  const { start } = require('./src/server');
  const { server } = await start();

  /* ----------------------------- 2. Bot -------------------------------- */
  const botAvailable = fs.existsSync(BOT_ENTRY);
  const botConfigured = Boolean(env.DISCORD_TOKEN);

  if (botAvailable && botConfigured) {
    log.info('🤖 Đang khởi động bot Discord...');
    try {
      const bot = require(BOT_ENTRY);
      const startBot = bot.start || bot.default || bot;
      await startBot({ token: env.DISCORD_TOKEN });
      log.info('🤖 Bot Discord đã online.');
    } catch (err) {
      log.error('Không khởi động được bot:', err.message);
      log.warn('Web vẫn chạy bình thường. Kiểm tra DISCORD_TOKEN trong .env.');
    }
  } else if (!botAvailable) {
    log.warn('Bot chưa được cài đặt (thiếu bot/index.js) — sẽ có ở Giai đoạn 4.');
  } else {
    log.warn('Thiếu DISCORD_TOKEN trong .env → bỏ qua bot Discord.');
  }

  /* -------------------------- 3. Tắt êm cả hai ------------------------- */
  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    log.warn(`Nhận ${signal} — đang dừng toàn bộ...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error('Khởi động thất bại:', err.stack || err.message);
  process.exit(1);
});
