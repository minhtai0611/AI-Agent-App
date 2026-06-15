"""Knowledge Space Theory helpers for Zenith.

Core primitives:
  build_concept_graph  — dict {concept_id: [prerequisite_ids]}
  outer_fringe         — concepts ready to learn (all prereqs mastered)
  learning_path        — BFS-ordered prerequisite chain from gap to target
  topic_to_concept_ids — map canonical topic slug → concept ids (for exam gap analysis)
"""

from __future__ import annotations
import json


# ── In-memory graph (avoids repeated DB reads for read-only paths) ────────────

def build_concept_graph(concepts: list[dict]) -> dict[str, list[str]]:
    """Return {concept_id: [prerequisite_ids]} from the CONCEPTS list."""
    return {c["id"]: list(c.get("prerequisite_ids") or []) for c in concepts}


def outer_fringe(knowledge_state: set[str], concept_graph: dict[str, list[str]]) -> set[str]:
    """KST outer fringe: concepts whose ALL prerequisites are mastered.

    These are the concepts a student is ready to learn next.
    """
    fringe: set[str] = set()
    for concept_id, prereqs in concept_graph.items():
        if concept_id in knowledge_state:
            continue
        if all(p in knowledge_state for p in prereqs):
            fringe.add(concept_id)
    return fringe


def knowledge_state_from_mastery(
    mastery_rows: list[dict],
    threshold: float = 0.70,
) -> set[str]:
    """Convert mastery score rows to a binary knowledge state set.

    A concept is considered mastered when mastery_score >= threshold * 100
    (scores are stored as 0–100 integers in the DB).
    """
    cutoff = threshold * 100
    return {
        r["concept_id"]
        for r in mastery_rows
        if (r.get("mastery_score") or 0) >= cutoff
    }


def learning_path(
    knowledge_state: set[str],
    target_concept_ids: list[str],
    concept_graph: dict[str, list[str]],
    concepts_by_id: dict[str, dict],
    max_depth: int = 8,
) -> list[dict]:
    """BFS from the boundary of knowledge_state toward each target concept.

    Returns an ordered list of concept dicts (prerequisites first, targets last)
    that the student needs to study. Already-mastered concepts are excluded.
    Concepts are deduplicated and topologically ordered.
    """
    # Build reverse adjacency: {concept_id: [concepts that depend on it]}
    dependents: dict[str, list[str]] = {cid: [] for cid in concept_graph}
    for cid, prereqs in concept_graph.items():
        for p in prereqs:
            if p in dependents:
                dependents[p].append(cid)

    # Collect all prerequisites (transitively) needed for every target
    needed: set[str] = set()

    def _collect(cid: str, depth: int) -> None:
        if depth > max_depth or cid in needed:
            return
        if cid in knowledge_state:
            return
        needed.add(cid)
        for prereq in concept_graph.get(cid, []):
            _collect(prereq, depth + 1)

    for t in target_concept_ids:
        _collect(t, 0)

    if not needed:
        return []

    # Topological sort (Kahn's algorithm) over `needed`
    in_degree: dict[str, int] = {}
    for cid in needed:
        in_degree[cid] = sum(1 for p in concept_graph.get(cid, []) if p in needed)

    queue = sorted(
        [c for c, d in in_degree.items() if d == 0],
        key=lambda c: (concepts_by_id.get(c, {}).get("grade", 9), c),
    )
    ordered: list[str] = []
    while queue:
        node = queue.pop(0)
        ordered.append(node)
        for dep in dependents.get(node, []):
            if dep in needed:
                in_degree[dep] -= 1
                if in_degree[dep] == 0:
                    queue.append(dep)
                    queue.sort(key=lambda c: (concepts_by_id.get(c, {}).get("grade", 9), c))

    result = []
    for cid in ordered:
        c = concepts_by_id.get(cid)
        if c:
            result.append({
                "id": cid,
                "name_vi": c.get("name_vi", cid),
                "grade": c.get("grade"),
                "topic": c.get("topic"),
                "exam_weight": c.get("exam_weight"),
                "is_target": cid in target_concept_ids,
            })
    return result


def topic_to_concept_ids(topic: str, concepts: list[dict]) -> list[str]:
    """Return concept IDs whose topic matches the given canonical topic slug."""
    return [c["id"] for c in concepts if c.get("topic") == topic]


# ── DB-backed graph builder (for endpoints that need live edges) ──────────────

async def concept_graph_from_db(pool) -> dict[str, list[str]]:
    """Fetch concept_edges from DB and return {concept_id: [prereq_ids]}."""
    rows = await pool.fetch("SELECT from_id, to_id FROM concept_edges")
    graph: dict[str, list[str]] = {}
    for r in rows:
        to_id = r["to_id"]
        if to_id not in graph:
            graph[to_id] = []
        graph[to_id].append(r["from_id"])
    return graph


def parse_prerequisite_ids(raw) -> list[str]:
    """Parse prerequisite_ids field — may be a JSON string or a Python list."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return []
    return []
