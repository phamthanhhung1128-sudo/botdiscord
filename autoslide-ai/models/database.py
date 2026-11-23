"""Các bảng SQLite dùng bởi AutoSlide AI."""
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func


db = SQLAlchemy()


class History(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    user_input = db.Column(db.Text, nullable=False, default="")
    json_spec = db.Column(db.JSON, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="completed")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())


class Template(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    config = db.Column(db.JSON, nullable=False)
