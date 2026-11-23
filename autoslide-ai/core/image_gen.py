"""Tạo ảnh minh họa tùy chọn qua DALL-E 3.

Chỉ gọi nếu ENABLE_IMAGE_GENERATION=true và OPENAI_API_KEY được cấu hình;
ứng dụng vẫn tạo slide placeholder nếu dịch vụ ảnh không khả dụng.
"""
import os
from pathlib import Path
from openai import OpenAI


def generate_image(prompt: str, destination: str) -> bool:
    if os.getenv("ENABLE_IMAGE_GENERATION", "false").lower() != "true" or not os.getenv("OPENAI_API_KEY"):
        return False
    try:
        result = OpenAI().images.generate(model="dall-e-3", prompt=prompt[:1000], size="1792x1024", quality="standard", n=1)
        import requests
        response = requests.get(result.data[0].url, timeout=30)
        response.raise_for_status()
        Path(destination).write_bytes(response.content)
        return True
    except Exception:
        return False
