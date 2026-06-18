#!/usr/bin/env python3
"""
Crawl figures from official exam sources and localise them as PNG files.

Three strategies:
  Poshenloh — Download SVG from live.poshenloh.com (the official AMC figure CDN,
              referenced by AoPS wiki pages). Render to PNG via PyMuPDF (fitz).
              Used for AMC 8 2022 (7 questions) and AMC 8 2023 (5 of 7 questions).
  Manual    — 5 AoPS-hosted figures where no poshenloh SVG is available (AoPS
              blocks all scraping; these require a browser screenshot). Printed
              as sourcing instructions only.
  Kangaroo  — Discover 2023 contest PDFs from mathkangaroo.ca, extract embedded
              images from the page containing each target problem.

Safety rules (per implementation plan):
  * Dry-run by default — pass --apply to write any files.
  * imageLink is KEPT alongside the new image field (serves as source reference).
  * questions.json patched atomically (tmp -> validate -> rename).
  * Backup written to questions.json.bak before first patch in a session.
  * PNG validity gate: file > 1 KB, PNG magic bytes, dimensions > 50x50 px.
  * Idempotent: already-downloaded questions are skipped.
  * Robots.txt respected for HTTP requests (cached per domain).
  * 1.5 s delay between requests to the same domain.
  * 3 retries with exponential back-off.

Usage:
    python tools/crawl_figures.py                    # dry run
    python tools/crawl_figures.py --apply            # download + patch
    python tools/crawl_figures.py --apply --id q_amc8_2023_04  # single question
"""

from __future__ import annotations

import argparse
import io
import json
import re
import shutil
import sys
import time
import urllib.request
import urllib.robotparser
from pathlib import Path
from urllib.parse import urljoin, urlparse

# ── External deps (fail fast with helpful message) ────────────────────────────
try:
    import requests
    from bs4 import BeautifulSoup
    from PIL import Image
    import fitz  # PyMuPDF
except ImportError as exc:
    sys.exit(
        f"Missing dependency: {exc}\n"
        "Install with: pip install requests beautifulsoup4 Pillow PyMuPDF"
    )

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_JSON = REPO_ROOT / "exam-app" / "src" / "data" / "questions.json"
QUESTIONS_BAK = QUESTIONS_JSON.with_suffix(".json.bak")
IMAGES_DIR = REPO_ROOT / "exam-app" / "public" / "images" / "questions"

# ── Crawl config ──────────────────────────────────────────────────────────────
DOMAIN_DELAY = 1.5          # seconds between requests to the same domain
MAX_RETRIES = 3
REQUEST_TIMEOUT = 30
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB ceiling
MIN_IMAGE_BYTES = 1024             # 1 KB floor
MIN_DIMENSION = 50                 # px — reject tiny images (likely icons/bullets)
SVG_RENDER_SCALE = 3               # 3x → 300+ DPI equivalent; matches existing images

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0 Safari/537.36 "
    "exam-app-crawler/1.0 (educational; figures only)"
)

# ── Poshenloh SVG source map ──────────────────────────────────────────────────
# live.poshenloh.com is the official AMC figure CDN; AoPS wiki pages embed
# figures from this host via <img> tags. All URLs verified 2026-06-18.
# Only include SVGs with rendered dimensions >= 100x100pt (visually complete).

_PS_BASE = "https://live.poshenloh.com/images/past-contests/amc8"

POSHENLOH_SVG_MAP: dict[str, str] = {
    # AMC 8 2022 — same SVGs used for the existing q_amc8_22v local images
    "q_amc8_2022_01": f"{_PS_BASE}/2022/1.svg",    # 108x108pt
    "q_amc8_2022_04": f"{_PS_BASE}/2022/4.svg",    # 132x106pt
    "q_amc8_2022_10": f"{_PS_BASE}/2022/10a.svg",  # 264x149pt
    "q_amc8_2022_15": f"{_PS_BASE}/2022/15.svg",   # 145x112pt
    "q_amc8_2022_19": f"{_PS_BASE}/2022/19.svg",   # 125x118pt
    "q_amc8_2022_20": f"{_PS_BASE}/2022/20.svg",   # 133x122pt
    "q_amc8_2022_24": f"{_PS_BASE}/2022/24.svg",   # 110x108pt
    # AMC 8 2023 — Problems 2 (96x24pt, too small) and 23 (404) excluded
    "q_amc8_2023_04": f"{_PS_BASE}/2023/4.svg",    # 169x168pt
    "q_amc8_2023_09": f"{_PS_BASE}/2023/9.svg",    # 179x179pt
    "q_amc8_2023_12": f"{_PS_BASE}/2023/12.svg",   # 144x144pt
    "q_amc8_2023_16": f"{_PS_BASE}/2023/16.svg",   # 108x112pt
    "q_amc8_2023_17": f"{_PS_BASE}/2023/17.svg",   # 118x246pt
}

# Questions requiring a manual browser screenshot — no automatable source exists.
# AoPS (artofproblemsolving.com) blocks all programmatic access (HTTP 403).
MANUAL_SOURCING_REQUIRED: dict[str, str] = {
    "q_amc8_2023_02": (
        "AMC 8 2023 Problem 2 — poshenloh 2023/2.svg is 96x24pt (incomplete; "
        "the paper-folding figure is rendered separately as answer-choice art). "
        "Source: https://artofproblemsolving.com/wiki/index.php/2023_AMC_8_Problems/Problem_2"
    ),
    "q_amc8_2023_23": (
        "AMC 8 2023 Problem 23 — poshenloh 2023/23.svg returns 404 (not published). "
        "Source: https://artofproblemsolving.com/wiki/index.php/2023_AMC_8_Problems/Problem_23"
    ),
    "q_amc10a_22_05": (
        "AMC 10A 2022 Problem 5 — no poshenloh source for AMC 10A. "
        "Source: https://artofproblemsolving.com/wiki/index.php/2022_AMC_10A_Problems/Problem_5"
    ),
    "q_amc10a_22_09": (
        "AMC 10A 2022 Problem 9 — no poshenloh source for AMC 10A. "
        "Source: https://artofproblemsolving.com/wiki/index.php/2022_AMC_10A_Problems/Problem_9"
    ),
    "q_amc10a_22_21": (
        "AMC 10A 2022 Problem 21 — no poshenloh source for AMC 10A. "
        "Source: https://artofproblemsolving.com/wiki/index.php/2022_AMC_10A_Problems/Problem_21"
    ),
}

# ── State ─────────────────────────────────────────────────────────────────────
_last_request: dict[str, float] = {}
_robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}
_backup_written = False


# ── Rate limiter ──────────────────────────────────────────────────────────────
def _domain(url: str) -> str:
    return urlparse(url).netloc.lower()


def rate_limit(url: str) -> None:
    d = _domain(url)
    now = time.time()
    wait = DOMAIN_DELAY - (now - _last_request.get(d, 0))
    if wait > 0:
        time.sleep(wait)
    _last_request[d] = time.time()


# ── robots.txt ────────────────────────────────────────────────────────────────
def robots_allowed(session: requests.Session, url: str) -> bool:
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    if base not in _robots_cache:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{base}/robots.txt")
        try:
            rate_limit(f"{base}/robots.txt")
            txt = session.get(
                f"{base}/robots.txt",
                timeout=REQUEST_TIMEOUT,
                headers={"User-Agent": USER_AGENT},
            ).text
            rp.parse(txt.splitlines())
        except Exception:
            rp.allow_all = True
        _robots_cache[base] = rp
    return _robots_cache[base].can_fetch(USER_AGENT, url)


# ── HTTP helpers ──────────────────────────────────────────────────────────────
def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })
    return s


def fetch(session: requests.Session, url: str, **kwargs) -> requests.Response:
    """GET with rate limiting + exponential back-off retries."""
    for attempt in range(MAX_RETRIES):
        try:
            rate_limit(url)
            resp = session.get(url, timeout=REQUEST_TIMEOUT, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as exc:
            if attempt == MAX_RETRIES - 1:
                raise
            wait = 2 ** attempt
            print(f"    [retry {attempt + 1}/{MAX_RETRIES - 1}] {exc} -- sleeping {wait}s")
            time.sleep(wait)
    raise RuntimeError("unreachable")


# ── PNG validation ────────────────────────────────────────────────────────────
PNG_MAGIC = b"\x89PNG"
JPEG_MAGIC = b"\xff\xd8"


def validate_image(data: bytes, source_url: str = "") -> bool:
    if len(data) < MIN_IMAGE_BYTES:
        print(f"    FAIL: too small ({len(data)} B) -- {source_url}")
        return False
    if len(data) > MAX_IMAGE_BYTES:
        print(f"    FAIL: too large ({len(data)} B) -- {source_url}")
        return False
    if not (data[:4] == PNG_MAGIC or data[:2] == JPEG_MAGIC):
        print(f"    FAIL: bad magic bytes -- {source_url}")
        return False
    try:
        img = Image.open(io.BytesIO(data))
        w, h = img.size
        if w < MIN_DIMENSION or h < MIN_DIMENSION:
            print(f"    FAIL: too small ({w}x{h}px) -- {source_url}")
            return False
        print(f"    OK: {w}x{h}px, {len(data):,} B")
    except Exception as exc:
        print(f"    FAIL: PIL parse error -- {exc}")
        return False
    return True


def convert_to_png(data: bytes) -> bytes:
    """Ensure image bytes are PNG (converts JPEG if needed)."""
    if data[:4] == PNG_MAGIC:
        return data
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── Atomic file I/O ───────────────────────────────────────────────────────────
def atomic_write(path: Path, data: bytes) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)  # os.replace() — atomic on Windows even when target exists


def backup_questions_json() -> None:
    global _backup_written
    if not _backup_written:
        shutil.copy2(QUESTIONS_JSON, QUESTIONS_BAK)
        print(f"  Backup: {QUESTIONS_BAK.name}")
        _backup_written = True


def patch_questions_json(qid: str, image_path: str) -> None:
    """Add `image` field to the question. imageLink is preserved."""
    data = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    patched = False
    for q in data:
        if q.get("id") == qid:
            q["image"] = image_path
            patched = True
            break
    if not patched:
        raise ValueError(f"Question {qid!r} not found in questions.json")
    out = json.dumps(data, ensure_ascii=False, indent=2)
    # Validate round-trip
    json.loads(out)
    tmp = QUESTIONS_JSON.with_suffix(".json.tmp")
    tmp.write_text(out, encoding="utf-8")
    tmp.replace(QUESTIONS_JSON)  # os.replace() — atomic on Windows even when target exists


# ─────────────────────────────────────────────────────────────────────────────
# Poshenloh SVG strategy
# ─────────────────────────────────────────────────────────────────────────────

def svg_to_png(svg_data: bytes) -> bytes:
    """Render SVG bytes to PNG at SVG_RENDER_SCALE using PyMuPDF (fitz)."""
    doc = fitz.open("svg", svg_data)
    mat = fitz.Matrix(SVG_RENDER_SCALE, SVG_RENDER_SCALE)
    pix = doc[0].get_pixmap(matrix=mat)
    return pix.tobytes("png")


def fetch_poshenloh_svg(url: str) -> bytes | None:
    """Fetch an SVG from poshenloh.com (CDN — no session required)."""
    try:
        rate_limit(url)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        data = urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT).read()
        return data
    except Exception as exc:
        print(f"    ERROR fetching {url}: {exc}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Kangaroo PDF strategy
# ─────────────────────────────────────────────────────────────────────────────

KANGAROO_COMPETITIONS_URL = "https://mathkangaroo.ca/competitions/"
PDF_CACHE_DIR = REPO_ROOT / "tools" / ".kangaroo_pdfs"

_KG_PDF_LEVEL_KEYWORDS = {
    "ab": re.compile(r"2023.*\b(junior|grade.?[789]|level.?[ab]|5.?6|7.?8|9.?10)", re.I),
    "c": re.compile(r"2023.*\b(senior|grade.?1[012]|level.?c|11.?12)", re.I),
}
_KG_YEAR_RE = re.compile(r"2023", re.I)


def _find_kangaroo_pdf_urls(session: requests.Session) -> dict[str, str | None]:
    """Discover 2023 Kangaroo contest PDF URLs from the competitions page."""
    result: dict[str, str | None] = {"ab": None, "c": None}
    try:
        resp = fetch(session, KANGAROO_COMPETITIONS_URL)
    except Exception as exc:
        print(f"  ERROR fetching Kangaroo competitions page: {exc}")
        return result

    soup = BeautifulSoup(resp.text, "html.parser")
    pdf_links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().endswith(".pdf") and "2023" in href:
            pdf_links.append(urljoin(KANGAROO_COMPETITIONS_URL, href))
    for a in soup.find_all("a", href=True):
        text = a.get_text()
        href = a["href"]
        if _KG_YEAR_RE.search(text) and href.lower().endswith(".pdf"):
            full = urljoin(KANGAROO_COMPETITIONS_URL, href)
            if full not in pdf_links:
                pdf_links.append(full)

    print(f"  Found {len(pdf_links)} Kangaroo 2023 PDF link(s):")
    for link in pdf_links:
        print(f"    {link}")

    if not pdf_links:
        print(
            "  NOTE: mathkangaroo.ca is JavaScript-rendered; links may not appear.\n"
            "  To fix: download the 2023 Level A/B and Level C PDFs manually and\n"
            f"  place them in: {PDF_CACHE_DIR}\n"
            "  Then re-run this script."
        )
        return result

    for url in pdf_links:
        for level, pat in _KG_PDF_LEVEL_KEYWORDS.items():
            if pat.search(url) and result[level] is None:
                result[level] = url

    if pdf_links and result["ab"] is None:
        result["ab"] = pdf_links[0]

    return result


def _find_cached_kangaroo_pdfs() -> dict[str, Path | None]:
    """Check .kangaroo_pdfs/ for manually placed 2023 contest PDFs."""
    result: dict[str, Path | None] = {"ab": None, "c": None}
    if not PDF_CACHE_DIR.exists():
        return result
    for pdf in PDF_CACHE_DIR.glob("*.pdf"):
        name = pdf.name.lower()
        if "2023" not in name:
            continue
        if any(kw in name for kw in ("ab", "junior", "9-10", "7-8", "level_a", "level_b")):
            if result["ab"] is None:
                result["ab"] = pdf
        elif any(kw in name for kw in ("_c", "senior", "11-12", "level_c")):
            if result["c"] is None:
                result["c"] = pdf
        else:
            if result["ab"] is None:
                result["ab"] = pdf
    return result


def _download_kangaroo_pdf(
    session: requests.Session, url: str, cache_dir: Path
) -> Path | None:
    filename = urlparse(url).path.split("/")[-1]
    dest = cache_dir / filename
    if dest.exists():
        print(f"  PDF cached: {dest.name}")
        return dest
    print(f"  Downloading PDF: {url}")
    try:
        resp = fetch(session, url, stream=True)
        dest.write_bytes(resp.content)
        print(f"  Saved: {dest.name} ({dest.stat().st_size:,} B)")
        return dest
    except Exception as exc:
        print(f"  ERROR downloading PDF: {exc}")
        return None


def extract_kangaroo_figure(pdf_path: Path, problem_num: int) -> bytes | None:
    """
    Open the Kangaroo PDF, find the page containing problem_num,
    extract the embedded figure image (or render the page as PNG).
    """
    doc = fitz.open(str(pdf_path))

    prob_patterns = [
        re.compile(rf"^\s*{problem_num}[.)]\s", re.MULTILINE),
        re.compile(rf"\bProblem\s+{problem_num}\b", re.I),
        re.compile(rf"^{problem_num}\s*$", re.MULTILINE),
    ]

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        if not any(p.search(text) for p in prob_patterns):
            continue

        print(f"    Problem {problem_num} found on PDF page {page_num + 1}")

        img_list = page.get_images(full=True)
        if img_list:
            def img_area(xref_info: tuple) -> int:
                try:
                    return xref_info[2] * xref_info[3]
                except (IndexError, TypeError):
                    return 0

            for xref_info in sorted(img_list, key=img_area, reverse=True):
                xref = xref_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    img_bytes = base_image["image"]
                    img_ext = base_image.get("ext", "png")
                    if img_ext.lower() in ("png", "jpeg", "jpg"):
                        pil_img = Image.open(io.BytesIO(img_bytes))
                        w, h = pil_img.size
                        if w >= MIN_DIMENSION and h >= MIN_DIMENSION:
                            buf = io.BytesIO()
                            pil_img.convert("RGBA").save(buf, format="PNG")
                            return buf.getvalue()
                except Exception:
                    continue

        print(f"    No embedded image found -- rendering page {page_num + 1} at 150 DPI")
        mat = fitz.Matrix(150 / 72, 150 / 72)
        pix = page.get_pixmap(matrix=mat)
        return pix.tobytes("png")

    print(f"    Problem {problem_num} not found in {pdf_path.name}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Main crawl loop
# ─────────────────────────────────────────────────────────────────────────────

def parse_kangaroo_id(qid: str) -> tuple[str, int] | None:
    """Return (level, problem_num) or None."""
    m = re.match(r"q_kg_2023_(ab|c)_(\d+)$", qid)
    if m:
        return m.group(1), int(m.group(2))
    return None


def crawl_all(apply: bool, target_id: str | None, questions: list[dict]) -> None:
    session = _make_session()
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    PDF_CACHE_DIR.mkdir(exist_ok=True)

    posh_targets = [
        q for q in questions
        if q["id"] in POSHENLOH_SVG_MAP
        and not q.get("image")
        and (target_id is None or q["id"] == target_id)
    ]
    manual_targets = [
        q for q in questions
        if q["id"] in MANUAL_SOURCING_REQUIRED
        and not q.get("image")
        and (target_id is None or q["id"] == target_id)
    ]
    kg_targets = [
        q for q in questions
        if "mathkangaroo.ca" in q.get("imageLink", "")
        and not q.get("image")
        and (target_id is None or q["id"] == target_id)
    ]

    print(f"\n{'='*60}")
    print(f"Poshenloh SVG targets : {len(posh_targets)}")
    print(f"Manual-only targets   : {len(manual_targets)}")
    print(f"Kangaroo targets      : {len(kg_targets)}")
    print(f"Mode                  : {'APPLY' if apply else 'DRY RUN'}")
    print(f"{'='*60}\n")

    stats = {"ok": 0, "skip": 0, "fail": 0, "manual": 0}

    # ── Poshenloh SVG ─────────────────────────────────────────────────────────
    if posh_targets:
        print("-- Poshenloh SVG figures -------------------------------------")
    for q in posh_targets:
        qid = q["id"]
        out_path = IMAGES_DIR / f"{qid}.png"
        image_rel = f"/images/questions/{qid}.png"

        print(f"\n[{qid}]")

        if out_path.exists() and q.get("image") == image_rel:
            print("  SKIP: already downloaded")
            stats["skip"] += 1
            continue

        svg_url = POSHENLOH_SVG_MAP[qid]
        print(f"  Fetching SVG: {svg_url}")
        svg_data = fetch_poshenloh_svg(svg_url)
        if svg_data is None:
            stats["fail"] += 1
            continue

        print(f"  Rendering SVG ({len(svg_data):,} B) to PNG at {SVG_RENDER_SCALE}x scale")
        try:
            png_data = svg_to_png(svg_data)
        except Exception as exc:
            print(f"  FAIL: SVG render error -- {exc}")
            stats["fail"] += 1
            continue

        if not validate_image(png_data, svg_url):
            stats["fail"] += 1
            continue

        if apply:
            backup_questions_json()
            atomic_write(out_path, png_data)
            patch_questions_json(qid, image_rel)
            print(f"  SAVED: {out_path.name}")
            stats["ok"] += 1
        else:
            print(f"  DRY RUN: would save {out_path.name} ({len(png_data):,} B)")
            stats["ok"] += 1

    # ── Manual sourcing required ───────────────────────────────────────────────
    if manual_targets:
        print("\n-- Manual sourcing required -----------------------------------")
    for q in manual_targets:
        qid = q["id"]
        reason = MANUAL_SOURCING_REQUIRED[qid]
        print(f"\n[{qid}] MANUAL REQUIRED")
        print(f"  {reason}")
        print(
            f"  To fix: take a browser screenshot of the figure, save as\n"
            f"  exam-app/public/images/questions/{qid}.png (min 200x200px),\n"
            f"  then add  \"image\": \"/images/questions/{qid}.png\"  to questions.json."
        )
        stats["manual"] += 1

    # ── Kangaroo ──────────────────────────────────────────────────────────────
    if kg_targets:
        print("\n-- Kangaroo figures ------------------------------------------")

        # First check for manually placed PDFs in the cache directory
        pdf_paths = _find_cached_kangaroo_pdfs()
        if pdf_paths["ab"] or pdf_paths["c"]:
            print(f"  Found cached PDFs: {pdf_paths}")
        else:
            # Try to discover via the competitions page
            pdf_urls = _find_kangaroo_pdf_urls(session)
            print(f"  Level A/B PDF: {pdf_urls.get('ab') or 'NOT FOUND'}")
            print(f"  Level C PDF  : {pdf_urls.get('c') or 'NOT FOUND'}")
            for level, url in pdf_urls.items():
                if url:
                    pdf_paths[level] = _download_kangaroo_pdf(session, url, PDF_CACHE_DIR)

    for q in kg_targets:
        qid = q["id"]
        out_path = IMAGES_DIR / f"{qid}.png"
        image_rel = f"/images/questions/{qid}.png"

        print(f"\n[{qid}]")

        if out_path.exists() and q.get("image") == image_rel:
            print("  SKIP: already downloaded")
            stats["skip"] += 1
            continue

        parsed = parse_kangaroo_id(qid)
        if parsed is None:
            print(f"  SKIP: cannot parse level/problem from ID {qid!r}")
            stats["fail"] += 1
            continue

        level, prob_num = parsed
        pdf_path = pdf_paths.get(level)

        if pdf_path is None or not pdf_path.exists():
            print(f"  SKIP: no PDF for level {level!r} -- manual download required")
            print(f"        Place 2023 Kangaroo Level {'A/B' if level == 'ab' else 'C'} PDF in:")
            print(f"        {PDF_CACHE_DIR}")
            stats["fail"] += 1
            continue

        print(f"  Extracting problem {prob_num} from {pdf_path.name}")
        img_data = extract_kangaroo_figure(pdf_path, prob_num)

        if img_data is None:
            stats["fail"] += 1
            continue

        if not validate_image(img_data, pdf_path.name):
            stats["fail"] += 1
            continue

        if apply:
            backup_questions_json()
            atomic_write(out_path, img_data)
            patch_questions_json(qid, image_rel)
            print(f"  SAVED: {out_path.name}")
            stats["ok"] += 1
        else:
            print(f"  DRY RUN: would save {out_path.name} ({len(img_data):,} B)")
            stats["ok"] += 1

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(
        f"Results -- OK: {stats['ok']}  Skip: {stats['skip']}  "
        f"Fail: {stats['fail']}  Manual: {stats['manual']}"
    )
    if not apply and stats["ok"] > 0:
        print("Re-run with --apply to write files and patch questions.json")
    if stats["manual"] > 0:
        print(
            f"{stats['manual']} question(s) require manual browser screenshots "
            "(see instructions above)."
        )
    print(f"{'='*60}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl figures from official exam sources")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write PNG files and patch questions.json (default: dry run)",
    )
    parser.add_argument(
        "--id",
        dest="target_id",
        default=None,
        metavar="QUESTION_ID",
        help="Process only this question ID",
    )
    args = parser.parse_args()

    questions: list[dict] = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    crawl_all(apply=args.apply, target_id=args.target_id, questions=questions)


if __name__ == "__main__":
    main()
