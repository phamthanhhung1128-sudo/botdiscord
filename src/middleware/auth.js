/**
 * src/middleware/auth.js
 * ---------------------------------------------------------------------------
 * Xác thực & phân quyền.
 *
 *   attachUser     : đọc session → nạp req.user (chạy cho MỌI request)
 *   requireAuth    : chặn nếu chưa đăng nhập  → 302 /login hoặc 401 JSON
 *   requireAdmin   : chặn nếu không phải admin
 *   requireModerator: admin hoặc moderator
 *   requireOwnerOr : chủ sở hữu tài nguyên hoặc admin
 *
 * Quy ước: hàm `can*` là hàm THUẦN (pure) → dễ unit test, không phụ thuộc
 * Express. Đây là phần được test ở Giai đoạn 4 (tests/auth.test.js).
 */
'use strict';

const db = require('../db');

/** Các cấp bậc quyền, số càng lớn quyền càng cao. */
const ROLE_LEVEL = Object.freeze({ user: 1, moderator: 2, admin: 3 });

/* --------------------------------- Hàm thuần -------------------------------- */

/** User có đủ cấp bậc yêu cầu? */
function hasRole(user, minRole = 'user') {
  if (!user) return false;
  const level = ROLE_LEVEL[user.role] ?? 0;
  return level >= (ROLE_LEVEL[minRole] ?? 99);
}

/** Là admin? */
const isAdmin = (user) => hasRole(user, 'admin');

/** Là moderator trở lên? */
const isModerator = (user) => hasRole(user, 'moderator');

/** Tài khoản còn hoạt động? */
const isActive = (user) => !!user && user.status === 'active';

/**
 * Được phép thao tác trên tài nguyên này không?
 * @param {{id:number, role:string}} user
 * @param {{ownerId:number}} resource  tài nguyên có cột chủ sở hữu
 */
function canManage(user, resource) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isModerator(user)) return true;
  return Number(resource?.ownerId) === Number(user.id);
}

/* ------------------------------- Middleware -------------------------------- */

/** Request có phải AJAX / API (trả JSON) hay không. */
function wantsJson(req) {
  return (
    req.xhr ||
    req.path.startsWith('/api/') ||
    (req.get('accept') || '').includes('application/json')
  );
}

/** Nạp user hiện tại từ session vào req.user + res.locals.currentUser. */
function attachUser(req, res, next) {
  req.user = null;
  res.locals.currentUser = null;

  const userId = req.session?.userId;
  if (!userId) return next();

  const user = db.get(
    `SELECT id, username, email, display_name, avatar_url, bio, role, status,
            coins, xp, level, discord_id, created_at
       FROM users WHERE id = ?`,
    [userId]
  );

  if (!user || user.status === 'banned') {
    // Session trỏ tới user đã bị xoá/ban → huỷ phiên cho sạch
    return req.session.destroy(() => {
      res.clearCookie(req.app.get('sessionCookieName') || 'ladudu.sid');
      next();
    });
  }

  req.user = user;
  res.locals.currentUser = user;
  next();
}

/** Bắt buộc đã đăng nhập. */
function requireAuth(req, res, next) {
  if (req.user && isActive(req.user)) return next();

  if (wantsJson(req)) {
    return res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để tiếp tục.' });
  }

  // Nhớ URL muốn vào để quay lại sau khi đăng nhập
  req.session.returnTo = req.originalUrl;
  req.flash('warning', 'Vui lòng đăng nhập để tiếp tục.');
  return res.redirect('/login');
}

/** Bắt buộc là admin. */
function requireAdmin(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);

  if (isAdmin(req.user)) return next();

  if (wantsJson(req)) {
    return res.status(403).json({ ok: false, error: 'Chỉ quản trị viên mới có quyền này.' });
  }
  res.status(403);
  return res.render('errors/403', {
    title: 'Không có quyền truy cập',
    message: 'Trang này chỉ dành cho quản trị viên.',
  });
}

/** Bắt buộc là moderator trở lên. */
function requireModerator(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);
  if (isModerator(req.user)) return next();

  if (wantsJson(req)) {
    return res.status(403).json({ ok: false, error: 'Bạn không có quyền kiểm duyệt.' });
  }
  res.status(403);
  return res.render('errors/403', {
    title: 'Không có quyền truy cập',
    message: 'Trang này chỉ dành cho kiểm duyệt viên.',
  });
}

/** Chỉ cho phép chính chủ (hoặc admin) — dùng cho /profile/:id/edit ... */
function requireSelf(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);
  const targetId = Number(req.params.id || req.params.userId);
  if (isAdmin(req.user) || Number(req.user.id) === targetId) return next();

  if (wantsJson(req)) {
    return res.status(403).json({ ok: false, error: 'Bạn chỉ có thể thao tác trên hồ sơ của mình.' });
  }
  res.status(403);
  return res.render('errors/403', {
    title: 'Không có quyền',
    message: 'Bạn chỉ có thể thao tác trên hồ sơ của chính mình.',
  });
}

module.exports = {
  ROLE_LEVEL,
  hasRole,
  isAdmin,
  isModerator,
  isActive,
  canManage,
  attachUser,
  requireAuth,
  requireAdmin,
  requireModerator,
  requireSelf,
};
