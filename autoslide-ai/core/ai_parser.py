"""Phân tích prompt thành cấu trúc slide bằng OpenAI."""
import json
import re
from copy import deepcopy

from openai import OpenAI

from .templates_engine import default_spec, theme_defaults

SYSTEM_PROMPT = '''Bạn là chuyên gia thiết kế thuyết trình cấp cao. Nhiệm vụ: chuyển đổi yêu cầu người dùng thành JSON cấu trúc để tạo file PowerPoint.

OUTPUT CHỈ LÀ JSON, KHÔNG THÊM TEXT NÀO KHÁC. Schema:

{
  "meta": {
    "title": "Tên bài thuyết trình",
    "author": "Tên tác giả (nếu có)",
    "theme": "corporate|modern|dark|minimal|colorful|education",
    "slide_size": "16:9|4:3",
    "primary_color": "#HEX",
    "secondary_color": "#HEX",
    "font_title": "Arial|Montserrat|Roboto",
    "font_body": "Calibri|Open Sans|Roboto"
  },
  "slides": [
    {
      "index": 1,
      "type": "title|section|content|two_column|image_right|image_full|chart|table|timeline|org_chart|quote|closing",
      "title": "Tiêu đề slide",
      "subtitle": "Phụ đề (nếu type=title)",
      "bullets": ["Điểm 1", "Điểm 2", "Điểm 3"],  // dùng cho type=content
      "left_column": ["..."],  // dùng cho two_column
      "right_column": ["..."],
      "image_prompt": "Mô tả chi tiết ảnh cần (tiếng Anh, để dùng cho DALL-E hoặc tìm stock)",  // null nếu không cần
      "image_url": "url ảnh stock (nếu có thể gợi ý unsplash source)",
      "table": {  // dùng cho type=table
        "headers": ["Cột 1", "Cột 2"],
        "rows": [["a","b"],["c","d"]],
        "caption": "Chú thích bảng"
      },
      "chart": {  // dùng cho type=chart
        "chart_type": "bar|pie|line",
        "labels": ["Q1","Q2","Q3"],
        "values": [10, 20, 30],
        "title_chart": "Biểu đồ doanh thu"
      },
      "diagram": {  // dùng cho timeline, org_chart, flow
        "diagram_type": "timeline|org_chart|flowchart|cycle",
        "items": [
          {"label": "Bước 1", "description": "Mô tả", "date": "2024"},
          {"label": "Bước 2", "description": "..."}
        ]
      },
      "quote": {  // dùng cho type=quote
        "text": "Nội dung trích dẫn",
        "author": "Tác giả"
      },
      "speaker_notes": "Ghi chú cho người thuyết trình ở slide này"
    }
  ],
  "global_notes": "Ghi chú chung cho toàn bài"
}

QUY TẮC BẮT BUỘC:
1. Nếu người dùng nói "X slide" thì PHẢI tạo đúng X phần tử trong mảng slides.
2. Nếu yêu cầu "có sơ đồ quy trình" → dùng type=flowchart hoặc timeline.
3. Nếu yêu cầu "có bảng so sánh" → dùng type=table và điền đủ dữ liệu hợp lý.
4. Nếu yêu cầu "có ảnh" → điền image_prompt chi tiết (tiếng Anh, mô tả cụ thể: "modern office meeting room, diverse team, natural lighting, 4k, photorealistic").
5. Nếu không nói theme → mặc định "modern" với màu xanh dương (#2563EB).
6. Slide đầu tiên LUÔN là type="title", slide cuối LUÔN là type="closing".
7. Nội dung phải bằng tiếng Việt (trừ image_prompt phải tiếng Anh).
8. Mỗi slide content tối đa 5 bullets, mỗi bullet tối đa 15 từ.
'''

ALLOWED_TYPES = {"title", "section", "content", "two_column", "image_right", "image_full", "chart", "table", "timeline", "org_chart", "quote", "closing", "flowchart"}


def _extract_json(text):
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise ValueError("AI không trả về JSON hợp lệ.")
        return json.loads(match.group(0))


def _requested_slide_count(text):
    match = re.search(r"\b(\d{1,2})\s*(?:slide|slides|trang)\b", text or "", re.I)
    if not match:
        return None
    count = int(match.group(1))
    return count if 2 <= count <= 60 else None


def _normalize(spec, expected_count=None):
    if not isinstance(spec, dict) or not isinstance(spec.get("slides"), list) or not spec["slides"]:
        raise ValueError("JSON thiếu danh sách slides.")
    if len(spec["slides"]) > 60:
        raise ValueError("Bài thuyết trình tối đa 60 slide.")
    if expected_count:
        slides = spec["slides"]
        if len(slides) > expected_count:
            spec["slides"] = slides[:expected_count]
        elif len(slides) < expected_count:
            additions = [{"type": "content", "title": f"Nội dung chính {i + 1}",
                          "bullets": ["Tóm tắt ý quan trọng", "Đề xuất bước tiếp theo"]}
                         for i in range(expected_count - len(slides))]
            insert_at = len(slides) - 1 if len(slides) > 1 and isinstance(slides[-1], dict) and slides[-1].get("type") == "closing" else len(slides)
            spec["slides"][insert_at:insert_at] = additions
    meta = spec.setdefault("meta", {})
    theme = meta.get("theme", "modern")
    defaults = theme_defaults(theme)
    meta.setdefault("theme", theme if theme in {"corporate", "modern", "dark", "minimal", "colorful", "education"} else "modern")
    for key, value in defaults.items():
        meta.setdefault(key, value)
    meta.setdefault("title", "Bài thuyết trình mới")
    meta.setdefault("slide_size", "16:9")
    slides = spec["slides"]
    for i, slide in enumerate(slides):
        if not isinstance(slide, dict):
            raise ValueError("Một slide không đúng định dạng đối tượng.")
        slide["index"] = i + 1
        slide["title"] = str(slide.get("title") or f"Slide {i + 1}")[:200]
        if slide.get("type") not in ALLOWED_TYPES:
            slide["type"] = "content"
        for field in ("bullets", "left_column", "right_column"):
            if field in slide and not isinstance(slide[field], list):
                slide[field] = []
        if slide["type"] == "content":
            slide["bullets"] = [str(x)[:180] for x in slide.get("bullets", [])[:5]]
    slides[0]["type"] = "title"
    slides[-1]["type"] = "closing"
    spec.setdefault("global_notes", "")
    return spec


def _fallback_title(text):
    title = re.sub(r"^\s*(?:hãy\s*)?(?:tạo|làm|thiết kế|create)\s+(?:một\s+)?(?:\d+\s+)?(?:slide(?:s)?|bài thuyết trình|presentation)?\s*", "", text or "", flags=re.I)
    title = re.split(r"\b(?:theme|phong cách|màu sắc)\b", title, maxsplit=1, flags=re.I)[0]
    title = title.strip(" ,.:;-—")[:72]
    return title or "Bài thuyết trình mới"


def parse_user_request(user_text: str, file_content: str = None, api_key: str = None, model: str = "gpt-4o") -> dict:
    """Gọi GPT-4o và trả về spec; dùng bộ slide mẫu khi không có key/lỗi parse."""
    content = f"Yêu cầu người dùng:\n{user_text or 'Tạo bài thuyết trình từ tài liệu đính kèm.'}"
    if file_content:
        content += "\n\nNội dung tài liệu nguồn (ưu tiên dữ liệu trong tài liệu):\n" + file_content[:50_000]
    if not api_key:
        # Cho phép chạy thử giao diện khi chưa cấu hình khóa; không giả vờ đã gọi AI.
        spec = default_spec(_fallback_title(user_text))
        spec["global_notes"] = "Chưa cấu hình OPENAI_API_KEY; đây là cấu trúc mẫu để xem thử."
        return spec
    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            temperature=0.35,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": content}],
        )
        raw = response.choices[0].message.content
        return _normalize(_extract_json(raw), _requested_slide_count(user_text))
    except Exception as exc:
        # Fallback an toàn cho lỗi JSON/API; lỗi có thể hiện ở global_notes.
        fallback = deepcopy(default_spec(_fallback_title(user_text)))
        fallback["global_notes"] = f"Không thể phân tích bằng AI ({type(exc).__name__}); đang hiển thị cấu trúc mẫu."
        return fallback
