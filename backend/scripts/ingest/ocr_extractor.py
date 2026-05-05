"""OCR text extraction using Tesseract (Vietnamese language model required)."""
from __future__ import annotations
import sys


def ocr_image(path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        print("[WARN] pytesseract/Pillow not installed", file=sys.stderr)
        return ""
    try:
        img = Image.open(path)
        return pytesseract.image_to_string(img, lang="vie")
    except Exception as e:
        print(f"[WARN] OCR failed for {path}: {e}", file=sys.stderr)
        return ""


def ocr_pdf(path: str) -> list[str]:
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError:
        print("[WARN] pytesseract/pdf2image not installed", file=sys.stderr)
        return []
    try:
        images = convert_from_path(path)
        return [pytesseract.image_to_string(img, lang="vie") for img in images]
    except Exception as e:
        print(f"[WARN] OCR PDF failed for {path}: {e}", file=sys.stderr)
        return []
