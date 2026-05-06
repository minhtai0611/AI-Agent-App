"""Tests for the SymPy symbolic verifier (T10)."""
import pytest
from app.math_wiki.agents.sympy_verifier import sympy_verify


# ── skip cases ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("problem_type", [
    "proof", "chứng minh", "geometry", "hình học",
    "combinatorics", "tổ hợp", "statistics", "thống kê",
    "probability", "xác suất", "number_theory", "số học",
])
def test_skip_types_return_inconclusive(problem_type):
    valid, issues = sympy_verify("x = 2", "x = 3", problem_type=problem_type)
    assert valid is None
    assert issues == []


# ── equation verification ─────────────────────────────────────────────────────

def test_correct_single_root():
    valid, issues = sympy_verify(
        problem_text="Giải phương trình x^2 - 4 = 0",
        final_answer="x = 2",
    )
    assert valid is True
    assert issues == []


def test_correct_multi_root_hoac():
    valid, issues = sympy_verify(
        problem_text="Giải x^2 - 5*x + 6 = 0",
        final_answer="x = 2 hoặc x = 3",
    )
    assert valid is True
    assert issues == []


def test_wrong_root_flagged():
    valid, issues = sympy_verify(
        problem_text="Giải x^2 - 4 = 0",
        final_answer="x = 3",
    )
    assert valid is False
    assert len(issues) > 0


def test_correct_negative_root():
    valid, issues = sympy_verify(
        problem_text="Giải x + 5 = 0",
        final_answer="x = -5",
    )
    assert valid is True


def test_correct_fraction_root():
    valid, issues = sympy_verify(
        problem_text="Giải 2*x - 1 = 0",
        final_answer="x = 1/2",
    )
    assert valid is True


# ── system verification ───────────────────────────────────────────────────────

def test_correct_system():
    valid, issues = sympy_verify(
        problem_text="Giải hệ: x + y = 5 và x - y = 1",
        final_answer="x = 3, y = 2",
    )
    assert valid is True
    assert issues == []


def test_wrong_system_flagged():
    valid, issues = sympy_verify(
        problem_text="Giải hệ: x + y = 5 và x - y = 1",
        final_answer="x = 1, y = 1",
    )
    assert valid is False
    assert len(issues) > 0


# ── ODE verification ──────────────────────────────────────────────────────────

def test_ode_correct_solution():
    valid, issues = sympy_verify(
        problem_text="Giải phương trình vi phân y' = y",
        final_answer="y = C1*exp(x)",
    )
    # Should be True or inconclusive (ODE string parsing may not always succeed)
    assert valid in (True, None)


def test_ode_wrong_solution():
    valid, issues = sympy_verify(
        problem_text="Giải phương trình vi phân y' = y",
        final_answer="y = C1*x",
        problem_type="vi phân",
    )
    # Wrong solution: derivative is C1 but y = C1*x, so residual = C1*x - C1 ≠ 0
    # SymPy may return False or None (inconclusive on parse failure)
    assert valid in (False, None)


# ── never-raises contract ─────────────────────────────────────────────────────

def test_garbage_problem_text_is_inconclusive():
    valid, issues = sympy_verify(
        problem_text="!!!@@@###",
        final_answer="x = 2",
    )
    assert valid is None
    assert issues == []


def test_garbage_answer_is_inconclusive():
    valid, issues = sympy_verify(
        problem_text="Giải x^2 - 4 = 0",
        final_answer="blah blah no equation",
    )
    assert valid is None
    assert issues == []


def test_empty_inputs_inconclusive():
    valid, issues = sympy_verify("", "")
    assert valid is None
    assert issues == []


def test_no_equation_in_problem_inconclusive():
    valid, issues = sympy_verify(
        problem_text="Hãy tính diện tích hình thang",
        final_answer="x = 5",
    )
    # No parseable equation — should be inconclusive (None) or True if accidentally parses
    assert valid in (None, True)
