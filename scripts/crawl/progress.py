import json
from pathlib import Path

PROGRESS_FILE = Path(__file__).parent.parent / "crawl_progress.json"


def load_seen() -> set[str]:
    if not PROGRESS_FILE.exists():
        return set()
    try:
        return set(json.loads(PROGRESS_FILE.read_text()))
    except (json.JSONDecodeError, ValueError):
        return set()


def mark_seen(url: str) -> None:
    seen = load_seen()
    seen.add(url)
    PROGRESS_FILE.write_text(json.dumps(list(seen)))


def reset() -> None:
    PROGRESS_FILE.write_text(json.dumps([]))
