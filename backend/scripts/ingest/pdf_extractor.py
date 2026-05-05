"""Extract text from PDF files, chunked with optional overlap."""
from __future__ import annotations
import sys


def extract_pdf(path: str, chunk_size: int = 3000, overlap: int = 200) -> list[str]:
    try:
        from pypdf import PdfReader
    except ImportError:
        print("[WARN] pypdf not installed — run: pip install pypdf", file=sys.stderr)
        return []

    reader = PdfReader(path)
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append(text)

    if not pages:
        print(f"[WARN] No text extracted from {path} — may be image-only PDF", file=sys.stderr)
        return []

    full_text = "\n\n".join(pages)
    chunks = []
    start = 0
    while start < len(full_text):
        end = start + chunk_size
        chunks.append(full_text[start:end])
        start = end - overlap if end < len(full_text) else len(full_text)
    return chunks
