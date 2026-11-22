/**
 * src/middleware/flash.js
 * ---------------------------------------------------------------------------
 * Flash message (thông báo hiển thị đúng 1 lần) — tự viết, không cần package.
 *
 * Dùng trong route:
 *   req.flash('success', 'Đăng bài thành công!');
 *   req.flash('error', 'Sai mật khẩu');
 *
 * Trong view (partials/flash.ejs):
 *   dùng biến `flash` = { success: [...], error: [...] }
 */
'use strict';

const MAX_PER_TYPE = 5;

function flashMiddleware(req, res, next) {
  // Khởi tạo "túi" flash trong session nếu chưa có
  if (!req.session.flash) req.session.flash = {};

  // Đọc & xoá ngay → chỉ hiện 1 lần
  const bag = req.session.flash;
  req.session.flash = {};

  req.flash = (type, message) => {
    const key = String(type || 'info');
    if (!bag[key]) bag[key] = [];
    if (message !== undefined && bag[key].length < MAX_PER_TYPE) bag[key].push(String(message));
    // Gọi không tham số → trả về danh sách (tương thích API connect-flash)
    return message === undefined ? bag[key] : undefined;
  };

  res.locals.flash = bag;
  next();
}

module.exports = flashMiddleware;
