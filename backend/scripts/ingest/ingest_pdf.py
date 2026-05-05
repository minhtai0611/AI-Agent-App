"""Ingest PDF files (or images) into the math wiki via /math-ingest."""
from __future__ import annotations
import argparse
import hashlib
import os
import sys

from pdf_extractor import extract_pdf
from ocr_extractor import ocr_image, ocr_pdf
from http_client import ingest_chunk
from ingest_state import is_ingested, mark_ingested

IMAGE_EXTS = {'.png', '.jpg', '.jpeg'}
PDF_EXT = '.pdf'
OCR_THRESHOLD = 50  # avg chars/page below this triggers OCR fallback


def _source_key(path: str) -> str:
    stat = os.stat(path)
    digest = hashlib.sha256(f"{path}:{stat.st_mtime}".encode()).hexdigest()[:8]
    return f"pdf_{digest}"


def _extract(path: str) -> list[str]:
    ext = os.path.splitext(path)[1].lower()
    if ext in IMAGE_EXTS:
        text = ocr_image(path)
        return [text] if text else []

    # PDF: try text layer first
    chunks = extract_pdf(path)
    if chunks:
        avg_chars = sum(len(c) for c in chunks) / len(chunks)
        if avg_chars >= OCR_THRESHOLD:
            return chunks
        print(f"[OCR fallback] {path} — avg {avg_chars:.0f} chars/chunk below threshold")

    # OCR fallback for image-PDFs
    pages = ocr_pdf(path)
    if not pages:
        return []
    full_text = "\n\n".join(pages)
    return [full_text[i:i + 3000] for i in range(0, len(full_text), 2800)]


def _process_file(path: str, backend_url: str, dry_run: bool) -> None:
    key = _source_key(path)
    if is_ingested(key):
        print(f"[skip] {path} already ingested ({key})")
        return

    chunks = _extract(path)
    if not chunks:
        print(f"[warn] No content extracted from {path}")
        return

    print(f"{path} → {len(chunks)} chunks (key={key})")
    if dry_run:
        return

    total_problems = total_wiki = 0
    try:
        for i, chunk in enumerate(chunks, 1):
            res = ingest_chunk(chunk, backend_url)
            total_problems += res['problems']
            total_wiki += res['wiki_units']
            print(f"  chunk {i}/{len(chunks)} → {res['problems']} problems, {res['wiki_units']} wiki_units")
        mark_ingested(key)
        print(f"  done: {total_problems} problems, {total_wiki} wiki_units total")
    except Exception as e:
        print(f"  [ERROR] {path}: {e}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest PDF or image into math wiki")
    parser.add_argument("path", help="PDF/image file or directory")
    parser.add_argument("--backend-url", default="http://localhost:8000")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    target = args.path
    if os.path.isdir(target):
        files = [
            os.path.join(target, f)
            for f in os.listdir(target)
            if os.path.splitext(f)[1].lower() in IMAGE_EXTS | {PDF_EXT}
        ]
    elif os.path.isfile(target):
        files = [target]
    else:
        print(f"[ERROR] Path not found: {target}", file=sys.stderr)
        sys.exit(1)

    for f in sorted(files):
        _process_file(f, args.backend_url, args.dry_run)


if __name__ == "__main__":
    main()
