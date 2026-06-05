"""BanditCAT — Thompson Sampling + IRT for adaptive question selection.

Based on: BanditCAT and AutoIRT (arxiv 2410.21033, Oct 2024).

Reward = Fisher information I(θ) = a² · P(θ) · (1 - P(θ))
where P(θ) = 1 / (1 + exp(-a * (θ - b))) is the 2PL IRT response curve.

Without calibrated (a, b) per question, falls back to:
  - b = difficulty proxy: easy→-1.0, medium→0.0, hard→1.0
  - a = discrimination proxy: 1.0 (uniform)

Usage:
    theta = estimate_theta(answer_history)
    next_id = thompson_sample(questions, theta, seen_ids)
"""

import math
import random

# Default IRT parameters when calibrated values are unavailable
_DIFFICULTY_MAP = {'easy': -1.0, 'medium': 0.0, 'hard': 1.0}
_DEFAULT_A = 1.0


def _irt_prob(a: float, b: float, theta: float) -> float:
    """2PL IRT: P(correct | theta, a, b)."""
    return 1.0 / (1.0 + math.exp(-a * (theta - b)))


def fisher_information(a: float, b: float, theta: float) -> float:
    """Fisher information I(θ) = a² · P · (1 - P)."""
    p = _irt_prob(a, b, theta)
    return a * a * p * (1.0 - p)


def estimate_theta(answer_history: list[dict]) -> float:
    """Estimate student ability θ from answer history via MAP (Newton-Raphson).

    answer_history: list of {'correct': bool, 'difficulty': str, 'a': float (optional), 'b': float (optional)}
    Returns θ in approx [-3, 3].
    """
    if not answer_history:
        return 0.0

    theta = 0.0
    # 5 Newton-Raphson iterations
    for _ in range(5):
        grad = -theta / 9.0   # prior: N(0, 3²)
        hess = -1.0 / 9.0
        for item in answer_history:
            a = item.get('a', _DEFAULT_A)
            b = item.get('b', _DIFFICULTY_MAP.get(item.get('difficulty', 'medium'), 0.0))
            p = _irt_prob(a, b, theta)
            correct = item.get('correct', False)
            grad += a * (int(correct) - p)
            hess -= a * a * p * (1.0 - p)
        if abs(hess) < 1e-9:
            break
        theta = theta - grad / hess
        theta = max(-4.0, min(4.0, theta))

    return round(theta, 3)


def thompson_sample(
    questions: list[dict],
    theta: float,
    seen_ids: set,
    n: int = 1,
) -> list[str]:
    """Select n questions via Thompson Sampling maximising Fisher information.

    questions: list of {'id': str, 'difficulty': str, 'a': float (opt), 'b': float (opt)}
    seen_ids: set of question ids already shown to this student
    Returns list of selected question ids.
    """
    candidates = [q for q in questions if q.get('id') not in seen_ids]
    if not candidates:
        return []

    # Thompson Sampling: sample θ' from N(θ, σ²) and pick argmax Fisher info
    selected = []
    remaining = list(candidates)
    for _ in range(min(n, len(remaining))):
        # Sample from posterior (σ = 0.5 provides exploration)
        theta_sample = theta + random.gauss(0, 0.5)
        scores = []
        for q in remaining:
            a = q.get('a', _DEFAULT_A)
            b = q.get('b', _DIFFICULTY_MAP.get(q.get('difficulty', 'medium'), 0.0))
            scores.append(fisher_information(a, b, theta_sample))
        best_idx = scores.index(max(scores))
        selected.append(remaining[best_idx]['id'])
        remaining.pop(best_idx)

    return selected
