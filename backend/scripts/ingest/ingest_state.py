"""Tracks which source keys have already been ingested (prevents re-runs)."""
import json
import os

_STATE_PATH = os.path.join(os.path.dirname(__file__), 'ingest_state.json')


def _load() -> dict:
    if not os.path.exists(_STATE_PATH):
        return {}
    try:
        with open(_STATE_PATH) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save(state: dict) -> None:
    with open(_STATE_PATH, 'w') as f:
        json.dump(state, f, indent=2)


def is_ingested(source_key: str) -> bool:
    return bool(_load().get(source_key))


def mark_ingested(source_key: str) -> None:
    state = _load()
    state[source_key] = True
    _save(state)


def list_pending(all_keys: list[str]) -> list[str]:
    state = _load()
    return [k for k in all_keys if not state.get(k)]
