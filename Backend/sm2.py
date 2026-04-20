"""
SM-2 Spaced Repetition Algorithm
quality ratings:
  0 = complete blackout
  1 = wrong but familiar
  2 = wrong but easy to recall
  3 = correct with difficulty
  4 = correct with hesitation
  5 = perfect recall
"""

from datetime import datetime, timedelta


def calculate_sm2(quality: int, repetitions: int, easiness: float, interval: int):
    """
    Returns (new_interval_days, new_repetitions, new_easiness)
    """
    # Clamp quality
    quality = max(0, min(5, quality))

    if quality < 3:
        # Failed — reset
        repetitions = 0
        interval = 1
    else:
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * easiness)
        repetitions += 1

    # Update easiness factor (minimum 1.3)
    easiness = easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    easiness = max(1.3, round(easiness, 4))

    return interval, repetitions, easiness


def next_review_date(interval_days: int) -> str:
    """Returns ISO datetime string for next review"""
    return (datetime.utcnow() + timedelta(days=interval_days)).isoformat()


def is_due(next_review: str) -> bool:
    """Check if a card is due for review"""
    try:
        review_dt = datetime.fromisoformat(next_review)
        return datetime.utcnow() >= review_dt
    except Exception:
        return True