"""
Unified math wiki capability test suite (Phase 0).

Evaluates the live pipeline against 70 structured problems across 9 categories:

  A  Bloom's Taxonomy (L1–L6, 3 tests each)  — measures reasoning depth
  B  THPT Domain Parity (6 domains × 3 difficulties) — checks curriculum coverage
  C  Retrieval Quality (10 tests) — skipped when pool=None (no wiki DB)
  D  Multi-Domain Reasoning (5 tests) — cross-topic problems
  E  Proof & Deduction (5 tests) — formal reasoning chains
  F  Figure & Visual (4 tests) — GeoGebra/SVG generation
  G  Edge Cases & Adversarial (6 tests) — undefined, impossible, out-of-scope
  H  Language & Format Quality (4 tests) — Vietnamese + LaTeX discipline

Tests are marked @pytest.mark.live_ai and require ANTHROPIC_AUTH_TOKEN to be set.
Run with: PYTHONPATH=backend python3 -m pytest backend/tests/test_wiki_math_system.py -v

A JSON gap report is written to backend/tests/math_wiki_gap_report.json after the session.
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import pytest

# ── fixtures ──────────────────────────────────────────────────────────────────

def _token_is_real() -> bool:
    # Try shell env first; fall back to pydantic-settings (.env file)
    token = os.environ.get("ANTHROPIC_AUTH_TOKEN", "")
    if not token:
        try:
            from app.config import get_settings
            token = get_settings().anthropic_auth_token
        except Exception:
            return False
    return bool(token) and token not in ("your_token_here", "sk-...")

@pytest.fixture(scope="session")
def ai_client():
    if not _token_is_real():
        pytest.skip("ANTHROPIC_AUTH_TOKEN not set — skipping live_ai tests")
    from openai import AsyncOpenAI
    from app.config import get_settings
    settings = get_settings()
    return AsyncOpenAI(
        base_url=settings.anthropic_base_url.rstrip("/") + "/v2",
        api_key=settings.anthropic_auth_token,
    )


@pytest.fixture(scope="session", autouse=True)
def bm25_ready():
    """Ensure BM25 event is set so pipeline doesn't block waiting for DB load."""
    import app.math_wiki.pipeline as pm
    pm._bm25_ready_event.set()


@pytest.fixture(scope="session")
def gap_report():
    """Accumulates per-test results; written to disk at session end."""
    results: list[dict] = []
    yield results
    _write_gap_report(results)


# ── answer checker ────────────────────────────────────────────────────────────

_LATEX_STRIP_RE = re.compile(r'[$\\{}]|\\[a-zA-Z]+')
_SPACE_RE = re.compile(r'\s+')

def _normalize(text: str) -> str:
    """Strip LaTeX markup and collapse whitespace for loose comparison."""
    # Convert common LaTeX math symbols to text equivalents BEFORE stripping markup
    # so that e.g. \pi → pi survives the strip and can be matched.
    text = (text
        .replace('\\pi', 'pi').replace('\\alpha', 'alpha').replace('\\beta', 'beta')
        .replace('\\sqrt', 'sqrt').replace('\\infty', 'infty').replace('\\frac', 'frac')
        .replace('\\cdot', '.').replace('\\times', 'x').replace('\\pm', '+-')
    )
    text = _LATEX_STRIP_RE.sub(' ', text)
    text = _SPACE_RE.sub(' ', text).strip().lower()
    # Normalize common Vietnamese number representations and Unicode symbols
    text = text.replace(',', '.').replace('−', '-').replace('π', 'pi')
    text = text.replace('±', '±')  # preserve ± as-is for matching
    return text


def _answer_matches(final_answer: str, expected: str | list[str]) -> bool:
    """Return True if any expected phrase (after normalization) appears in final_answer."""
    if not expected:
        return True
    norm_actual = _normalize(final_answer)
    candidates = [expected] if isinstance(expected, str) else expected
    for cand in candidates:
        if _normalize(cand) in norm_actual:
            return True
    return False


# ── language / format checkers ────────────────────────────────────────────────

_ENGLISH_WORD_RE = re.compile(
    r'\b(the|and|so|or|we|have|that|this|step|since|because|where|let|note|'
    r'first|then|finally|therefore|thus|hence|but|also|if|for|is|are|was|were|'
    r'with|from|of|to|in|on|at|by|as)\b',
    re.IGNORECASE
)
_LATEX_MATH_RE = re.compile(r'\$[^$]+\$')
_UNICODE_MATH_RE = re.compile(r'[∫∑∏√±×÷≠≤≥∞→←↔∈∉⊂⊃∪∩∀∃]')
_BUOC_RE = re.compile(r'Bước\s+\d+\s*:', re.UNICODE)


def _check_language(steps: list[str]) -> list[str]:
    """Return list of format violation descriptions (empty = clean)."""
    issues: list[str] = []
    joined = ' '.join(steps)

    # Check for leaked English words
    eng_matches = _ENGLISH_WORD_RE.findall(joined)
    if eng_matches:
        issues.append(f"English words leaked: {set(eng_matches)}")

    # Math must be inside $...$; bare Unicode math symbols are a violation
    outside_latex = _LATEX_MATH_RE.sub('', joined)
    unicode_math = _UNICODE_MATH_RE.findall(outside_latex)
    if unicode_math:
        issues.append(f"Unicode math outside $...$: {set(unicode_math)}")

    # Each step must start with "Bước N:"
    for i, step in enumerate(steps):
        if step.strip() and not _BUOC_RE.match(step.strip()):
            issues.append(f"Step {i+1} missing 'Bước N:' prefix: {step[:60]!r}")
            break  # Report only the first violation to keep output clean

    return issues


def _final_answer_in_last_step(final_answer: str, steps: list[str]) -> bool:
    """Check that the final answer text appears (normalized) in the last step."""
    if not steps or not final_answer:
        return False
    last = _normalize(steps[-1])
    norm_ans = _normalize(final_answer)
    if not norm_ans:
        return True
    # Direct substring check after normalization (LaTeX stripped from both sides)
    return norm_ans in last


# ── core test runner ──────────────────────────────────────────────────────────

def _run_pipeline_sync(client, question: str) -> dict:
    """Run run_pipeline with pool=None (no retrieval, LLM-only)."""
    import time
    from app.math_wiki.pipeline import run_pipeline

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(run_pipeline(None, client, question))
    except Exception as exc:
        # Unwrap tenacity RetryError → check root cause
        cause = getattr(exc, "__cause__", None) or exc
        cause_str = f"{type(cause).__name__}: {cause}"
        full_str = f"{type(exc).__name__}: {exc} | cause: {cause_str}"
        is_transient = (
            "429" in full_str
            or "503" in full_str
            or "RateLimitError" in full_str
            or "InternalServerError" in full_str
            or "cooling down" in full_str
            or "auth_unavailable" in full_str
            or "rate_limit" in full_str.lower()
            or "no auth available" in full_str
        )
        if is_transient:
            pytest.skip(f"Upstream API unavailable — retry later ({cause_str[:120]})")
        raise
    finally:
        loop.close()


def _evaluate(tc: dict, result: dict) -> dict[str, Any]:
    """Return a structured evaluation record for one test case."""
    rec: dict[str, Any] = {
        "id": tc["id"],
        "category": tc["category"],
        "bloom_level": tc["bloom_level"],
        "topic": tc["topic"],
        "difficulty": tc["difficulty"],
        "question": tc["question"][:80],
        "notes": tc["notes"],
    }

    # Pipeline error / insufficient knowledge
    if "error" in result:
        rec.update({
            "passed": False,
            "error": result["error"],
            "confidence": None,
            "valid": None,
            "answer_correct": False,
            "language_issues": [],
            "figure_generated": False,
        })
        return rec

    answer: dict = result.get("answer", {})
    final_ans: str = answer.get("final_answer", "")
    steps: list[str] = answer.get("steps", [])
    confidence: str = answer.get("confidence", "unknown")
    validation: dict = result.get("validation", {})
    is_valid: bool = validation.get("valid", False)
    figure = answer.get("figure")
    figure_generated = bool(figure and figure.get("data"))

    # Answer correctness
    answer_correct = _answer_matches(final_ans, tc["expected_answer"])

    # Validation alignment
    # Only mark valid_ok=False when expected_valid=False (edge-case rejection).
    # expected_valid=True is informational — validator JSON parse failures are common.
    ev = tc["expected_valid"]
    valid_ok = True
    if ev is False:
        refusal_keywords = [
            "vô nghiệm", "không tồn tại", "không xác định", "undefined",
            "ngoài phạm vi", "không hỗ trợ", "vô lý", "mâu thuẫn", "∅"
        ]
        refusal = any(kw in final_ans.lower() for kw in refusal_keywords)
        valid_ok = (not is_valid) or refusal

    # Language / format checks (only meaningful for Vietnamese steps)
    lang_issues: list[str] = []
    if steps:
        lang_issues = _check_language(steps)
        if not _final_answer_in_last_step(final_ans, steps):
            lang_issues.append("final_answer not echoed in last step")

    # Figure check
    figure_ok = True
    if tc["check_figure"]:
        figure_ok = figure_generated

    # Format only counts against pass for Category H (explicit format test)
    format_ok = (not lang_issues) if tc["category"] == "H" else True
    passed = answer_correct and valid_ok and format_ok and figure_ok

    rec.update({
        "passed": passed,
        "error": None,
        "confidence": confidence,
        "valid": is_valid,
        "answer_correct": answer_correct,
        "valid_ok": valid_ok,
        "language_issues": lang_issues,
        "figure_generated": figure_generated,
        "figure_required": tc["check_figure"],
        "final_answer": final_ans[:120],
    })
    return rec


# ── gap report writer ─────────────────────────────────────────────────────────

def _write_gap_report(results: list[dict]) -> None:
    if not results:
        return

    by_cat: dict[str, list[dict]] = {}
    for r in results:
        by_cat.setdefault(r["category"], []).append(r)

    cat_summary: dict[str, dict] = {}
    for cat, recs in sorted(by_cat.items()):
        total = len(recs)
        passed = sum(1 for r in recs if r.get("passed"))
        high_conf_wrong = [
            r for r in recs if r.get("confidence") == "high" and not r.get("answer_correct")
        ]
        cat_summary[cat] = {
            "total": total,
            "passed": passed,
            "pass_rate": round(passed / total, 2) if total else 0,
            "high_confidence_wrong": len(high_conf_wrong),
            "failures": [r["id"] for r in recs if not r.get("passed")],
        }

    all_passed = sum(v["passed"] for v in cat_summary.values())
    all_total = len(results)
    all_high_conf_wrong = sum(v["high_confidence_wrong"] for v in cat_summary.values())

    # Confidence calibration (Category I)
    all_recs_with_conf = [r for r in results if r.get("confidence") and r.get("answer_correct") is not None]
    high_conf = [r for r in all_recs_with_conf if r.get("confidence") == "high"]
    high_conf_correct_rate = (
        round(sum(1 for r in high_conf if r["answer_correct"]) / len(high_conf), 2)
        if high_conf else None
    )

    report = {
        "summary": {
            "total": all_total,
            "passed": all_passed,
            "pass_rate": round(all_passed / all_total, 2) if all_total else 0,
            "high_confidence_wrong_count": all_high_conf_wrong,
            "high_confidence_correct_rate": high_conf_correct_rate,
            "calibration_target": 0.85,
            "calibration_ok": (high_conf_correct_rate or 0) >= 0.85 if high_conf else None,
        },
        "by_category": cat_summary,
        "all_results": results,
    }

    report_path = Path(__file__).parent / "math_wiki_gap_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\n📊 Gap report written → {report_path}")
    print(f"   Overall: {all_passed}/{all_total} passed ({round(all_passed/all_total*100)}%)")
    for cat, s in sorted(cat_summary.items()):
        bar = "✓" if s["pass_rate"] >= 0.70 else ("⚠" if s["pass_rate"] >= 0.40 else "✗")
        print(f"   {bar} Cat {cat}: {s['passed']}/{s['total']} ({int(s['pass_rate']*100)}%) "
              f"| high-conf wrong: {s['high_confidence_wrong']}")
    if all_high_conf_wrong:
        print(f"\n   ⚠  HIGH-CONFIDENCE WRONG ANSWERS: {all_high_conf_wrong} (critical failures)")


# ── parametrized test ─────────────────────────────────────────────────────────

from tests.fixtures.math_test_cases import MATH_TEST_CASES

def _test_id(tc: dict) -> str:
    return tc["id"]


@pytest.mark.live_ai
@pytest.mark.parametrize("tc", MATH_TEST_CASES, ids=_test_id)
def test_pipeline_problem(tc: dict, ai_client, gap_report):
    """Run one problem through run_pipeline() and evaluate the result."""
    import time

    # Category C requires a real pool — skip when running without DB
    if tc["category"] == "C":
        pytest.skip("Category C requires populated wiki DB (pool=None in CI)")

    # Throttle: small delay between tests to respect API rate limits
    time.sleep(1.5)

    result = _run_pipeline_sync(ai_client, tc["question"])
    rec = _evaluate(tc, result)
    gap_report.append(rec)

    # ── Assertions ──────────────────────────────────────────────────

    # The pipeline must always return a structured response (never crash)
    assert "error" in result or "answer" in result, (
        f"[{tc['id']}] Pipeline returned neither 'answer' nor 'error' key"
    )

    if "error" in result:
        # INSUFFICIENT_KNOWLEDGE is acceptable for Category E (proofs) and G (impossible)
        if tc["category"] not in ("E", "G"):
            pytest.fail(f"[{tc['id']}] Unexpected pipeline error: {result['error']}")
        return

    answer = result.get("answer", {})
    final_ans = answer.get("final_answer", "")
    steps = answer.get("steps", [])
    confidence = answer.get("confidence", "")

    # Must always produce a non-empty answer and at least one step
    assert final_ans, f"[{tc['id']}] final_answer is empty"
    assert steps, f"[{tc['id']}] steps list is empty"
    assert confidence in ("high", "medium", "low"), (
        f"[{tc['id']}] confidence must be high/medium/low, got {confidence!r}"
    )

    # ── Language / format ──
    # Category H: hard-fail on any format violation (format is the explicit test goal).
    # All other categories: record violations in the gap report but don't block pass/fail —
    # we want to measure math correctness separately from format compliance.
    lang_issues = _check_language(steps)
    if tc["category"] == "H":
        assert not lang_issues, (
            f"[{tc['id']}] Language/format violations:\n" + "\n".join(f"  • {i}" for i in lang_issues)
        )

    # ── Answer correctness ──
    if tc["expected_answer"]:
        assert _answer_matches(final_ans, tc["expected_answer"]), (
            f"[{tc['id']}] Wrong answer.\n"
            f"  Expected to contain: {tc['expected_answer']}\n"
            f"  Got: {final_ans!r}"
        )

    # ── Validation alignment ──
    # expected_valid=False (edge cases): hard-fail if the system accepts something impossible.
    # expected_valid=True: informational only — validator JSON parse failures are common and
    # should not mask correctness signal. Recorded in gap report via valid_ok field.
    validation = result.get("validation", {})
    is_valid = validation.get("valid", False)
    ev = tc["expected_valid"]
    if ev is False:
        refusal_keywords = [
            "vô nghiệm", "không tồn tại", "không xác định", "undefined",
            "ngoài phạm vi", "không hỗ trợ", "vô lý", "mâu thuẫn",
        ]
        refusal = any(kw in final_ans.lower() for kw in refusal_keywords)
        assert (not is_valid) or refusal, (
            f"[{tc['id']}] Edge case: expected refusal or invalid=False.\n"
            f"  final_answer={final_ans!r}\n"
            f"  valid={is_valid}"
        )

    # ── Figure check ──
    if tc["check_figure"]:
        fig = answer.get("figure")
        assert fig and fig.get("data"), (
            f"[{tc['id']}] Expected a figure to be generated but got None/empty"
        )

    # ── Critical failure guard: high-confidence wrong answer ──
    if confidence == "high" and tc["expected_answer"]:
        if not _answer_matches(final_ans, tc["expected_answer"]):
            pytest.fail(
                f"[{tc['id']}] CRITICAL: high-confidence WRONG answer.\n"
                f"  Expected: {tc['expected_answer']}\n"
                f"  Got: {final_ans!r}"
            )
