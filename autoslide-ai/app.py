"""Ứng dụng Flask AutoSlide AI."""
from collections import defaultdict, deque
import os
import re
import time
import uuid
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, render_template, request, send_from_directory, url_for
from werkzeug.utils import secure_filename

from config import Config
from core.ai_parser import parse_user_request
from core.file_reader import extract_text_from_file
from core.ppt_builder import PPTBuilder
from models import db, History


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["OUTPUT_FOLDER"]).mkdir(parents=True, exist_ok=True)
    db.init_app(app)
    with app.app_context():
        db.create_all()

    # Giới hạn dùng chung cho mọi endpoint API theo IP: tối đa 5 request/60 giây.
    request_windows = defaultdict(deque)
    rate_lock = Lock()
    @app.before_request
    def api_rate_limit():
        if not request.path.startswith("/api/"):
            return None
        now = time.monotonic()
        key = request.remote_addr or "unknown"
        with rate_lock:
            history = request_windows[key]
            while history and history[0] <= now - 60:
                history.popleft()
            if len(history) >= 5:
                response = jsonify({"error": "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại."})
                response.status_code = 429
                response.headers["Retry-After"] = "60"
                return response
            history.append(now)
        return None

    def get_uploaded_text(file_id):
        if not file_id:
            return ""
        # file_id là basename UUID ngẫu nhiên, không cho phép path traversal.
        if not re.fullmatch(r"[0-9a-f-]{36}\.(docx|pdf|txt)", str(file_id), re.I):
            raise ValueError("Mã tệp không hợp lệ.")
        path = Path(app.config["UPLOAD_FOLDER"]) / file_id
        if not path.is_file():
            raise ValueError("Không tìm thấy tệp đã tải lên. Vui lòng tải lại.")
        return extract_text_from_file(str(path))

    def json_error(message, status=400):
        return jsonify({"error": message}), status

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.post("/api/chat")
    def chat():
        try:
            payload = request.get_json(silent=True) or {}
            message = str(payload.get("message", "")).strip()
            file_id = payload.get("file_id")
            if not message and not file_id:
                return json_error("Hãy nhập yêu cầu hoặc tải lên một tài liệu.")
            text = get_uploaded_text(file_id)
            spec = parse_user_request(message, text, app.config.get("OPENAI_API_KEY"), app.config.get("OPENAI_MODEL", "gpt-4o"))
            return jsonify({"spec": spec, "message": "Đã phân tích cấu trúc slide.", "ai_configured": bool(app.config.get("OPENAI_API_KEY"))})
        except ValueError as exc:
            return json_error(str(exc), 400)
        except Exception:
            app.logger.exception("Lỗi phân tích yêu cầu")
            return json_error("Không thể phân tích yêu cầu lúc này. Vui lòng thử lại.", 500)

    @app.post("/api/generate")
    def generate():
        try:
            payload = request.get_json(silent=True) or {}
            message = str(payload.get("message", "")).strip()
            file_id = payload.get("file_id")
            spec = payload.get("spec")
            if not spec:
                if not message and not file_id:
                    return json_error("Hãy nhập yêu cầu hoặc tải lên một tài liệu.")
                spec = parse_user_request(message, get_uploaded_text(file_id), app.config.get("OPENAI_API_KEY"), app.config.get("OPENAI_MODEL", "gpt-4o"))
            if not isinstance(spec, dict) or not isinstance(spec.get("slides"), list) or not spec["slides"]:
                return json_error("Cấu trúc slide không hợp lệ. Hãy xem trước lại.")
            content = PPTBuilder(spec).build()
            output_id = str(uuid.uuid4())
            filename = f"autoslide-{output_id}.pptx"
            output_path = Path(app.config["OUTPUT_FOLDER"]) / filename
            output_path.write_bytes(content)
            record = History(id=output_id, user_input=message or "Tạo từ tài liệu", json_spec=spec,
                             file_path=str(output_path), filename=filename, status="completed")
            db.session.add(record)
            db.session.commit()
            return jsonify({"download_url": url_for("download", filename=filename), "filename": filename,
                            "size_bytes": len(content), "spec": spec})
        except ValueError as exc:
            return json_error(str(exc), 400)
        except Exception:
            db.session.rollback()
            app.logger.exception("Lỗi tạo tệp PowerPoint")
            return json_error("Không thể tạo PowerPoint. Vui lòng kiểm tra dữ liệu và thử lại.", 500)

    @app.post("/api/upload")
    def upload():
        try:
            uploaded = request.files.get("file")
            if not uploaded or not uploaded.filename:
                return json_error("Vui lòng chọn tệp cần tải lên.")
            original = secure_filename(uploaded.filename)
            ext = original.rsplit(".", 1)[-1].lower() if "." in original else ""
            if ext not in app.config["ALLOWED_EXTENSIONS"]:
                return json_error("Chỉ chấp nhận tệp .docx, .pdf hoặc .txt.")
            file_id = f"{uuid.uuid4()}.{ext}"
            target = Path(app.config["UPLOAD_FOLDER"]) / file_id
            uploaded.save(target)
            if target.stat().st_size > app.config["MAX_CONTENT_LENGTH"]:
                target.unlink(missing_ok=True)
                return json_error("Kích thước tệp vượt quá giới hạn 10 MB.", 413)
            text = extract_text_from_file(str(target))
            return jsonify({"file_id": file_id, "filename": original, "text_preview": text[:1200], "characters": len(text)})
        except ValueError as exc:
            return json_error(str(exc))
        except Exception as exc:
            app.logger.exception("Lỗi đọc tệp tải lên")
            return json_error("Không đọc được tệp. Hãy kiểm tra định dạng và thử lại.", 400)

    @app.get("/api/download/<filename>")
    def download(filename):
        if not re.fullmatch(r"autoslide-[0-9a-f-]{36}\.pptx", filename, re.I):
            return json_error("Không tìm thấy tệp.", 404)
        return send_from_directory(app.config["OUTPUT_FOLDER"], filename, as_attachment=True, download_name=filename)

    @app.get("/api/history")
    def history():
        try:
            records = History.query.order_by(History.created_at.desc()).limit(50).all()
            return jsonify({"history": [{"id": row.id, "user_input": row.user_input, "filename": row.filename,
                                         "download_url": url_for("download", filename=row.filename), "status": row.status,
                                         "created_at": row.created_at.isoformat() if row.created_at else None,
                                         "slide_count": len((row.json_spec or {}).get("slides", []))} for row in records]})
        except Exception:
            app.logger.exception("Lỗi đọc lịch sử")
            return json_error("Không thể tải lịch sử.", 500)

    @app.errorhandler(413)
    def too_large(_error):
        return json_error("Tệp tải lên vượt quá giới hạn 10 MB.", 413)

    @app.errorhandler(429)
    def rate_limited(_error):
        return json_error("Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.", 429)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
