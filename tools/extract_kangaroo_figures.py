"""
Extract figures from the 2023 Math Kangaroo Canada Grade 9-10 PDF.
Renders each page to bitmap and crops the figure region for each target problem.
All crop bounds derived from real text-block analysis of the PDF layout.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import fitz
import os
import pathlib
from PIL import Image

PDF_PATH = pathlib.Path("tools/.kangaroo_pdfs/2023gr0910e.pdf")
OUT_DIR = pathlib.Path("exam-app/public/images/questions")
RENDER_SCALE = 3  # 3x => ~216 DPI for a 72 dpi PDF base

# Page is full-width; we only need to constrain y.
# Crop spec: (page_0idx, y_top, y_bottom, x_left_frac, x_right_frac)
# x fractions are 0.0–1.0 of page width; use 0/1 for full width.
#
# For problems where answer choices ARE the figure (picture choices), we
# extend y_bottom to include them; otherwise we stop just before answers.
QUESTION_CROPS = {
    # pg2: probs 2, 4, 6
    # Problem 2: speed-time graph (A)–(E) — answer choices ARE the figures
    #   Problem text y=270–300, "(A)\nt" answer labels y=366–378, "v" y=303–314
    #   Next problem starts y=398
    "q_kg_2023_ab_02": (1, 270, 395, 0.0, 1.0),

    # Problem 4: large+small square geometry
    #   Text block y=460–504 (wraps around inline figure), "What %..." y=514–526, answers y=543
    "q_kg_2023_ab_04": (1, 460, 540, 0.0, 1.0),

    # Problem 6: large rectangle divided into 30 squares, shaded region
    #   Text block y=636–681, answers y=697
    "q_kg_2023_ab_06": (1, 636, 693, 0.0, 1.0),

    # pg3: probs 9, 12
    # Problem 9: tetrahedron (triangular pyramid) with edge values
    #   Text block y=252–324 (pyramid embedded), answers y=341
    "q_kg_2023_ab_09": (2, 252, 338, 0.0, 1.0),

    # Problem 12: three adjacent squares (3,5,8 cm) with shaded trapezoid
    #   Header y=628–640, labels+body y=634–679, answers y=689
    "q_kg_2023_ab_12": (2, 625, 685, 0.0, 1.0),

    # pg4: probs 15, 16
    # Problem 15: pentagon ABCDE divided into 4 triangles
    #   Text blocks y=302–359, answers y=376
    "q_kg_2023_ab_15": (3, 302, 372, 0.0, 1.0),

    # Problem 16: tower of blocks 1–90 (diagram with block numbers)
    #   Header y=405–417, block labels scattered y=405–495, text y=422–483, answers y=497
    "q_kg_2023_ab_16": (3, 405, 493, 0.0, 1.0),

    # pg5: prob 19
    # Problem 19: 30cm square grid with 3 circles (radii 5,4,3)
    #   Text block y=88–145, answers y=160
    "q_kg_2023_ab_19": (4, 88, 157, 0.0, 1.0),

    # pg6: probs 25, 26, 29
    # Problem 25: 7-circle figure with "?" — the circle diagram is the setup
    #   First text y=88–100, diagram embedded, "?" y=139, "Which number..." y=139–151, answers y=168
    "q_kg_2023_c_25":  (5, 88, 165, 0.0, 1.0),

    # Problem 26: 5 net diagrams (A)–(E) — answer choices ARE the figures
    #   Problem text y=198–225, net diagrams y=225–269 (labeled "(A)\n(B)\n..." y=257)
    "q_kg_2023_c_26":  (5, 198, 282, 0.0, 1.0),

    # Problem 29: park map divided into regions with perimeter labels
    #   Header y=461–473, map labels scattered up to y=548, answers y=523
    "q_kg_2023_c_29":  (5, 458, 555, 0.0, 1.0),
}

MARGIN = 6  # extra pts above/below crop


def render_crop(doc, page_idx, y_top, y_bot, x_left_frac, x_right_frac):
    page = doc[page_idx]
    pw = page.rect.width
    ph = page.rect.height
    clip = fitz.Rect(
        pw * x_left_frac,
        max(0, y_top - MARGIN),
        pw * x_right_frac,
        min(ph, y_bot + MARGIN),
    )
    mat = fitz.Matrix(RENDER_SCALE, RENDER_SCALE)
    pix = page.get_pixmap(matrix=mat, clip=clip, colorspace=fitz.csRGB)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


def validate(path):
    data = path.read_bytes()
    if data[:4] != b'\x89PNG':
        return False, "not PNG"
    img = Image.open(path)
    if img.width < 50 or img.height < 50:
        return False, f"too small {img.width}x{img.height}"
    return True, f"{img.width}x{img.height}"


def main(dry_run=True, force=False):
    doc = fitz.open(str(PDF_PATH))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    results = {}
    for qid, (page_idx, y_top, y_bot, xl, xr) in sorted(QUESTION_CROPS.items()):
        out = OUT_DIR / f"{qid}.png"
        if out.exists() and not force:
            print(f"SKIP  {qid}")
            results[qid] = "already_exists"
            continue

        h = y_bot - y_top
        print(f"INFO  {qid}: page {page_idx+1}, y={y_top}-{y_bot} ({h}pt)")

        if dry_run:
            print(f"DRY   {qid}: would write {out.name}")
            results[qid] = "dry_run"
            continue

        img = render_crop(doc, page_idx, y_top, y_bot, xl, xr)
        tmp = out.with_suffix(".tmp.png")
        img.save(str(tmp), format="PNG")
        ok, info = validate(tmp)
        if not ok:
            print(f"FAIL  {qid}: {info}")
            tmp.unlink(missing_ok=True)
            results[qid] = f"fail:{info}"
            continue

        os.replace(str(tmp), str(out))
        print(f"OK    {qid}: {info} -> {out.name}")
        results[qid] = f"ok:{info}"

    print("\n=== Summary ===")
    for qid, st in results.items():
        print(f"  {qid}: {st}")


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    force = "--force" in sys.argv
    main(dry_run=not apply, force=force)
