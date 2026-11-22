/**
 * src/routes/index.js
 * ---------------------------------------------------------------------------
 * "Bảng mục lục" của toàn bộ route. Mỗi nhóm chức năng là 1 router riêng,
 * được mount ở đây → dễ đọc, dễ mở rộng, không có file route khổng lồ.
 *
 * Giai đoạn 1 (hiện tại): health + trang chủ tạm.
 * Giai đoạn 3 sẽ bật thêm:
 *   /auth         → đăng ký, đăng nhập, đăng xuất
 *   /admin        → quản trị bài viết, người dùng
 *   /posts        → CRUD bài viết
 *   /profile      → hồ sơ + trang trí
 *   /shop         → cửa hàng
 *   /chat         → phòng chat
 *   /messages     → tin nhắn riêng
 *   /presence     → API trạng thái online
 *   /study        → học liệu
 *   /conduct-score→ điểm rèn luyện
 *   /media        → thư viện media
 */
'use strict';

const express = require('express');

const healthRoutes = require('./health');
const homeRoutes = require('./home');

const router = express.Router();

// ---------------------------------------------------------------------------
//  Điều hướng gốc
// ---------------------------------------------------------------------------
router.use('/health', healthRoutes);
router.use('/', homeRoutes);

module.exports = router;
