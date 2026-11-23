# AutoSlide AI

AutoSlide AI là ứng dụng web tiếng Việt tạo PowerPoint từ yêu cầu ngôn ngữ tự nhiên hoặc tài liệu DOCX/PDF/TXT. Dự án chạy độc lập trong thư mục này, dùng Python 3.11+, Flask, OpenAI API, `python-pptx` và SQLite.

## Tính năng

- Chat tạo cấu trúc slide, xem trước từng slide và JSON trước khi xuất.
- Đọc `.docx`, `.pdf`, `.txt`; giới hạn upload 10 MB.
- Xuất `.pptx` có theme, slide số, bảng, biểu đồ, timeline/sơ đồ, quote, speaker notes.
- Lịch sử tạo file, link download duy nhất theo UUID.
- Rate limit tối đa 5 request API/phút/IP. API key chỉ đọc từ biến môi trường.
- Không cần API key để chạy thử giao diện và tạo file từ nội dung mẫu. Khi có key, GPT-4o sẽ phân tích prompt thật.
- DALL-E 3 là tính năng tùy chọn; mặc định ảnh được biểu diễn bằng placeholder để không phát sinh phí ngoài ý muốn.

## Cài đặt

### 1. Tạo môi trường ảo

```bash
cd autoslide-ai
python3.11 -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
```

### 2. Cài dependency

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Thiết lập môi trường và OpenAI key

```bash
cp .env.example .env
```

Mở `.env` rồi đặt `OPENAI_API_KEY=sk-...` bằng API key của bạn. Không commit hoặc chia sẻ file `.env`. Có thể giữ key trống để thử bộ mẫu offline. Nếu cần, thay `FLASK_SECRET_KEY` thành một chuỗi ngẫu nhiên dài.

### 4. Chạy server

```bash
python app.py
```

Mở <http://localhost:5000>. Flask tự tạo SQLite database, thư mục uploads và outputs khi khởi động.

## Thử nhanh

Prompt mẫu 1 — giới thiệu công ty:

> Tạo 5 slide giới thiệu công ty công nghệ ABC, theme dark; slide 2 có sơ đồ tổ chức 3 cấp, slide 4 có bảng so sánh 3 gói dịch vụ, slide 3 có ảnh văn phòng hiện đại.

Prompt mẫu 2 — kế hoạch dự án:

> Tạo 8 slide bằng tiếng Việt trình bày kế hoạch ra mắt ứng dụng học ngoại ngữ trong 6 tháng. Dùng theme corporate, có biểu đồ ngân sách, bảng KPI và timeline theo tháng. Slide cuối là lời kêu gọi hành động.

Bạn cũng có thể upload một tài liệu DOCX/PDF/TXT, nhập yêu cầu “Biến nội dung tài liệu thành 6 slide”, bấm **Xem trước**, chọn một slide để xem chi tiết, rồi bấm **Tạo PowerPoint**.

## API

| Phương thức | Đường dẫn | Mục đích |
|---|---|---|
| `GET` | `/` | Giao diện tạo slide |
| `POST` | `/api/chat` | Phân tích prompt, trả về `{spec}` |
| `POST` | `/api/upload` | Upload multipart field `file`, trả về `file_id` và preview |
| `POST` | `/api/generate` | Nhận `message`, `file_id?`, `spec?`; lưu và trả về download URL |
| `GET` | `/api/download/<filename>` | Tải PowerPoint đã tạo |
| `GET` | `/api/history` | 50 lần tạo gần nhất |

Ví dụ preview qua curl:

```bash
curl -X POST http://localhost:5000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Tạo 5 slide giới thiệu sản phẩm chăm sóc sức khỏe, có bảng và timeline"}'
```

## Cấu trúc

```text
autoslide-ai/
├── app.py
├── config.py
├── requirements.txt
├── .env.example
├── core/                 # parser AI, đọc tệp, PPT builder, theme
├── models/               # SQLAlchemy History và Template
├── static/css/           # giao diện tùy chỉnh
├── static/js/            # chat, upload, preview, tạo và tải file
├── templates/            # trang SPA
└── outputs/              # PowerPoint (không commit)
```

## Ảnh AI (tùy chọn)

Đặt `ENABLE_IMAGE_GENERATION=true` trong `.env` để bật gọi DALL-E 3 khi tích hợp tạo ảnh. Tính năng này cần OpenAI API cho phép image generation và có thể bị tính phí. Mặc định ứng dụng không gọi API ảnh. Khi có URL stock trong spec, PowerPoint builder chỉ tải HTTPS từ `images.unsplash.com` hoặc `plus.unsplash.com` để giảm rủi ro SSRF.

## Ghi chú triển khai

- Chạy sau HTTPS/reverse proxy trong production, đặt `FLASK_DEBUG=false`, thay `FLASK_SECRET_KEY`, bảo vệ `.env` và backup SQLite.
- SQLite giữ tối đa lịch sử hiển thị 50 bản ghi; file output không tự xóa để link lịch sử còn hoạt động.
- Nội dung trích xuất từ tài liệu được giới hạn 50.000 ký tự khi gửi tới model.
- Tính năng mẫu offline luôn tạo một spec 5 slide; phân tích yêu cầu tùy biến số slide cần cấu hình OpenAI API key.
