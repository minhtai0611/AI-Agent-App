"""
FSRS v5 spaced-repetition algorithm — mirrors the frontend implementation exactly.

Parameters (FSRS_W) are identical to exam-app/src/pages/ReviewSession.jsx so that
server-computed next_review_date matches what the client would have computed.

Quality scale (same as frontend):
  1 = Đoán  (Again / forgot)
  3 = Khá   (Good)
  5 = Chắc  (Easy / remembered well)
"""
import math

FSRS_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]


def fsrs_update(
    stability: float,
    difficulty: float,
    elapsed: int,
    quality: int,
) -> tuple[float, float, int]:
    """
    Apply one FSRS review step and return (new_stability, new_difficulty, interval_days).

    quality: 1 | 3 | 5  (frontend scale)
    """
    stability = max(0.5, float(stability))
    difficulty = max(1.0, min(10.0, float(difficulty)))
    elapsed = max(1, int(elapsed))

    # Map frontend quality (1/3/5) to FSRS internal scale (1/3/4)
    q = 1 if quality <= 1 else (3 if quality <= 3 else 4)

    retrievability = math.exp(math.log(0.9) * elapsed / stability)

    if q >= 3:
        new_stability = stability * (
            math.exp(FSRS_W[8])
            * (11 - difficulty)
            * math.pow(stability, -FSRS_W[9])
            * (math.exp(FSRS_W[10] * (1 - retrievability)) - 1)
            + 1
        )
    else:
        new_stability = (
            FSRS_W[11]
            * math.pow(difficulty, -FSRS_W[12])
            * (math.pow(stability + 1, FSRS_W[13]) - 1)
            * math.exp(FSRS_W[14] * (1 - retrievability))
        )

    new_stability = max(0.5, new_stability)
    # interval = round(new_stability) — the log(0.9)/log(0.9) terms cancel to 1.0
    interval = max(1, round(new_stability))

    new_difficulty = max(1.0, min(10.0, difficulty + FSRS_W[6] * (3 - q)))

    return new_stability, new_difficulty, interval
