/**
 * src/middleware/viewLocals.js
 * ---------------------------------------------------------------------------
 * Biến & helper dùng chung trong MỌI view EJS.
 * Nhờ vậy partials không phải tự tính toán, view cũng gọn hơn.
 */
'use strict';

const env = require('../config/env');

/** Định dạng ngày kiểu Việt Nam: 22/11/2026 */
function formatDate(value, withTime = false) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (!withTime) return date;
  return `${date} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

/** "3 phút trước" */
function timeAgo(value) {
  if (!value) return '';
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(diff) || diff < 0) return 'vừa xong';
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
  return formatDate(value);
}

/** Cắt ngắn văn bản, thêm dấu … */
function truncate(text, max = 160) {
  const s = String(text ?? '');
  return s.length <= max ? s : `${s.slice(0, max).trimEnd()}…`;
}

/** Chữ cái đầu của họ tên (cho avatar fallback): "Nguyễn Văn A" → "NA" */
function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Số lượng rút gọn: 1248 → 1,2K */
function compactNumber(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10000 ? 1 : 0).replace('.0', '')}K`;
  return `${(v / 1_000_000).toFixed(1).replace('.0', '')}M`;
}

/** Ảnh đại diện: dùng avatar_url nếu có, nếu không trả về null (view tự render chữ cái). */
function avatarOf(user) {
  return user?.avatar_url || null;
}

/** Danh sách menu chính — navbar render từ đây (1 nguồn dữ liệu duy nhất). */
const NAV_ITEMS = [
  { href: '/', label: 'Trang chủ', icon: '🏠' },
  { href: '/posts', label: 'Bài viết', icon: '📝' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/study', label: 'Học tập', icon: '📚' },
  { href: '/conduct-score', label: 'Điểm rèn luyện', icon: '📊' },
  { href: '/shop', label: 'Cửa hàng', icon: '🛍️' },
  { href: '/media', label: 'Media', icon: '🎬' },
];

/** Liên kết menu chân trang. */
const FOOTER_GROUPS = [
  {
    title: 'Cộng đồng',
    links: [
      { href: '/posts', label: 'Bài viết' },
      { href: '/chat', label: 'Phòng chat' },
      { href: '/messages', label: 'Tin nhắn riêng' },
      { href: '/media', label: 'Thư viện media' },
    ],
  },
  {
    title: 'Học tập',
    links: [
      { href: '/study', label: 'Học liệu' },
      { href: '/conduct-score', label: 'Điểm rèn luyện' },
      { href: '/profile', label: 'Hồ sơ của tôi' },
      { href: '/shop', label: 'Cửa hàng' },
    ],
  },
  {
    title: 'Dự án',
    links: [
      { href: '/about', label: 'Giới thiệu' },
      { href: '/health', label: 'Trạng thái hệ thống' },
      { href: 'https://discord.com', label: 'Discord' },
    ],
  },
];

function viewLocals(req, res, next) {
  res.locals.app = {
    name: env.APP_NAME,
    url: env.APP_URL,
    env: env.NODE_ENV,
    version: require('../config/version'),
    isProd: env.isProd,
  };
  res.locals.navItems = NAV_ITEMS;
  res.locals.footerGroups = FOOTER_GROUPS;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  res.locals.year = new Date().getFullYear();
  res.locals.title = env.APP_NAME;

  // Helpers cho view: <%= fmt.date(x) %>, <%= fmt.ago(x) %>
  res.locals.fmt = {
    date: formatDate,
    ago: timeAgo,
    truncate,
    initials,
    compact: compactNumber,
    avatar: avatarOf,
  };

  // Hàm kiểm tra menu đang active: <a class="<%= isActive('/posts') %>">
  res.locals.isActive = (href) => {
    if (href === '/') return req.path === '/' ? 'is-active' : '';
    return req.path === href || req.path.startsWith(`${href}/`) ? 'is-active' : '';
  };

  next();
}

module.exports = { viewLocals, formatDate, timeAgo, truncate, initials, compactNumber, NAV_ITEMS };
