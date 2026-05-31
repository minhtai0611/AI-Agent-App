"""Concept graph traversal utilities.

Loads the concept DAG from app.data.concepts and provides:
  - get_prerequisites(concept_id, depth) → list of concept_ids
  - get_applications(concept_id)          → list of concept_ids
  - find_path(from_id, to_id)             → shortest path or []
  - topic_to_concepts(topic)              → concept_ids for a topic label

All functions are pure (no DB calls) and operate on the in-memory graph
built from CONCEPTS at import time.
"""
from __future__ import annotations
from collections import deque
from functools import lru_cache

from app.data.concepts import CONCEPTS

# ── Graph construction ─────────────────────────────────────────────────────────

_by_id: dict[str, dict] = {c["id"]: c for c in CONCEPTS}

# Forward edges: id → set of ids that *depend on* id (id is a prerequisite for them)
_dependents: dict[str, set[str]] = {c["id"]: set() for c in CONCEPTS}
# Backward edges: id → set of prerequisite ids
_prerequisites: dict[str, set[str]] = {c["id"]: set() for c in CONCEPTS}

for _c in CONCEPTS:
    for _pre in _c.get("prerequisite_ids", []):
        _prerequisites[_c["id"]].add(_pre)
        if _pre in _dependents:
            _dependents[_pre].add(_c["id"])

# topic → set of concept ids
_topic_index: dict[str, set[str]] = {}
for _c in CONCEPTS:
    _topic_index.setdefault(_c["topic"], set()).add(_c["id"])


# ── Public API ─────────────────────────────────────────────────────────────────

@lru_cache(maxsize=256)
def get_prerequisites(concept_id: str, depth: int = 2) -> list[str]:
    """Return all prerequisite concept_ids up to `depth` hops away.
    BFS through backward edges. Does not include `concept_id` itself.
    """
    if concept_id not in _by_id:
        return []
    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(concept_id, 0)])
    result: list[str] = []
    while queue:
        cid, d = queue.popleft()
        if cid in visited:
            continue
        visited.add(cid)
        if cid != concept_id:
            result.append(cid)
        if d < depth:
            for pre in _prerequisites.get(cid, set()):
                if pre not in visited:
                    queue.append((pre, d + 1))
    return result


@lru_cache(maxsize=256)
def get_applications(concept_id: str) -> list[str]:
    """Return direct dependents of concept_id (concepts that require it as prerequisite)."""
    return list(_dependents.get(concept_id, set()))


def find_path(from_id: str, to_id: str) -> list[str]:
    """BFS shortest path from from_id to to_id through prerequisite edges.
    Returns the path including both endpoints, or [] if no path exists.
    """
    if from_id not in _by_id or to_id not in _by_id:
        return []
    if from_id == to_id:
        return [from_id]
    visited: set[str] = {from_id}
    queue: deque[list[str]] = deque([[from_id]])
    while queue:
        path = queue.popleft()
        node = path[-1]
        for nxt in _dependents.get(node, set()):
            if nxt == to_id:
                return path + [to_id]
            if nxt not in visited:
                visited.add(nxt)
                queue.append(path + [nxt])
    return []


def topic_to_concepts(topic: str) -> list[str]:
    """Return all concept_ids whose topic matches the given label."""
    return list(_topic_index.get(topic, set()))


def concept_exists(concept_id: str) -> bool:
    return concept_id in _by_id
