import json
from pathlib import Path

PROGRESS_FILE = Path(__file__).parent.parent / "crawl_progress.json"

# In-memory buffer; flush to disk explicitly via flush_seen().
_pending: set[str] = set()


def load_seen() -> set[str]:
    if not PROGRESS_FILE.exists():
        return set()
    try:
        return set(json.loads(PROGRESS_FILE.read_text()))
    except (json.JSONDecodeError, ValueError):
        return set()


def mark_seen(url: str) -> None:
    """Buffer url; does NOT write to disk immediately — call flush_seen() to persist."""
    _pending.add(url)


def flush_seen() -> None:
    """Merge buffered URLs into the progress file and clear the buffer."""
    if not _pending:
        return
    seen = load_seen()
    seen.update(_pending)
    PROGRESS_FILE.write_text(json.dumps(list(seen), indent=2))
    _pending.clear()


def reset() -> None:
    _pending.clear()
    PROGRESS_FILE.write_text(json.dumps([]))
