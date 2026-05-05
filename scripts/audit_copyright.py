"""Task 9: Detect near-verbatim extractions from Paul's Online Math Notes.

Fetches the actual Paul's Notes pages that were crawled (from crawl_progress.json),
extracts reference sentences, then checks every manual wiki unit for similarity.

Usage:
    python3 scripts/audit_copyright.py --threshold 0.75 > flagged_copyright.csv
    python3 scripts/audit_copyright.py --threshold 0.75 --reviewed-ok reviewed_ok.csv
    python3 scripts/audit_copyright.py --threshold 0.75 --no-fetch  # use cached sentences
"""
import argparse
import csv
import difflib
import json
import re
import sqlite3
import sys
from pathlib import Path

try:
    import httpx
    from bs4 import BeautifulSoup
    _HTTP_AVAILABLE = True
except ImportError:
    _HTTP_AVAILABLE = False

DB_PATH = "math_wiki.db"
PROGRESS_FILE = Path("scripts/crawl_progress.json")
SENTENCE_CACHE = Path("scripts/.pauls_sentences_cache.json")
PAULS_HOST = "tutorial.math.lamar.edu"

# Topics whose manual units might have come from Paul's Notes.
PAULS_TOPICS = frozenset({"algebra", "calculus", "trigonometry", "differential_equations"})

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; MathWikiCrawler/1.0)"}


def _load_pauls_urls() -> list[str]:
    if not PROGRESS_FILE.exists():
        return []
    seen = json.loads(PROGRESS_FILE.read_text())
    return [u for u in seen if PAULS_HOST in u]


def _fetch_sentences(urls: list[str]) -> list[str]:
    """Fetch all Paul's Notes pages and extract content sentences."""
    if not _HTTP_AVAILABLE:
        print("httpx/bs4 not available — cannot fetch reference text.", file=sys.stderr)
        return []

    sentences: list[str] = []
    print(f"Fetching {len(urls)} Paul's Notes pages for reference text...", file=sys.stderr)

    for url in urls:
        try:
            r = httpx.get(url, headers=_HEADERS, timeout=15, follow_redirects=True)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in ["script", "style", "nav", "header", "footer"]:
                for el in soup.find_all(tag):
                    el.decompose()
            text = soup.get_text(" ")
            page_sents = [
                s.strip()
                for s in re.split(r"(?<=[.!?])\s+", text)
                if 40 <= len(s.strip()) <= 300
            ]
            sentences.extend(page_sents)
        except Exception as exc:
            print(f"  warn: {url}: {exc}", file=sys.stderr)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique = []
    for s in sentences:
        if s not in seen:
            seen.add(s)
            unique.append(s)

    print(f"Collected {len(unique)} unique reference sentences.", file=sys.stderr)
    return unique


def _load_or_fetch_sentences(no_fetch: bool) -> list[str]:
    if SENTENCE_CACHE.exists():
        cached = json.loads(SENTENCE_CACHE.read_text())
        if cached:
            print(f"Using {len(cached)} cached reference sentences.", file=sys.stderr)
            return cached

    if no_fetch:
        print("--no-fetch specified but no cache found. Run without --no-fetch first.", file=sys.stderr)
        return []

    urls = _load_pauls_urls()
    if not urls:
        print("No Paul's Notes URLs in crawl_progress.json.", file=sys.stderr)
        return []

    sentences = _fetch_sentences(urls)
    SENTENCE_CACHE.write_text(json.dumps(sentences, ensure_ascii=False))
    return sentences


def _word_ngrams(text: str, n: int = 5) -> set[tuple]:
    words = re.sub(r"[^a-z0-9 ]", " ", text.lower()).split()
    return {tuple(words[i:i+n]) for i in range(len(words) - n + 1)}


def _build_reference_index(references: list[str], n: int = 5) -> tuple[set[tuple], dict[tuple, str]]:
    """Build a set of all reference n-grams and a map ngram→representative sentence."""
    ngram_set: set[tuple] = set()
    ngram_to_sent: dict[tuple, str] = {}
    for sent in references:
        for ng in _word_ngrams(sent, n):
            ngram_set.add(ng)
            ngram_to_sent.setdefault(ng, sent)
    return ngram_set, ngram_to_sent


def _ngram_score(unit_content: str, ref_ngrams: set[tuple], ngram_to_sent: dict[tuple, str], n: int = 5) -> tuple[float, str]:
    """Fraction of unit's n-grams that appear in the reference corpus. O(n) per unit."""
    unit_ngrams = _word_ngrams(unit_content, n)
    if not unit_ngrams:
        return 0.0, ""
    hits = unit_ngrams & ref_ngrams
    if not hits:
        return 0.0, ""
    score = len(hits) / len(unit_ngrams)
    best_ref = ngram_to_sent.get(next(iter(hits)), "")
    return score, best_ref


def _load_reviewed_ok(path: str | None) -> set[str]:
    if not path or not Path(path).exists():
        return set()
    with open(path) as f:
        reader = csv.DictReader(f)
        return {row["id"] for row in reader if row.get("status") == "reviewed_ok"}


def main(threshold: float, reviewed_ok_path: str | None, no_fetch: bool) -> int:
    references = _load_or_fetch_sentences(no_fetch)
    if not references:
        print("No reference sentences — cannot audit. Exiting.", file=sys.stderr)
        return 1

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Audit all manual units in topics that Paul's Notes covers.
    topic_placeholders = ",".join("?" * len(PAULS_TOPICS))
    rows = conn.execute(
        f"SELECT id, topic, subtopic, content FROM wiki_units "
        f"WHERE deleted=0 AND source='manual' AND topic IN ({topic_placeholders})",
        list(PAULS_TOPICS),
    ).fetchall()

    print(f"Building n-gram index from {len(references)} reference sentences...", file=sys.stderr)
    ref_ngrams, ngram_to_sent = _build_reference_index(references)
    print(f"Index has {len(ref_ngrams)} unique 5-grams.", file=sys.stderr)
    print(f"Checking {len(rows)} manual units in topics: {sorted(PAULS_TOPICS)}", file=sys.stderr)

    reviewed_ok = _load_reviewed_ok(reviewed_ok_path)
    flagged: list[dict] = []

    for row in rows:
        if row["id"] in reviewed_ok:
            continue
        score, matched_ref = _ngram_score(row["content"], ref_ngrams, ngram_to_sent)
        if score >= threshold:
            flagged.append({
                "id": row["id"],
                "topic": row["topic"],
                "subtopic": row["subtopic"],
                "score": f"{score:.3f}",
                "matched_ref": matched_ref[:120],
                "content": row["content"],
            })

    writer = csv.DictWriter(
        sys.stdout,
        fieldnames=["id", "topic", "subtopic", "score", "matched_ref", "content"],
    )
    writer.writeheader()
    writer.writerows(flagged)

    print(
        f"Flagged: {len(flagged)} / {len(rows)} units at threshold {threshold}",
        file=sys.stderr,
    )
    conn.close()
    return 0 if len(flagged) == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=0.75)
    parser.add_argument("--reviewed-ok", default=None, help="CSV of reviewed_ok IDs to exclude")
    parser.add_argument("--no-fetch", action="store_true", help="Use cached sentences only")
    args = parser.parse_args()
    sys.exit(main(args.threshold, args.reviewed_ok, args.no_fetch))
