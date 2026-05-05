import logging
import time
from collections import deque
from threading import Lock
from typing import Optional

logger = logging.getLogger(__name__)

_counters = {
    "wiki_units_added": 0,
    "feedback_submitted": 0,
    "bm25_rebuild_count": 0,
    "bm25_rebuild_duration_s": 0.0,
}
_lock = Lock()

# Rolling window for validation rate (last 100 solutions)
_validation_window: deque[bool] = deque(maxlen=100)
_validation_lock = Lock()


def inc_wiki_units_added(n: int = 1) -> None:
    with _lock:
        _counters["wiki_units_added"] += n


def inc_feedback() -> None:
    with _lock:
        _counters["feedback_submitted"] += 1


def inc_bm25_rebuild(duration_s: float) -> None:
    with _lock:
        _counters["bm25_rebuild_count"] += 1
        _counters["bm25_rebuild_duration_s"] += duration_s


def record_validation(valid: bool) -> None:
    with _validation_lock:
        _validation_window.append(valid)


def get_metrics() -> dict:
    with _lock:
        data = _counters.copy()
    with _validation_lock:
        window_len = len(_validation_window)
        if window_len > 0:
            valid_count = sum(_validation_window)
            data["validation_rate_last_100"] = round(valid_count / window_len, 4)
        else:
            data["validation_rate_last_100"] = None

    # Alert condition
    if window_len >= 100 and data["validation_rate_last_100"] is not None and data["validation_rate_last_100"] < 0.80:
        logger.warning(
            "ALERT: Validation rate below 80%% over last %d solutions: %.2f%%",
            window_len,
            data["validation_rate_last_100"] * 100,
        )

    return data
