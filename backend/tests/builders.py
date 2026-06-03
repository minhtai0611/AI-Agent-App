"""
Test data builders — provide sensible defaults so new required fields
break only the builder, not every test that uses it.

Usage:
    pool = PoolBuilder().with_credits(0).build_mock()
    user = UserBuilder().suspended().build()
    pool.fetchrow = AsyncMock(return_value=FULL_USER_ROW)  # for auth endpoint tests
"""
from dataclasses import dataclass, field, asdict
from unittest.mock import AsyncMock, MagicMock


# ── FULL_USER_ROW ─────────────────────────────────────────────────────────────
# A dict that satisfies EVERY pool.fetchrow call in the app:
#   get_current_user  → needs is_suspended, is_locked, is_deactivated, etc.
#   get_me            → needs the full user column set
#   _spend_credits    → needs credits_balance, tos_accepted_at
#   get_session_today → needs cnt, exam_date, weekly_study_hours
#   auth_google       → needs trial_used, id, email, custom_display_name
#
# Use this in tests that set app.state.pool directly (auth / user endpoint tests).
# PoolBuilder.build_mock() returns a subset; this is the full version.

FULL_USER_ROW: dict = {
    # identity
    "id": 1,
    "email": "user@example.com",
    "display_name": "Test User",
    "custom_display_name": None,
    "avatar_url": "https://example.com/avatar.jpg",
    "google_sub": "google-sub-123",
    "referral_code": "testref1",
    # subscription
    "subscription_tier": "student",
    "subscription_period": "monthly",
    "subscription_expires_at": None,
    "credits_balance": 100,
    "credits_reset_at": None,
    # account status (read by get_current_user in dependencies.py)
    "is_suspended": 0,
    "suspension_reason": None,
    "is_locked": 0,
    "lock_reason": None,
    "is_deactivated": 0,
    "tos_accepted_at": "2024-01-01T00:00:00",
    # trial
    "trial_used": 0,
    "trial_expires_at": None,
    # profile
    "grade": "12",
    "school_type": None,
    "province": "Hà Nội",
    "target_school": None,
    "exam_date": None,
    "weekly_study_hours": 5,
    "extended_onboarding_done": 0,
    # streak freeze
    "streak_freeze_count": 2,
    "streak_freeze_reset_at": "2024-01-01T00:00:00",  # set so replenish skips
    # aggregate / COUNT(*) queries
    "cnt": 0,
    # security events
    "event_type": None,
    "confidence": None,
    "detail": None,
    "created_at": "2024-01-01T00:00:00",
    "ip": None,
    # deleted subs check (auth_google)
    "trial_used": 0,
}


# ── UserBuilder ───────────────────────────────────────────────────────────────

@dataclass
class UserBuilder:
    user_id: int = 1
    email: str = "test@example.com"
    grade: str = "12"
    province: str = "Hà Nội"
    tier: str = "student"
    credits: int = 20
    tos_accepted_at: str = "2024-01-01T00:00:00"
    is_suspended: bool = False
    is_locked: bool = False
    is_deactivated: bool = False

    def with_credits(self, n: int) -> "UserBuilder":
        self.credits = n
        return self

    def with_tier(self, t: str) -> "UserBuilder":
        self.tier = t
        return self

    def with_province(self, p: str) -> "UserBuilder":
        self.province = p
        return self

    def no_tos(self) -> "UserBuilder":
        self.tos_accepted_at = None
        return self

    def suspended(self) -> "UserBuilder":
        self.is_suspended = True
        return self

    def locked(self) -> "UserBuilder":
        self.is_locked = True
        return self

    def build(self) -> dict:
        return asdict(self)


# ── PoolBuilder ───────────────────────────────────────────────────────────────

@dataclass
class PoolBuilder:
    """Builds an AsyncMock pool whose fetchrow/execute return values
    match what the route handlers actually query."""
    tier: str = "student"
    credits: int = 20
    tos_accepted_at: str = "2024-01-01T00:00:00"
    province: str = None
    is_suspended: bool = False
    is_locked: bool = False
    is_deactivated: bool = False
    # Controls whether UPDATE credits returns "UPDATE 1" or "UPDATE 0"
    credits_update_succeeds: bool = True

    def with_credits(self, n: int) -> "PoolBuilder":
        self.credits = n
        self.credits_update_succeeds = n > 0
        return self

    def with_tier(self, t: str) -> "PoolBuilder":
        self.tier = t
        return self

    def no_tos(self) -> "PoolBuilder":
        self.tos_accepted_at = None
        return self

    def build_mock(self) -> MagicMock:
        pool = MagicMock()
        row = {
            "subscription_tier": self.tier,
            "credits_balance": self.credits,
            "tos_accepted_at": self.tos_accepted_at,
            "province": self.province,
            # Fields read by get_current_user (when not overridden)
            "is_suspended": self.is_suspended,
            "suspension_reason": "",
            "is_locked": self.is_locked,
            "lock_reason": "",
            "is_deactivated": self.is_deactivated,
            # Fields read by get_session_today
            "cnt": 0,
            "id": None,
            "exam_date": None,
            "weekly_study_hours": 5,
        }
        pool.fetchrow = AsyncMock(return_value=row)
        pool.fetch = AsyncMock(return_value=[])
        execute_result = "UPDATE 1" if self.credits_update_succeeds else "UPDATE 0"
        pool.execute = AsyncMock(return_value=execute_result)
        return pool


# ── CompletionBuilder ─────────────────────────────────────────────────────────

def make_completion(content: str) -> MagicMock:
    """Build a fake openai ChatCompletion response with the given message content."""
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    choice.finish_reason = "stop"
    resp = MagicMock()
    resp.choices = [choice]
    return resp


# ── Standard request bodies ───────────────────────────────────────────────────

MOCK_QUESTION = {
    "id": "q_001",
    "topic": "Algebra",
    "difficulty": "medium",
    "question": "Giải phương trình 2x + 3 = 7",
    "choices": ["x = 1", "x = 2", "x = 3", "x = 4"],
    "correct": 1,
}

MOCK_RESULT = {
    "score": 7.5,
    "accuracy": 0.75,
    "topicBreakdown": {
        "algebra": {"correct": 5, "total": 8, "accuracy": 0.625},
        "geometry": {"correct": 2, "total": 6, "accuracy": 0.333},
    },
    "examId": "test_exam",
    "timeSpent": 1800,
}

ENDPOINT_DEFAULT_BODIES = {
    "/hint": {"question": MOCK_QUESTION, "attempt_count": 1},
    "/analyze": {"result": MOCK_RESULT, "history": []},
    "/study-plan": {"result": MOCK_RESULT, "history": []},
    "/explain": {
        "question": MOCK_QUESTION,
        "chosen_index": 1,
    },
}
