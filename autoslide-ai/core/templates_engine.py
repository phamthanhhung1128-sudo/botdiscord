"""Theme presets và helpers cho đặc tả slide."""
from copy import deepcopy

THEMES = {
    "corporate": {"primary_color": "#2563EB", "secondary_color": "#0F172A", "font_title": "Arial", "font_body": "Calibri"},
    "modern": {"primary_color": "#2563EB", "secondary_color": "#8B5CF6", "font_title": "Arial", "font_body": "Calibri"},
    "dark": {"primary_color": "#8B5CF6", "secondary_color": "#111827", "font_title": "Arial", "font_body": "Calibri"},
    "minimal": {"primary_color": "#111827", "secondary_color": "#6B7280", "font_title": "Arial", "font_body": "Calibri"},
    "colorful": {"primary_color": "#EC4899", "secondary_color": "#F59E0B", "font_title": "Arial", "font_body": "Calibri"},
    "education": {"primary_color": "#059669", "secondary_color": "#0F766E", "font_title": "Arial", "font_body": "Calibri"},
}


def theme_defaults(theme="modern"):
    return deepcopy(THEMES.get(theme, THEMES["modern"]))


def default_spec(title="Bài thuyết trình mới"):
    return {
        "meta": {"title": title, "author": "", "theme": "modern", "slide_size": "16:9", **theme_defaults()},
        "slides": [
            {"index": 1, "type": "title", "title": title, "subtitle": "Tổng quan và những điểm chính"},
            {"index": 2, "type": "content", "title": "Bối cảnh", "bullets": ["Xác định mục tiêu và đối tượng", "Tóm tắt thông tin quan trọng", "Làm rõ cơ hội và thách thức"]},
            {"index": 3, "type": "two_column", "title": "Phân tích chính", "left_column": ["Hiện trạng", "Nhu cầu", "Ưu tiên"], "right_column": ["Giải pháp", "Nguồn lực", "Kết quả kỳ vọng"]},
            {"index": 4, "type": "timeline", "title": "Lộ trình đề xuất", "diagram": {"diagram_type": "timeline", "items": [{"label": "Khám phá", "description": "Thu thập thông tin", "date": "Giai đoạn 1"}, {"label": "Triển khai", "description": "Thực hiện giải pháp", "date": "Giai đoạn 2"}, {"label": "Đánh giá", "description": "Đo lường kết quả", "date": "Giai đoạn 3"}]}},
            {"index": 5, "type": "closing", "title": "Xin cảm ơn", "subtitle": "Câu hỏi và thảo luận"},
        ],
        "global_notes": "",
    }
