# 🍃 Lá Đu Đủ Học Tập — Web học tập hỗ trợ sinh viên

Website học tập với 4 tính năng chính:

| Tính năng | Mô tả |
|---|---|
| 📊 **Tính điểm rèn luyện** | Thang 100 điểm (5 tiêu chí Bộ GD&ĐT), vòng tròn điểm, xếp loại, gợi ý cải thiện, lưu lịch sử |
| ▶️ **Video học không quảng cáo** | 17 video bài giảng (Toán, Văn, Vật lý, Tin học, Tiếng Anh, Kỹ năng) nhúng YouTube chế độ không cookie, lọc theo môn, xem ngay trong trang |
| ✍️ **Đăng bài** | Viết bài chia sẻ, tìm kiếm, lọc chuyên mục, thích ❤️, xóa bài của mình |
| 💬 **Chat bạn học** | Phòng chat chung, danh sách online, gõ tin nhắn có bạn học ảo trả lời, emoji nhanh |

## Chạy thử

```bash
python3 -m http.server 8000
# Mở http://localhost:8000
```

## Cấu trúc

```
index.html        — Nội dung trang
css/style.css     — Giao diện + hiệu ứng chung (lá rơi, tilt, reveal...)
css/learning.css  — Style cho 4 tính năng học tập
js/main.js        — Hiệu ứng chung (preloader, canvas lá, parallax...)
js/learning.js    — Logic: điểm rèn luyện, video, đăng bài, chat
assets/           — Hình ảnh minh họa
```

## Lưu ý về dữ liệu

- Điểm rèn luyện, bài viết và tin nhắn chat được lưu bằng **localStorage** trên trình duyệt của người dùng (không cần máy chủ).
- Chat hiện là **bản demo**: có bạn học ảo trả lời để trải nghiệm. Muốn chat thật giữa nhiều người dùng cần thêm backend (Node.js + Socket.IO hoặc Firebase...).
- Video nhúng từ YouTube ở chế độ `youtube-nocookie` để hạn chế quảng cáo; trang không chèn quảng cáo.

## Thêm video mới

Mở `js/learning.js`, thêm vào mảng `VIDEOS`:

```js
{ id: 'VIDEO_ID', cat: 'toan', catName: '📐 Toán', title: 'Tiêu đề', desc: 'Mô tả ngắn' }
```

`VIDEO_ID` là phần sau `watch?v=` trên YouTube. `cat` dùng một trong: `toan`, `van`, `ly`, `tin`, `anh`, `kynang`.

© 2026 Lá Đu Đủ Học Tập
