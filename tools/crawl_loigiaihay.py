"""
Crawl loigiaihay.com exam pages and extract question figure images.
Fetches HTML with requests, parses img tags, downloads images as local PNGs.

Usage:
    python tools/crawl_loigiaihay.py            # dry-run: print what would be downloaded
    python tools/crawl_loigiaihay.py --apply    # actually download and patch questions.json
"""
import sys
import os
import re
import json
import time
import pathlib
import tempfile
import hashlib
import urllib.request
import urllib.parse
import urllib.error
import ssl
import html

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

QUESTIONS_JSON = pathlib.Path("exam-app/src/data/questions.json")
OUT_DIR = pathlib.Path("exam-app/public/images/questions")
BACKUP = QUESTIONS_JSON.with_suffix(".json.bak_lgh")

# Questions that need images from loigiaihay.com
# Format: question_id -> (exam_id_numeric, question_number)
LGH_TARGETS = {
    "q_lgh_173478_12": (173478, 12),
    "q_lgh_180840_05": (180840, 5),
    "q_lgh_177656_11": (177656, 11),
    "q_lgh_177657_10": (177657, 10),
    "q_lgh_177714_10": (177714, 10),
    "q_lgh_182313_01": (182313, 1),
    "q_lgh_182313_08": (182313, 8),
    "q_lgh_182313_12": (182313, 12),
    "q_lgh_182339_07": (182339, 7),
    "q_lgh_182339_09": (182339, 9),
    "q_lgh_182339_12": (182339, 12),
    "q_lgh_182635_07": (182635, 7),
    "q_lgh_182635_09": (182635, 9),
    "q_lgh_182635_10": (182635, 10),
    "q_lgh_182635_12": (182635, 12),
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://loigiaihay.com/",
}

IMG_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0.0.0 Safari/537.36",
    "Referer": "https://loigiaihay.com/",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}

ctx = ssl.create_default_context()

PAGE_CACHE = {}  # exam_id -> html text


def fetch_page(exam_id: int) -> str | None:
    """Fetch the exam page HTML. Tries several URL slug patterns."""
    if exam_id in PAGE_CACHE:
        return PAGE_CACHE[exam_id]

    # Try different slug patterns - loigiaihay uses slug-aID.html format
    # The actual slug varies but the ID is unique; try a few known patterns
    patterns = [
        f"https://loigiaihay.com/de-thi-hoc-ki-1-toan-9-de-so-1-a{exam_id}.html",
        f"https://loigiaihay.com/de-thi-hoc-ki-1-toan-10-de-so-1-a{exam_id}.html",
        f"https://loigiaihay.com/de-thi-giua-hoc-ki-1-toan-9-de-so-1-a{exam_id}.html",
        f"https://loigiaihay.com/de-thi-giua-hoc-ki-1-toan-10-de-so-1-a{exam_id}.html",
        # Generic fallback using minimal slug
        f"https://loigiaihay.com/de-thi-a{exam_id}.html",
    ]

    for url in patterns:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                if resp.status == 200:
                    final_url = resp.url
                    html_text = resp.read().decode("utf-8", errors="replace")
                    print(f"  FETCH {exam_id}: {final_url} ({len(html_text):,} chars)")
                    PAGE_CACHE[exam_id] = html_text
                    return html_text
        except Exception as e:
            continue

    print(f"  FAIL  {exam_id}: could not fetch page (tried {len(patterns)} patterns)")
    return None


def find_question_images(html_text: str, question_num: int) -> list[str]:
    """
    Parse the page HTML to find img URLs/data-URIs for the given question number.
    Returns list of candidates: external URLs or 'data:image/...' strings.

    loigiaihay.com uses two image formats:
    - External: <img src="https://img.loigiaihay.com/picture/...">
    - Inline:   <img src="data:image/png;base64,...">

    Question headers appear as anchor links: >Câu N</a>
    We anchor only on these (not nav text like "câu 1 đến câu 12").
    """
    # Only match actual question header anchors: ">Câu N</a>"
    # This avoids matching navigation text like "câu 1 đến câu 12"
    cau_re = re.compile(
        r'>C(?:&acirc;|â)u\s*(\d+)\s*</a>',
        re.IGNORECASE | re.UNICODE
    )

    # Match img tags with external loigiaihay src OR base64 data URI
    img_re = re.compile(
        r'<img[^>]+src=["\']'
        r'((?:https?://img\.loigiaihay\.com|https?://img\.tuyensinh247\.com)'
        r'[^"\']{5,300}'
        r'|data:image/[a-z]+;base64,[A-Za-z0-9+/=]{20,})'
        r'["\'][^>]*>',
        re.IGNORECASE
    )

    # Build sorted event list
    events = []
    for m in cau_re.finditer(html_text):
        n = int(m.group(1))
        events.append((m.start(), 'q', n))
    for m in img_re.finditer(html_text):
        src = m.group(1)
        events.append((m.start(), 'img', src))

    events.sort(key=lambda x: x[0])

    # Walk events: collect images between question N header and question N+1 header.
    # Take only images from the FIRST occurrence of question N (the question block,
    # not the later solutions section which would appear under Q(N-1) in the second pass).
    found_imgs = []
    in_target = False
    target_entered_count = 0

    for pos, kind, val in events:
        if kind == 'q':
            if val == question_num:
                target_entered_count += 1
                if target_entered_count == 1:
                    in_target = True
                else:
                    # Second occurrence of this question = solutions section; stop
                    break
            elif in_target and val != question_num:
                # Any other question number closes the window
                break
        elif kind == 'img' and in_target:
            found_imgs.append(val)

    return found_imgs


def save_base64_image(data_uri: str, out_path: pathlib.Path) -> tuple[bool, str]:
    """Decode a data:image/...;base64,... URI and save as PNG."""
    import base64
    try:
        header, encoded = data_uri.split(',', 1)
        raw = base64.b64decode(encoded + '==')  # pad liberally
        is_png = raw[:4] == b'\x89PNG'
        is_jpg = raw[:2] == b'\xff\xd8'
        if not (is_png or is_jpg):
            return False, f"not PNG/JPEG (magic: {raw[:4].hex()})"
        if len(raw) < 1024:
            return False, f"too small: {len(raw)} bytes"

        tmp = out_path.with_suffix(".tmp.b64")
        tmp.write_bytes(raw)
        ok, info = validate_image(tmp)
        if not ok:
            tmp.unlink(missing_ok=True)
            return False, info
        os.replace(str(tmp), str(out_path))
        return True, f"{len(raw):,} bytes base64-PNG"
    except Exception as e:
        return False, str(e)


def validate_image(path: pathlib.Path) -> tuple[bool, str]:
    from PIL import Image
    data = path.read_bytes()
    if data[:4] != b'\x89PNG' and data[:2] != b'\xff\xd8':
        return False, "not PNG/JPEG"
    try:
        img = Image.open(path)
        img.verify()
    except Exception as e:
        return False, f"invalid image: {e}"
    img = Image.open(path)
    if img.width < 20 or img.height < 20:
        return False, f"too small {img.width}x{img.height}"
    return True, f"{img.width}x{img.height}"


def download_image(url: str, out_path: pathlib.Path) -> tuple[bool, str]:
    """Download an image and validate it. Returns (ok, info_or_error)."""
    try:
        req = urllib.request.Request(url, headers=IMG_HEADERS)
        with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
            if resp.status != 200:
                return False, f"HTTP {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            if not any(t in content_type for t in ("image/", "octet-stream")):
                return False, f"wrong content-type: {content_type}"
            data = resp.read()

        if len(data) < 1024:
            return False, f"too small: {len(data)} bytes"

        # Validate PNG or JPEG magic bytes
        is_png = data[:4] == b'\x89PNG'
        is_jpg = data[:2] == b'\xff\xd8'
        if not (is_png or is_jpg):
            return False, f"not PNG/JPEG (magic: {data[:4].hex()})"

        # Write atomically and validate
        tmp = out_path.with_suffix(".tmp.dl")
        tmp.write_bytes(data)
        ok, info = validate_image(tmp)
        if not ok:
            tmp.unlink(missing_ok=True)
            return False, info
        os.replace(str(tmp), str(out_path))

        return True, f"{len(data):,} bytes {'PNG' if is_png else 'JPEG'}"
    except Exception as e:
        return False, str(e)


def main():
    apply = "--apply" in sys.argv
    print(f"Mode: {'APPLY' if apply else 'DRY-RUN'}")
    print(f"Targets: {len(LGH_TARGETS)} questions across {len(set(v[0] for v in LGH_TARGETS.values()))} pages\n")

    # Load questions.json
    questions = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    q_by_id = {q["id"]: q for q in questions}

    results = {}

    # Group targets by exam page
    by_page = {}
    for qid, (exam_id, q_num) in LGH_TARGETS.items():
        by_page.setdefault(exam_id, []).append((qid, q_num))

    for exam_id, targets in sorted(by_page.items()):
        print(f"\n=== Exam {exam_id} ({len(targets)} questions) ===")

        html_text = fetch_page(exam_id)
        if html_text is None:
            for qid, _ in targets:
                results[qid] = "FAIL:no_page"
            continue

        for qid, q_num in sorted(targets, key=lambda x: x[1]):
            out_path = OUT_DIR / f"{qid}.png"

            if out_path.exists():
                print(f"  SKIP  {qid}: already exists")
                results[qid] = "already_exists"
                continue

            imgs = find_question_images(html_text, q_num)
            if not imgs:
                print(f"  MISS  {qid} (Câu {q_num}): no images found in page")
                results[qid] = "FAIL:no_img_found"
                continue

            print(f"  FOUND {qid} (Câu {q_num}): {len(imgs)} candidate(s)")
            for img_url in imgs[:3]:
                print(f"        {img_url}")

            if apply:
                # Try each candidate
                ok = False
                for img_url in imgs:
                    if img_url.startswith("data:"):
                        success, info = save_base64_image(img_url, out_path)
                    else:
                        success, info = download_image(img_url, out_path)
                    if success:
                        print(f"  OK    {qid}: saved {info}")
                        ok = True
                        results[qid] = f"ok:{info}"
                        break
                    else:
                        print(f"  WARN  {qid}: failed {img_url[:60]}: {info}")

                if not ok:
                    results[qid] = "FAIL:download"
            else:
                results[qid] = f"dry:{imgs[0]}"

            time.sleep(1.0)  # polite delay

    if apply:
        # Patch questions.json
        patched = 0
        for qid, status in results.items():
            if status.startswith("ok:"):
                q = q_by_id.get(qid)
                if q:
                    q["image"] = f"/images/questions/{qid}.png"
                    patched += 1

        if patched > 0:
            if not BACKUP.exists():
                BACKUP.write_bytes(QUESTIONS_JSON.read_bytes())
                print(f"\nBackup: {BACKUP}")

            tmp = QUESTIONS_JSON.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
            # Validate round-trip
            json.loads(tmp.read_text(encoding="utf-8"))
            os.replace(str(tmp), str(QUESTIONS_JSON))
            print(f"Patched {patched} questions in {QUESTIONS_JSON}")

    print("\n=== Summary ===")
    for qid, st in sorted(results.items()):
        print(f"  {qid}: {st}")


if __name__ == "__main__":
    main()
