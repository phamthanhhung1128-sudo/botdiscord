"""Kết xuất JSON slide spec thành tệp PowerPoint có thể mở/chỉnh sửa."""
from io import BytesIO
from pathlib import Path
import tempfile
from urllib.parse import urlparse

import requests
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


class PPTBuilder:
    def __init__(self, spec: dict):
        self.spec = spec or {}
        self.meta = self.spec.get("meta", {})
        self.prs = Presentation()
        self.wide = self.meta.get("slide_size", "16:9") != "4:3"
        self.prs.slide_width = Inches(13.333 if self.wide else 10)
        self.prs.slide_height = Inches(7.5 if self.wide else 7.5)
        self.primary = self._color(self.meta.get("primary_color", "#6366F1"), (99, 102, 241))
        self.secondary = self._color(self.meta.get("secondary_color", "#8B5CF6"), (139, 92, 246))
        self.dark = self.meta.get("theme") == "dark"
        self.bg = RGBColor(15, 23, 42) if self.dark else RGBColor(248, 250, 252)
        self.fg = RGBColor(241, 245, 249) if self.dark else RGBColor(30, 41, 59)
        self.muted = RGBColor(148, 163, 184) if self.dark else RGBColor(100, 116, 139)
        self.font_title = self.meta.get("font_title", "Arial")
        self.font_body = self.meta.get("font_body", "Calibri")
        self.slide_count = max(len(self.spec.get("slides", [])), 1)

    @staticmethod
    def _color(value, fallback=(99, 102, 241)):
        try:
            h = str(value).lstrip("#")
            if len(h) == 3:
                h = "".join(c * 2 for c in h)
            return RGBColor(*(int(h[i:i+2], 16) for i in (0, 2, 4)))
        except (ValueError, TypeError):
            return RGBColor(*fallback)

    def build(self) -> bytes:
        layout = self.prs.slide_layouts[6]
        slides = self.spec.get("slides") or [{"type": "title", "title": self.meta.get("title", "AutoSlide AI")}]
        for index, data in enumerate(slides, 1):
            slide = self.prs.slides.add_slide(layout)
            self._apply_theme(slide)
            kind = data.get("type", "content")
            try:
                if kind == "title": self._create_title_slide(slide, data)
                elif kind == "two_column": self._create_two_column(slide, data)
                elif kind == "table": self._create_table_slide(slide, data)
                elif kind == "chart": self._create_chart_slide(slide, data)
                elif kind in {"timeline", "org_chart", "flowchart"}: self._create_diagram_slide(slide, data)
                elif kind == "quote": self._create_quote_slide(slide, data)
                elif kind in {"image_right", "image_full"}: self._create_image_slide(slide, data)
                elif kind == "closing": self._create_closing_slide(slide, data)
                else: self._create_content_slide(slide, data)
            except Exception:
                # Một cấu trúc lạ không được làm hỏng cả tệp: trình bày nội dung dạng bullet.
                self._create_content_slide(slide, data)
            self._add_footer(slide, index)
            self._add_speaker_notes(slide, data.get("speaker_notes", ""))
        out = BytesIO()
        self.prs.save(out)
        return out.getvalue()

    def _apply_theme(self, slide):
        fill = slide.background.fill
        fill.solid()
        fill.fore_color.rgb = self.bg

    def _textbox(self, slide, x, y, w, h, text, size=18, color=None, bold=False,
                 font=None, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, margin=0.04):
        shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = shape.text_frame
        tf.clear()
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = Inches(margin)
        tf.margin_top = tf.margin_bottom = Inches(margin)
        tf.vertical_anchor = valign
        p = tf.paragraphs[0]
        p.alignment = align
        p.space_after = Pt(4)
        run = p.add_run()
        run.text = str(text or "")
        run.font.name = font or self.font_body
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color or self.fg
        return shape

    def _add_heading(self, slide, title):
        self._textbox(slide, .62, .42, 12.05, .65, title, 30, self.fg, True, self.font_title)
        accent = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(.66), Inches(1.18), Inches(.8), Inches(.055))
        accent.fill.solid(); accent.fill.fore_color.rgb = self.primary
        accent.line.fill.background()

    def _create_title_slide(self, slide, d):
        # Accent block and centered typography for the cover.
        bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(.65), Inches(2.25), Inches(.12), Inches(2.25))
        bar.fill.solid(); bar.fill.fore_color.rgb = self.primary; bar.line.fill.background()
        self._textbox(slide, 1.05, 2.35, 10.9, 1.4, d.get("title", self.meta.get("title", "Bài thuyết trình")), 32, self.fg, True, self.font_title, valign=MSO_ANCHOR.MIDDLE)
        self._textbox(slide, 1.08, 3.9, 10.6, .8, d.get("subtitle", ""), 20, self.muted)
        self._textbox(slide, 1.08, 5.2, 8, .35, self.meta.get("author", ""), 13, self.muted)

    def _create_content_slide(self, slide, d):
        self._add_heading(slide, d.get("title", ""))
        bullets = d.get("bullets") or ([d.get("subtitle")] if d.get("subtitle") else [])
        top = 1.65
        for i, item in enumerate(bullets[:7]):
            y = top + i * .72
            dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(.82), Inches(y + .11), Inches(.13), Inches(.13))
            dot.fill.solid(); dot.fill.fore_color.rgb = self.primary; dot.line.fill.background()
            self._textbox(slide, 1.12, y, 11.2, .55, item, 18, self.fg)

    def _create_two_column(self, slide, d):
        self._add_heading(slide, d.get("title", ""))
        for x, title, values in [(0.7, d.get("left_title", "Điểm chính"), d.get("left_column", [])), (6.85, d.get("right_title", "Hướng triển khai"), d.get("right_column", []))]:
            card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(1.65), Inches(5.75), Inches(4.9))
            card.fill.solid(); card.fill.fore_color.rgb = RGBColor(30, 41, 59) if self.dark else RGBColor(255, 255, 255)
            card.line.color.rgb = self._color("#334155" if self.dark else "#E2E8F0")
            self._textbox(slide, x + .28, 1.92, 5.1, .45, title, 20, self.primary, True)
            for i, text in enumerate(values[:6]):
                self._textbox(slide, x + .3, 2.55 + i * .58, 5.05, .48, f"•  {text}", 16, self.fg)

    def _create_table_slide(self, slide, d):
        self._add_heading(slide, d.get("title", "Bảng so sánh"))
        table_data = d.get("table") or {}
        headers = [str(x) for x in (table_data.get("headers") or ["Hạng mục", "Thông tin"])]
        rows = table_data.get("rows") or []
        count_cols = max(len(headers), max((len(r) for r in rows), default=0))
        headers += [f"Cột {i+1}" for i in range(len(headers), count_cols)]
        rows = [list(map(str, r)) + [""] * (count_cols-len(r)) for r in rows[:8]]
        row_count = 1 + len(rows)
        table_shape = slide.shapes.add_table(row_count, count_cols, Inches(.65), Inches(1.65), Inches(12.0), Inches(min(4.65, .52 * row_count))).table
        for ci in range(count_cols): table_shape.columns[ci].width = Inches(12.0 / count_cols)
        for ri in range(row_count):
            for ci in range(count_cols):
                cell = table_shape.cell(ri, ci)
                cell.text = headers[ci] if ri == 0 else (rows[ri-1][ci] if ci < len(rows[ri-1]) else "")
                cell.fill.solid()
                cell.fill.fore_color.rgb = self.primary if ri == 0 else (RGBColor(30,41,59) if self.dark and ri % 2 else RGBColor(51,65,85) if self.dark else RGBColor(255,255,255) if ri % 2 else RGBColor(241,245,249))
                cell.margin_left = cell.margin_right = Inches(.1)
                for p in cell.text_frame.paragraphs:
                    for run in p.runs:
                        run.font.name = self.font_body; run.font.size = Pt(14); run.font.bold = ri == 0
                        run.font.color.rgb = RGBColor(255,255,255) if ri == 0 else self.fg
        if table_data.get("caption"):
            self._textbox(slide, .72, 6.42, 11.5, .35, table_data["caption"], 12, self.muted)

    def _create_chart_slide(self, slide, d):
        self._add_heading(slide, d.get("title", "Biểu đồ"))
        chart = d.get("chart") or {}
        labels = [str(x) for x in chart.get("labels", [])]
        values = [float(x) for x in chart.get("values", [])]
        if not labels or len(labels) != len(values):
            labels, values = ["A", "B", "C"], [30, 45, 25]
        data = CategoryChartData(); data.categories = labels; data.add_series(chart.get("title_chart", "Dữ liệu"), values)
        types = {"bar": XL_CHART_TYPE.COLUMN_CLUSTERED, "pie": XL_CHART_TYPE.PIE, "line": XL_CHART_TYPE.LINE}
        shape = slide.shapes.add_chart(types.get(chart.get("chart_type"), XL_CHART_TYPE.COLUMN_CLUSTERED), Inches(1.0), Inches(1.55), Inches(11.2), Inches(4.9), data)
        ch = shape.chart
        ch.has_legend = chart.get("chart_type") == "pie"
        if ch.has_legend:
            ch.legend.position = XL_LEGEND_POSITION.BOTTOM
        ch.has_title = bool(chart.get("title_chart"))
        if ch.has_title: ch.chart_title.text_frame.text = chart["title_chart"]

    def _create_diagram_slide(self, slide, d):
        self._add_heading(slide, d.get("title", "Sơ đồ"))
        dia = d.get("diagram") or {}
        items = (dia.get("items") or [])[:7]
        if not items:
            items = [{"label": "Bước 1", "description": "Xác định mục tiêu"}, {"label": "Bước 2", "description": "Triển khai giải pháp"}, {"label": "Bước 3", "description": "Đánh giá kết quả"}]
        kind = dia.get("diagram_type", d.get("type", "flowchart"))
        if kind == "org_chart" or d.get("type") == "org_chart":
            # Nếu AI gửi children thì giữ cấu trúc phân cấp; nếu không, coi phần tử đầu là cấp quản lý.
            root = dict(items[0])
            if not root.get("children") and len(items) > 1:
                root["children"] = [dict(item) for item in items[1:]]
            def leaves(node):
                children = node.get("children") or []
                return sum(leaves(child) for child in children) if children else 1
            def draw_node(node, depth, left, right, center):
                y = 1.72 + depth * 1.72
                width = min(2.35, max(1.45, right - left - .16))
                x = max(.62, min(12.70 - width, center - width / 2))
                children = node.get("children") or []
                if children and depth < 2:
                    branch_y = y + .99
                    child_y = y + 1.72
                    centers, cursor = [], left
                    total = sum(leaves(child) for child in children)
                    span = right - left
                    for child in children:
                        child_span = span * leaves(child) / total
                        centers.append((cursor + child_span / 2, cursor, cursor + child_span))
                        cursor += child_span
                    vertical = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(center), Inches(y + .78), Inches(center), Inches(branch_y))
                    vertical.line.color.rgb = self.primary; vertical.line.width = Pt(1.6)
                    if len(centers) > 1:
                        horizontal = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(centers[0][0]), Inches(branch_y), Inches(centers[-1][0]), Inches(branch_y))
                        horizontal.line.color.rgb = self.primary; horizontal.line.width = Pt(1.6)
                    for child_center, child_left, child_right in centers:
                        connector = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(child_center), Inches(branch_y), Inches(child_center), Inches(child_y))
                        connector.line.color.rgb = self.primary; connector.line.width = Pt(1.6)
                        draw_node(child, depth + 1, child_left, child_right, child_center)
                box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(width), Inches(.82))
                box.fill.solid(); box.fill.fore_color.rgb = self.primary if depth == 0 else (RGBColor(30,41,59) if self.dark else RGBColor(255,255,255))
                box.line.color.rgb = self.primary
                text_color = RGBColor(255,255,255) if depth == 0 else self.fg
                self._textbox(slide, x+.08, y+.13, width-.16, .3, node.get("label", ""), 14, text_color, True, align=PP_ALIGN.CENTER)
                if node.get("description"):
                    self._textbox(slide, x+.08, y+.46, width-.16, .25, node["description"], 9, RGBColor(225,225,255) if depth == 0 else self.muted, align=PP_ALIGN.CENTER)
            draw_node(root, 0, .75, 12.58, 6.66)
            return
        if kind == "timeline" or d.get("type") == "timeline":
            y = 3.35
            line = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(1.05), Inches(y), Inches(12.25), Inches(y))
            line.line.color.rgb = self.primary; line.line.width = Pt(3)
            step = 10.9 / max(len(items)-1, 1)
            for i, item in enumerate(items):
                x = .95 + i * step
                dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y-.13), Inches(.28), Inches(.28))
                dot.fill.solid(); dot.fill.fore_color.rgb = self.primary; dot.line.fill.background()
                self._textbox(slide, x-.25, 2.3, 2.5, .62, item.get("label", ""), 16, self.fg, True, align=PP_ALIGN.CENTER)
                self._textbox(slide, x-.45, 3.85, 2.9, .7, item.get("description", item.get("date", "")), 13, self.muted, align=PP_ALIGN.CENTER)
                if item.get("date"):
                    self._textbox(slide, x-.25, 4.55, 2.5, .4, item["date"], 12, self.primary, True, align=PP_ALIGN.CENTER)
        else:
            cols = min(len(items), 4)
            width = 11.7 / cols
            for i, item in enumerate(items):
                x = .72 + i * width
                box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(2.5), Inches(width-.45), Inches(1.55))
                box.fill.solid(); box.fill.fore_color.rgb = RGBColor(30,41,59) if self.dark else RGBColor(255,255,255)
                box.line.color.rgb = self.primary
                self._textbox(slide, x+.1, 2.72, width-.65, .5, item.get("label", ""), 16, self.primary, True, align=PP_ALIGN.CENTER)
                self._textbox(slide, x+.12, 3.28, width-.68, .62, item.get("description", ""), 12, self.fg, align=PP_ALIGN.CENTER)
                if i < cols-1:
                    arrow = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x+width-.44), Inches(3.02), Inches(.42), Inches(.28))
                    arrow.fill.solid(); arrow.fill.fore_color.rgb = self.primary; arrow.line.fill.background()

    def _create_quote_slide(self, slide, d):
        self._add_heading(slide, d.get("title", "Trích dẫn"))
        quote = d.get("quote") or {}
        self._textbox(slide, 1.05, 2.0, 11.1, 2.3, f'“{quote.get("text", d.get("subtitle", ""))}”', 27, self.fg, True, self.font_title, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
        self._textbox(slide, 2, 4.65, 9.3, .5, quote.get("author", ""), 16, self.primary, align=PP_ALIGN.CENTER)

    def _create_image_slide(self, slide, d):
        self._add_heading(slide, d.get("title", "Hình ảnh minh họa"))
        image_url = d.get("image_url", "")
        inserted = False
        # Chỉ tải từ miền ảnh phổ biến, dùng timeout/giới hạn bytes để tránh SSRF và file quá lớn.
        try:
            parsed = urlparse(image_url)
            if parsed.scheme == "https" and parsed.hostname in {"images.unsplash.com", "plus.unsplash.com"}:
                response = requests.get(image_url, timeout=5, stream=True, allow_redirects=False)
                response.raise_for_status()
                data = response.raw.read(5 * 1024 * 1024 + 1)
                if len(data) <= 5 * 1024 * 1024:
                    slide.shapes.add_picture(BytesIO(data), Inches(6.2 if d.get("type") == "image_right" else .7), Inches(1.55), width=Inches(6.1 if d.get("type") == "image_right" else 12))
                    inserted = True
        except Exception:
            pass
        if not inserted and d.get("image_prompt"):
            try:
                from .image_gen import generate_image
                with tempfile.TemporaryDirectory() as temporary_dir:
                    generated_path = Path(temporary_dir) / "slide-image.png"
                    if generate_image(d["image_prompt"], str(generated_path)):
                        x = 6.2 if d.get("type") == "image_right" else .7
                        width = 6.1 if d.get("type") == "image_right" else 12
                        slide.shapes.add_picture(str(generated_path), Inches(x), Inches(1.55), width=Inches(width))
                        inserted = True
            except Exception:
                pass
        if d.get("type") == "image_right":
            self._textbox(slide, .75, 1.8, 5.0, 3.6, "•  " + "\n•  ".join(d.get("bullets", [])[:5]), 18, self.fg)
        if not inserted:
            x, w = (6.2, 6.05) if d.get("type") == "image_right" else (.75, 11.8)
            placeholder = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(1.65), Inches(w), Inches(4.65))
            placeholder.fill.solid(); placeholder.fill.fore_color.rgb = RGBColor(30,41,59) if self.dark else RGBColor(226,232,240)
            placeholder.line.color.rgb = self._color("#475569")
            prompt = d.get("image_prompt") or "Hình ảnh minh họa"
            self._textbox(slide, x+.35, 3.15, w-.7, 1.3, f"AI Image\n{prompt[:220]}", 14, self.muted, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
        if d.get("type") == "image_full" and d.get("bullets"):
            self._textbox(slide, .9, 6.2, 11.3, .4, " · ".join(d["bullets"][:3]), 13, self.fg)

    def _create_closing_slide(self, slide, d):
        self._textbox(slide, 1, 2.35, 11.3, 1.25, d.get("title", "Xin cảm ơn"), 32, self.fg, True, self.font_title, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
        self._textbox(slide, 1.2, 3.8, 10.9, .7, d.get("subtitle", "Câu hỏi và thảo luận"), 20, self.primary, align=PP_ALIGN.CENTER)

    def _add_footer(self, slide, index):
        self._textbox(slide, 11.9, 7.08, .8, .22, f"{index:02d} / {self.slide_count:02d}", 9, self.muted, align=PP_ALIGN.RIGHT)

    @staticmethod
    def _add_speaker_notes(slide, notes_text):
        if notes_text:
            try:
                slide.notes_slide.notes_text_frame.text = str(notes_text)
            except (AttributeError, ValueError):
                pass
