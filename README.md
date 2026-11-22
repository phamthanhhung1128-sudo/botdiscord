# 🍃 Máy chủ Lá Đu Đủ — Website giới thiệu

Website giới thiệu **Máy chủ Lá Đu Đủ** — giao diện đảo nhiệt đới, hiệu ứng lá rơi,
hoạt ảnh cuộn mượt, thẻ 3D, copy IP 1 chạm...

## Chạy thử

Mở trực tiếp `index.html` bằng trình duyệt, hoặc chạy server tĩnh:

```bash
python3 -m http.server 8000
# Mở http://localhost:8000
```

## Cấu trúc

```
index.html      — Nội dung trang (tiếng Việt)
css/style.css   — Giao diện + hoạt ảnh CSS
js/main.js      — Hiệu ứng JS (lá rơi, tilt, đếm số, copy IP...)
assets/         — Hình ảnh minh họa
```

## Chỉnh thông tin máy chủ

Mở `js/main.js`, sửa phần `CONFIG` ở đầu file:

```js
const CONFIG = {
  serverIp: 'play.ladudu.vn',   // ← IP máy chủ của bạn
  baseOnline: 1248,             // ← Số người chơi hiển thị
  discord: 'https://discord.gg/ladudu',
};
```

IP sẽ tự động cập nhật ở mọi vị trí trên trang.

## Hiệu ứng nổi bật

- 🍃 Lá đu đủ rơi toàn trang (Canvas)
- 🎬 Preloader + reveal khi cuộn (staggered)
- 🖱️ Parallax theo chuột ở Hero, thẻ 3D Tilt, nút nam châm
- 🔢 Đếm số liệu động, số người chơi "trực tiếp"
- 📋 Copy IP 1 chạm + pháo giấy + thông báo Toast
- 🎠 Tabs chế độ chơi, FAQ accordion, marquee chạy chữ
- 📱 Responsive đầy đủ PC / Mobile, hỗ trợ giảm chuyển động

© 2026 Máy chủ Lá Đu Đủ
