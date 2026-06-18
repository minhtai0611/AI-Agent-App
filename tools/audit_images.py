#!/usr/bin/env python3
"""
Audit question image coverage across all tests and modes.
No external dependencies — stdlib only.

Usage:
    python tools/audit_images.py                          # print to stdout
    python tools/audit_images.py --output tools/image_audit_report.md
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_JSON = REPO_ROOT / "exam-app" / "src" / "data" / "questions.json"
EXAMS_JSON = REPO_ROOT / "exam-app" / "src" / "data" / "exams.json"
IMAGES_DIR = REPO_ROOT / "exam-app" / "public" / "images" / "questions"

# Mirrors questionUtils.js IMAGE_REF_RE — determines what AdaptivePractice filters out
ADAPTIVE_FILTER_RE = re.compile(
    r"hình vẽ|hình bên|hình dưới|hình sau|xem hình|theo hình vẽ"
    r"|bảng biến thiên|xem đề thi gốc|\(Xem",
    re.IGNORECASE,
)

# Extended pattern for full audit — catches additional visual references
AUDIT_VISUAL_RE = re.compile(
    r"hình vẽ|hình bên|hình dưới|hình sau|xem hình|theo hình"
    r"|bảng biến thiên|xem đề thi gốc|\(Xem"
    r"|đồ thị.*như hình|như đồ thị|bảng số liệu",
    re.IGNORECASE,
)

OFFICIAL_DOMAINS: frozenset[str] = frozenset({
    "artofproblemsolving.com",
    "aops.com",
    "mathkangaroo.ca",
    "kangaro.org",
    "ukmt.org.uk",
    "cemc.uwaterloo.ca",
    "collegeboard.org",
    "act.org",
    "ibo.org",
    "nctm.org",
    "maa.org",
    "live.poshenloh.com",
})

CLASS_LABELS = {
    "HAS_LOCAL_IMAGE":   "Local PNG present and file exists on disk — OK",
    "HAS_LOCAL_MISSING": "`image` field set but PNG **not found** on disk — BROKEN",
    "HAS_EXTERNAL_LINK": "`imageLink` only — external URL, no local image",
    "HAS_FIGURE_SVG":    "Inline SVG via `figure.data` — OK",
    "NEEDS_IMAGE":       "Text references a figure but **no** image/imageLink/figure — MISSING",
    "EXPLANATION_REF":   "Explanation references a figure; question body does not have one",
    "CLEAN":             "No visual reference detected",
}


def domain_of(url: str) -> tuple[str, bool]:
    try:
        netloc = urlparse(url).netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        for official in OFFICIAL_DOMAINS:
            if netloc == official or netloc.endswith("." + official):
                return netloc, True
        return netloc, False
    except Exception:
        return "", False


def is_generic_url(url: str) -> bool:
    path = urlparse(url).path.strip("/")
    return len(path) <= 15


def classify(q: dict) -> str:
    has_image = bool(q.get("image"))
    has_link = bool(q.get("imageLink"))
    figure = q.get("figure")
    has_figure = bool(figure.get("data") if isinstance(figure, dict) else figure)
    text = q.get("question", "")
    expl = q.get("explanation", "")

    if has_figure:
        return "HAS_FIGURE_SVG"

    if has_image:
        rel = q["image"].lstrip("/")
        disk_path = (REPO_ROOT / "exam-app" / "public" / rel).resolve()
        return "HAS_LOCAL_IMAGE" if disk_path.exists() else "HAS_LOCAL_MISSING"

    if has_link:
        return "HAS_EXTERNAL_LINK"

    if AUDIT_VISUAL_RE.search(text):
        return "NEEDS_IMAGE"

    # Explanation references a figure even though the question body doesn't
    if AUDIT_VISUAL_RE.search(expl):
        return "EXPLANATION_REF"

    return "CLEAN"


def fmt_excerpt(text: str, max_chars: int = 90) -> str:
    snippet = text[:max_chars].replace("|", "\\|").replace("\n", " ").strip()
    return snippet + ("…" if len(text) > max_chars else "")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit question image coverage")
    parser.add_argument("--output", default=None, help="Write Markdown report to this file")
    args = parser.parse_args()

    if not QUESTIONS_JSON.exists():
        sys.exit(f"Not found: {QUESTIONS_JSON}")
    if not EXAMS_JSON.exists():
        sys.exit(f"Not found: {EXAMS_JSON}")

    questions: list[dict] = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    exams: list[dict] = json.loads(EXAMS_JSON.read_text(encoding="utf-8"))

    # Build question → exam mapping (one question can appear in multiple exams; take first)
    q_to_exam: dict[str, str] = {}
    for ex in exams:
        for qid in ex.get("questionIds", ex.get("questions", [])):
            if qid not in q_to_exam:
                q_to_exam[qid] = ex.get("id", "UNKNOWN")

    # Classify every question
    classified: dict[str, list[dict]] = defaultdict(list)
    for q in questions:
        classified[classify(q)].append(q)

    # ── Build Markdown report ─────────────────────────────────────────────────
    lines: list[str] = []

    def w(s: str = "") -> None:
        lines.append(s)

    w("# Question Image Audit")
    w()
    w(f"**Total questions:** {len(questions)}  ")
    w(f"**Total exams:** {len(exams)}  ")
    w(f"**Local images directory:** `{IMAGES_DIR.relative_to(REPO_ROOT)}`  ")
    w(f"**PNG files on disk:** {len(list(IMAGES_DIR.glob('*.png'))) if IMAGES_DIR.exists() else 'DIR MISSING'}")
    w()

    # Summary table
    w("## Summary")
    w()
    w("| Class | Count | Meaning |")
    w("|-------|------:|---------|")
    for cls, label in CLASS_LABELS.items():
        w(f"| `{cls}` | {len(classified[cls])} | {label} |")
    w()

    # Adaptive Practice impact
    n_filtered = sum(
        1 for q in questions
        if ADAPTIVE_FILTER_RE.search(q.get("question", "")) and not q.get("image")
    )
    w(f"> **Adaptive Practice filter impact:** {n_filtered} questions are currently "
      f"excluded from the adaptive pool due to image references without a local `image` field "
      f"(governed by `questionUtils.js` IMAGE_REF_RE).")
    w()

    # Per-exam breakdown
    exam_issues: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for cls in ("HAS_LOCAL_MISSING", "HAS_EXTERNAL_LINK", "NEEDS_IMAGE", "EXPLANATION_REF"):
        for q in classified[cls]:
            exam_id = q_to_exam.get(q["id"], "UNLINKED")
            exam_issues[exam_id][cls] += 1

    if exam_issues:
        w("## Issues by Exam")
        w()
        w("| Exam | Missing file | Ext. link | Needs image | Expl-only |")
        w("|------|------------:|----------:|------------:|----------:|")
        for eid in sorted(exam_issues):
            d = exam_issues[eid]
            w(
                f"| `{eid}` "
                f"| {d.get('HAS_LOCAL_MISSING', 0)} "
                f"| {d.get('HAS_EXTERNAL_LINK', 0)} "
                f"| {d.get('NEEDS_IMAGE', 0)} "
                f"| {d.get('EXPLANATION_REF', 0)} |"
            )
        w()

    # HAS_LOCAL_MISSING
    if classified["HAS_LOCAL_MISSING"]:
        w("## HAS_LOCAL_MISSING — `image` field set but file absent on disk")
        w()
        w("| ID | image path |")
        w("|----|-----------|")
        for q in classified["HAS_LOCAL_MISSING"]:
            w(f"| `{q['id']}` | `{q['image']}` |")
        w()

    # HAS_EXTERNAL_LINK
    if classified["HAS_EXTERNAL_LINK"]:
        w("## HAS_EXTERNAL_LINK — external `imageLink` only, no local image")
        w()
        w(
            "Questions that show a 'View illustration' button instead of an embedded figure. "
            "Crawl target for `crawl_figures.py`."
        )
        w()
        w("| ID | Domain | Official? | URL type | imageLink |")
        w("|----|--------|:---------:|:--------:|-----------|")
        for q in classified["HAS_EXTERNAL_LINK"]:
            url = q.get("imageLink", "")
            domain, is_official = domain_of(url)
            official_cell = "✅" if is_official else "❌ UNOFFICIAL"
            url_type = "generic" if is_generic_url(url) else "specific"
            w(f"| `{q['id']}` | `{domain}` | {official_cell} | {url_type} | {url} |")
        w()

    # NEEDS_IMAGE
    if classified["NEEDS_IMAGE"]:
        w(f"## NEEDS_IMAGE ({len(classified['NEEDS_IMAGE'])} questions)")
        w()
        w(
            "Text explicitly references a figure but the question has no `image`, "
            "`imageLink`, or `figure` field. These questions are **excluded from Adaptive "
            "Practice** and show incomplete UI in Exam/Practice modes. "
            "Official source PDFs required to fix."
        )
        w()
        w("| ID | Exam | Topic | Difficulty | Question (excerpt) |")
        w("|----|------|-------|------------|-------------------|")
        for q in classified["NEEDS_IMAGE"]:
            exam = q_to_exam.get(q["id"], "?")
            excerpt = fmt_excerpt(q.get("question", ""))
            w(
                f"| `{q['id']}` | `{exam}` "
                f"| {q.get('topic', '?')} | {q.get('difficulty', '?')} "
                f"| {excerpt} |"
            )
        w()

    # EXPLANATION_REF
    if classified["EXPLANATION_REF"]:
        w(f"## EXPLANATION_REF ({len(classified['EXPLANATION_REF'])} questions)")
        w()
        w("Explanation mentions a figure but the question body has no image field.")
        w()
        w("| ID | Exam | Topic | Explanation (excerpt) |")
        w("|----|------|-------|----------------------|")
        for q in classified["EXPLANATION_REF"]:
            exam = q_to_exam.get(q["id"], "?")
            excerpt = fmt_excerpt(q.get("explanation", ""))
            w(f"| `{q['id']}` | `{exam}` | {q.get('topic', '?')} | {excerpt} |")
        w()

    # Local image inventory
    w("## Local Image Inventory (HAS_LOCAL_IMAGE)")
    w()
    w("All questions with a local PNG confirmed present on disk:")
    w()
    w("| ID | image path | File size |")
    w("|----|-----------|----------:|")
    for q in classified["HAS_LOCAL_IMAGE"]:
        rel = q["image"].lstrip("/")
        path = (REPO_ROOT / "exam-app" / "public" / rel).resolve()
        size = f"{path.stat().st_size:,} B" if path.exists() else "?"
        w(f"| `{q['id']}` | `{q['image']}` | {size} |")
    w()

    report = "\n".join(lines) + "\n"

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report, encoding="utf-8")
        print(f"Report written: {out}", file=sys.stderr)
    else:
        sys.stdout.buffer.write(report.encode("utf-8"))


if __name__ == "__main__":
    main()
