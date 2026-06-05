"""Kalman-filter score predictor.

Models student ability as a 1-D random walk. Each exam score is a noisy
measurement of current ability. The filter naturally produces a
(predicted, uncertainty) pair that replaces the former ±0.5 hardcoded interval.

Falls back to exponential weighted average when fewer than 3 exams exist.
"""
import math


def kalman_predict(scores: list[float]) -> dict:
    """Return predicted score and confidence given a chronological list of scores (0–10).

    Returns:
        { "predicted": float, "low": float, "high": float,
          "confidence": "high"|"medium"|"low", "sample_size": int }
    """
    n = len(scores)
    if n == 0:
        return {"predicted": None, "low": None, "high": None, "confidence": "low", "sample_size": 0}

    if n < 3:
        # Too few observations — simple average
        avg = sum(scores) / n
        return {
            "predicted": round(avg, 1),
            "low": round(max(0.0, avg - 1.0), 1),
            "high": round(min(10.0, avg + 1.0), 1),
            "confidence": "low",
            "sample_size": n,
        }

    # Kalman filter parameters
    Q = 0.4   # process noise — how much ability shifts per exam
    R = 1.2   # measurement noise — score variance per exam

    x = scores[0]
    P = 4.0   # initial uncertainty (high — we know nothing yet)

    for s in scores[1:]:
        # Predict
        P_pred = P + Q
        # Update
        K = P_pred / (P_pred + R)
        x = x + K * (s - x)
        P = (1.0 - K) * P_pred

    # 90% confidence interval: ±1.645 * sigma (sigma = sqrt of posterior + measurement noise)
    sigma = math.sqrt(P + R)
    ci = 1.645 * sigma
    predicted = round(max(0.0, min(10.0, x)), 1)
    low = round(max(0.0, x - ci), 1)
    high = round(min(10.0, x + ci), 1)

    # Confidence tier based on posterior variance + sample count
    if n >= 7 and P < 0.5:
        confidence = "high"
    elif n >= 4 or P < 1.5:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "predicted": predicted,
        "low": low,
        "high": high,
        "confidence": confidence,
        "sample_size": n,
    }
