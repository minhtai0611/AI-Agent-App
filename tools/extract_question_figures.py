#!/usr/bin/env python3
"""Extract figure images from official exam PDFs/SVGs → exam-app/public/images/questions/

Sources:
- AMC 8 2019 & 2022: SVG images from live.poshenloh.com (downloaded directly, converted to PNG)
- CEMC Gauss 8 2023: PDF from cemc.uwaterloo.ca (vector page crop)
- UKMT IMC 2020 & JMC 2019: PDFs from ukmt.org.uk (vector page crop)
"""
import argparse
import pathlib
import sys
import urllib.request
import urllib.error
import io

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("pip install pymupdf")

try:
    import cairosvg
except ImportError:
    cairosvg = None  # warn later if needed for AMC

ROOT = pathlib.Path(__file__).parent.parent
PDF_DIR = ROOT / "tools" / "pdfs"
OUT_DIR = ROOT / "exam-app" / "public" / "images" / "questions"

# ─── PDF URLs ─────────────────────────────────────────────────────────────────
PDF_URLS = {
    "cemc_gauss8_2023.pdf": [
        "https://cemc.uwaterloo.ca/sites/default/files/documents/2023/2023Gauss8Contest.pdf",
    ],
    "ukmt_imc_2020.pdf": [
        "https://ukmt.org.uk/wp-content/uploads/2023/08/IMC_2020_q.pdf",
    ],
    "ukmt_jmc_2019.pdf": [
        "https://ukmt.org.uk/wp-content/uploads/2023/08/jmc-2019-q.pdf",
    ],
}

# ─── SVG Sources (AMC 8 — poshenloh.com) ──────────────────────────────────────
# Mapping: question_id → SVG URL on poshenloh (only main figure SVG, not answer choice svgs)
AMC_SVG_MAP = {
    # AMC 8 2019 — main problem figures
    "q_amc8_19_21": "https://live.poshenloh.com/images/past-contests/amc8/2019/2.svg",
    "q_amc8_19_22": "https://live.poshenloh.com/images/past-contests/amc8/2019/5a.svg",  # distance-time graph
    "q_amc8_19_23": "https://live.poshenloh.com/images/past-contests/amc8/2019/10.svg",
    "q_amc8_19_24": "https://live.poshenloh.com/images/past-contests/amc8/2019/12.svg",
    "q_amc8_19_25": "https://live.poshenloh.com/images/past-contests/amc8/2019/24.svg",

    # AMC 8 2022 — main problem figures
    "q_amc8_22v_18": "https://live.poshenloh.com/images/past-contests/amc8/2022/1.svg",
    "q_amc8_22v_19": "https://live.poshenloh.com/images/past-contests/amc8/2022/4.svg",
    "q_amc8_22v_20": "https://live.poshenloh.com/images/past-contests/amc8/2022/10a.svg",
    "q_amc8_22v_21": "https://live.poshenloh.com/images/past-contests/amc8/2022/12.svg",
    "q_amc8_22v_22": "https://live.poshenloh.com/images/past-contests/amc8/2022/15.svg",
    "q_amc8_22v_23": "https://live.poshenloh.com/images/past-contests/amc8/2022/19.svg",
    "q_amc8_22v_24": "https://live.poshenloh.com/images/past-contests/amc8/2022/20.svg",
    "q_amc8_22v_25": "https://live.poshenloh.com/images/past-contests/amc8/2022/24.svg",
}

# ─── PDF Crop Registry ────────────────────────────────────────────────────────
# crop_frac: (left, top, right, bottom) as fraction [0.0-1.0] of page dimensions
# page: 0-indexed
# All figures are rendered by cropping between the start of the problem and the
# start of the next problem (or end of page), then applying a small margin.

# CEMC Gauss 8 2023 page height = 792pt, width ~612pt
# Problems page 1 (1-9): y-starts at 123.4, 168.9, 285.3, 330.8, 389.8, 435.3, 507.9, 583.7, 642.7
# Problems page 2 (10-17): 51.4, 195.1, 284.3, 381.0, 452.8, 545.6, 603.9, 662.1
# Problems page 3 (18-25): 51.4, 102.8, 167.7, 279.1, 392.6, 457.6, 549.6, 615.2

# UKMT IMC 2020 page height = 842pt
# Page 1 (probs 1-11): 4@201.9, 11@720.1
# Page 2 (probs 12-19): 15@260.0, 18@552.8, 19@676.0
# Page 3 (probs 20-25): 21@167.0, 22@308.3, 23@423.8, 25@683.4

# UKMT JMC 2019 page height = 842pt
# Page 1 (probs 1-10): 4@236.4, 8@544.7
# Page 2 (probs 11-17): 11@53.6, 15@537.4
# Page 3 (probs 18-25): 23@509.3

def _frac(y, total=792.0):
    return y / total

def _frac842(y):
    return y / 842.0

PDF_CROP_REGISTRY = {
    # ── CEMC Gauss 8 2023 (page height 792) ──────────────────────────────────
    # prob 2 (wind speed bar graph) on page 1, y=168.9, next prob at 285.3
    "q_cemc_g8_23_20": {
        "pdf": "cemc_gauss8_2023.pdf", "page": 1,
        "crop_frac": (0.0, _frac(155.0), 1.0, _frac(290.0)),
    },
    # prob 10 (rectangle coords) on page 2, y=51.4, next prob at 195.1
    "q_cemc_g8_23_21": {
        "pdf": "cemc_gauss8_2023.pdf", "page": 2,
        "crop_frac": (0.0, _frac(40.0), 1.0, _frac(200.0)),
    },
    # prob 11 (path A to B) on page 2, y=195.1, next prob at 284.3
    "q_cemc_g8_23_22": {
        "pdf": "cemc_gauss8_2023.pdf", "page": 2,
        "crop_frac": (0.0, _frac(183.0), 1.0, _frac(290.0)),
    },
    # prob 12 (triangle PQR) on page 2, y=284.3, next prob at 381.0
    "q_cemc_g8_23_23": {
        "pdf": "cemc_gauss8_2023.pdf", "page": 2,
        "crop_frac": (0.0, _frac(272.0), 1.0, _frac(386.0)),
    },
    # prob 20 (4x4 grid) on page 3, y=167.7, next prob at 279.1
    "q_cemc_g8_23_24": {
        "pdf": "cemc_gauss8_2023.pdf", "page": 3,
        "crop_frac": (0.0, _frac(155.0), 1.0, _frac(284.0)),
    },
    # prob 21 (circle chord MN) on page 3, y=279.1, next prob at 392.6
    "q_cemc_g8_23_25": {
        "pdf": "cemc_gauss8_2023.pdf", "page": 3,
        "crop_frac": (0.0, _frac(267.0), 1.0, _frac(398.0)),
    },

    # ── UKMT IMC 2020 (page height 842) ──────────────────────────────────────
    # prob 4 on page 1, y=201.9, next prob (5) at ~314
    "q_ukmt_imc20_15": {
        "pdf": "ukmt_imc_2020.pdf", "page": 1,
        "crop_frac": (0.0, _frac842(190.0), 1.0, _frac842(320.0)),
    },
    # prob 11 on page 1, y=720.1, extends to bottom of page
    "q_ukmt_imc20_16": {
        "pdf": "ukmt_imc_2020.pdf", "page": 1,
        "crop_frac": (0.0, _frac842(708.0), 1.0, 1.0),
    },
    # prob 15 on page 2, y=260.0, next prob (16) at ~376.9
    "q_ukmt_imc20_17": {
        "pdf": "ukmt_imc_2020.pdf", "page": 2,
        "crop_frac": (0.0, _frac842(248.0), 1.0, _frac842(383.0)),
    },
    # prob 18 on page 2, y=552.8, next prob (19) at ~676
    "q_ukmt_imc20_18": {
        "pdf": "ukmt_imc_2020.pdf", "page": 2,
        "crop_frac": (0.0, _frac842(540.0), 1.0, _frac842(682.0)),
    },
    # prob 19 on page 2, y=676.0, extends near bottom
    "q_ukmt_imc20_19": {
        "pdf": "ukmt_imc_2020.pdf", "page": 2,
        "crop_frac": (0.0, _frac842(664.0), 1.0, 1.0),
    },
    # prob 21 on page 3, y=167.0, next prob (22) at ~308.3
    "q_ukmt_imc20_20": {
        "pdf": "ukmt_imc_2020.pdf", "page": 3,
        "crop_frac": (0.0, _frac842(155.0), 1.0, _frac842(314.0)),
    },
    # prob 22 on page 3, y=308.3, next prob (23) at ~423.8
    "q_ukmt_imc20_21": {
        "pdf": "ukmt_imc_2020.pdf", "page": 3,
        "crop_frac": (0.0, _frac842(296.0), 1.0, _frac842(430.0)),
    },
    # prob 23 on page 3, y=423.8, next prob (24) at ~597.2
    "q_ukmt_imc20_22": {
        "pdf": "ukmt_imc_2020.pdf", "page": 3,
        "crop_frac": (0.0, _frac842(411.0), 1.0, _frac842(603.0)),
    },
    # prob 25 on page 3, y=683.4, extends to bottom
    "q_ukmt_imc20_23": {
        "pdf": "ukmt_imc_2020.pdf", "page": 3,
        "crop_frac": (0.0, _frac842(671.0), 1.0, 1.0),
    },
    # prob 7 on page 1, y=433.9, next prob (8) at 554.0
    "q_ukmt_imc20_24": {
        "pdf": "ukmt_imc_2020.pdf", "page": 1,
        "crop_frac": (0.0, _frac842(424.0), 1.0, _frac842(554.0)),
    },
    # prob 9 on page 1, y=606.1, next prob (10) at 664.6
    "q_ukmt_imc20_25": {
        "pdf": "ukmt_imc_2020.pdf", "page": 1,
        "crop_frac": (0.0, _frac842(596.0), 1.0, _frac842(665.0)),
    },

    # ── UKMT JMC 2019 (page height 842) ──────────────────────────────────────
    # prob 4 on page 1, y=236.4, next prob (5) at ~345 (estimated)
    "q_ukmt_jmc19_21": {
        "pdf": "ukmt_jmc_2019.pdf", "page": 1,
        "crop_frac": (0.0, _frac842(224.0), 1.0, _frac842(430.0)),
    },
    # prob 8 on page 1, y=544.7, next prob (9) at ~640 (estimated)
    "q_ukmt_jmc19_22": {
        "pdf": "ukmt_jmc_2019.pdf", "page": 1,
        "crop_frac": (0.0, _frac842(532.0), 1.0, _frac842(730.0)),
    },
    # prob 11 on page 2, y=53.6, next prob (12) at ~160 (estimated)
    "q_ukmt_jmc19_23": {
        "pdf": "ukmt_jmc_2019.pdf", "page": 2,
        "crop_frac": (0.0, _frac842(42.0), 1.0, _frac842(250.0)),
    },
    # prob 15 on page 2, y=537.4, next prob (16) at ~640 (estimated)
    "q_ukmt_jmc19_24": {
        "pdf": "ukmt_jmc_2019.pdf", "page": 2,
        "crop_frac": (0.0, _frac842(525.0), 1.0, _frac842(720.0)),
    },
    # prob 23 on page 3, y=509.3, next prob (24) at ~615 (estimated)
    "q_ukmt_jmc19_25": {
        "pdf": "ukmt_jmc_2019.pdf", "page": 3,
        "crop_frac": (0.0, _frac842(497.0), 1.0, _frac842(700.0)),
    },
}


def http_get(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; exam-figure-extractor/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def try_download_pdf(pdf_name: str, urls: list) -> bool:
    """Try each URL; return True on success."""
    dest = PDF_DIR / pdf_name
    for url in urls:
        try:
            print(f"  Downloading {pdf_name} from {url} ...")
            data = http_get(url)
            if not data.startswith(b"%PDF"):
                print(f"    Skipped (not a PDF: {data[:20]!r})")
                continue
            dest.write_bytes(data)
            print(f"  Saved {dest} ({len(data)//1024} KB)")
            return True
        except Exception as e:
            print(f"    Failed ({e})")
    return False


def inspect_pdf(path: pathlib.Path) -> None:
    doc = fitz.open(str(path))
    print(f"\n=== {path.name} ({doc.page_count} pages) ===")
    for i, page in enumerate(doc):
        imgs = page.get_images(full=True)
        paths = page.get_drawings()
        print(f"  Page {i}: {page.rect.width:.0f}x{page.rect.height:.0f}pt, "
              f"{len(imgs)} image(s), {len(paths)} draw paths")
    doc.close()


def svg_url_to_png(url: str) -> bytes | None:
    """Download an SVG and convert to PNG bytes. Returns None on error."""
    if cairosvg is None:
        print("    WARN: cairosvg not installed — pip install cairosvg")
        return None
    try:
        svg_bytes = http_get(url)
        if not svg_bytes.strip().startswith((b"<", b"<?xml")):
            print(f"    Not an SVG: {svg_bytes[:40]!r}")
            return None
        png_bytes = cairosvg.svg2png(bytestring=svg_bytes, scale=2)
        return png_bytes
    except Exception as e:
        print(f"    SVG conversion failed: {e}")
        return None


def pdf_crop_to_png(doc: fitz.Document, page_idx: int, crop_frac: tuple) -> bytes:
    """Crop a page region and render to PNG."""
    page = doc[page_idx]
    rect = page.rect
    l, t, r, b = crop_frac
    clip = fitz.Rect(
        rect.x0 + l * rect.width,
        rect.y0 + t * rect.height,
        rect.x0 + r * rect.width,
        rect.y0 + b * rect.height,
    )
    mat = fitz.Matrix(2, 2)  # 2x = ~144 DPI from 72pt
    pix = page.get_pixmap(matrix=mat, clip=clip)
    if pix.alpha:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    return pix.tobytes("png")


def extract_svg_figure(qid: str, url: str, dry_run: bool, force: bool) -> str:
    out_path = OUT_DIR / f"{qid}.png"
    if out_path.exists() and not force:
        return f"  SKIP  {qid} (already exists)"
    if dry_run:
        return f"  PLAN  {qid} (svg: {url})"
    png_bytes = svg_url_to_png(url)
    if not png_bytes or len(png_bytes) < 512:
        return f"  FAIL  {qid} (SVG→PNG empty or too small: {len(png_bytes) if png_bytes else 0} bytes)"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(png_bytes)
    return f"  OK    {qid} (method: svg, size: {len(png_bytes)//1024}KB → {out_path.name})"


def extract_pdf_figure(doc: fitz.Document, qid: str, entry: dict,
                       dry_run: bool, force: bool) -> str:
    out_path = OUT_DIR / f"{qid}.png"
    if out_path.exists() and not force:
        return f"  SKIP  {qid} (already exists)"
    page_idx = entry["page"]
    crop_frac = entry["crop_frac"]
    if dry_run:
        return f"  PLAN  {qid} (pdf={entry['pdf']}, page={page_idx}, crop={[f'{v:.3f}' for v in crop_frac]})"
    png_bytes = pdf_crop_to_png(doc, page_idx, crop_frac)
    if len(png_bytes) < 512:
        return f"  FAIL  {qid} (crop PNG too small: {len(png_bytes)} bytes)"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(png_bytes)
    return f"  OK    {qid} (method: crop, size: {len(png_bytes)//1024}KB → {out_path.name})"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print plan only, no file writes")
    parser.add_argument("--force", action="store_true", help="Re-extract even if PNG exists")
    parser.add_argument("--inspect", action="store_true", help="Print PDF image layout and exit")
    parser.add_argument("--pdf", default=None, help="Process only this PDF filename")
    args = parser.parse_args()

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    total_targets = len(AMC_SVG_MAP) + len(PDF_CROP_REGISTRY)
    print(f"Targets: {total_targets} ({len(AMC_SVG_MAP)} AMC SVG + {len(PDF_CROP_REGISTRY)} PDF crop)\n")

    # ── Step 1: Download PDFs ─────────────────────────────────────────────────
    print("== Step 1: Download PDFs ==")
    downloaded: set[str] = set()
    failed_pdfs: set[str] = set()

    for pdf_name, urls in PDF_URLS.items():
        if args.pdf and pdf_name != args.pdf:
            continue
        dest = PDF_DIR / pdf_name
        if dest.exists() and dest.stat().st_size > 10_000:
            print(f"  EXISTS {pdf_name} ({dest.stat().st_size//1024} KB)")
            downloaded.add(pdf_name)
        elif args.dry_run:
            print(f"  PLAN   Would download {pdf_name}")
            downloaded.add(pdf_name)
        elif try_download_pdf(pdf_name, urls):
            downloaded.add(pdf_name)
        else:
            print(f"  FAILED {pdf_name}")
            failed_pdfs.add(pdf_name)

    # ── Step 2 (optional): Inspect ────────────────────────────────────────────
    if args.inspect:
        print("\n== Step 2: PDF Inspection ==")
        for pdf_name in downloaded:
            path = PDF_DIR / pdf_name
            if path.exists():
                inspect_pdf(path)
        return

    results: dict[str, list[str]] = {"ok": [], "skip": [], "fail": [], "missing": []}

    # ── Step 3: AMC SVG figures ───────────────────────────────────────────────
    print("\n== Step 3: AMC SVG Figures ==")
    if cairosvg is None and not args.dry_run:
        print("  WARN: cairosvg not found — install with: pip install cairosvg")
    for qid, url in sorted(AMC_SVG_MAP.items()):
        if args.pdf:
            continue  # SVG figures don't belong to a specific PDF
        msg = extract_svg_figure(qid, url, args.dry_run, args.force)
        print(msg)
        tag = msg.strip().split()[0]
        if tag == "OK":
            results["ok"].append(qid)
        elif tag in ("SKIP", "PLAN"):
            results["skip"].append(qid)
        else:
            results["fail"].append(qid)

    # ── Step 4: PDF crop figures ──────────────────────────────────────────────
    print("\n== Step 4: PDF Crop Figures ==")
    by_pdf: dict[str, list[tuple[str, dict]]] = {}
    for qid, entry in PDF_CROP_REGISTRY.items():
        if args.pdf and entry["pdf"] != args.pdf:
            continue
        by_pdf.setdefault(entry["pdf"], []).append((qid, entry))

    for pdf_name, questions in sorted(by_pdf.items()):
        pdf_path = PDF_DIR / pdf_name
        print(f"\n  [{pdf_name}]")
        if pdf_name in failed_pdfs or not pdf_path.exists():
            for qid, _ in questions:
                print(f"  SKIP  {qid} (PDF unavailable)")
                results["missing"].append(qid)
            continue
        try:
            doc = fitz.open(str(pdf_path))
        except Exception as e:
            print(f"  ERROR opening {pdf_name}: {e}")
            for qid, _ in questions:
                results["fail"].append(qid)
            continue
        for qid, entry in sorted(questions, key=lambda x: (x[1]["page"], x[1].get("crop_frac", (0,))[1])):
            msg = extract_pdf_figure(doc, qid, entry, args.dry_run, args.force)
            print(msg)
            tag = msg.strip().split()[0]
            if tag == "OK":
                results["ok"].append(qid)
            elif tag in ("SKIP", "PLAN"):
                results["skip"].append(qid)
            else:
                results["fail"].append(qid)
        doc.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n== Summary ==")
    print(f"  Extracted : {len(results['ok'])}")
    print(f"  Skipped   : {len(results['skip'])} (already exist or dry-run plan)")
    print(f"  Failed    : {len(results['fail'])}")
    print(f"  Missing   : {len(results['missing'])} (PDF unavailable)")
    total = sum(len(v) for v in results.values())
    print(f"  Total     : {total} / {total_targets} targets")

    if not args.dry_run:
        existing = list(OUT_DIR.glob("*.png"))
        print(f"\n  PNGs in output dir: {len(existing)}")

    if results["fail"] or results["missing"]:
        print("\n  FAILURES / MISSING:")
        for qid in results["fail"] + results["missing"]:
            print(f"    {qid}")


if __name__ == "__main__":
    main()
