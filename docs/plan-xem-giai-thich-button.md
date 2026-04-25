# Implementation Plan: "Xem giải thích" Button After Hints Exhausted

## Overview

When all 3 hints are revealed in practice mode (before submitting), the current UI renders a dead `<a href="#explanation">` anchor that scrolls nowhere. This plan replaces it with a real button that toggles an inline explanation panel showing the correct answer and `question.explanation` from the question data — no new backend endpoint needed, since the explanation text is already in the question object.

## Architecture Decisions

- **Static explanation, not AI-generated** — `question.explanation` already exists in question data; generating a new AI response adds latency, cost, and a backend round-trip for information already available. AI generation can be added later if richer explanations are needed.
- **Local state only** — `showExplanation` lives in `QuestionCard`; not in `ExamContext`. Resets automatically via React's `key={question.id}` remount in `TestInterface`.
- **No `useEffect` for state reset** — `TestInterface` mounts `<QuestionCard key={question.id}>`, so React fully unmounts and remounts the component on every question navigation. Local state resets for free; a `useEffect` would be dead code.
- **Mutual exclusivity enforced by guard** — when `showFeedback` is true (user answered), both the toggle button and explanation panel are hidden, because `showFeedback` already renders the answer and explanation in the feedback block above. A simple `&& !showFeedback` in the JSX condition is sufficient — no `useEffect` on `chosen` needed.
- **No answer auto-submit** — revealing the explanation does not call `onAnswer` or change `submitted`; the student still controls when/whether to submit.

## GitNexus Audit Results

**Blast radius: LOW**

- `QuestionCard` has **0 upstream graph callers** — JSX usage by `TestInterface` does not produce a CALLS edge.
- Only downstream dependency is `choiceStyle` (pure helper, same file, untouched).
- Changes are fully self-contained to `exam-app/src/components/QuestionCard.jsx`.

**Two bugs found and fixed vs. initial draft:**

1. **Task 1's `useEffect` reset was unnecessary** — `key={question.id}` on `<QuestionCard>` in `TestInterface` (line 143) already remounts the component on question change. Removed the `useEffect`.
2. **"Can't coexist" claim was wrong** — a user CAN exhaust 3 hints → open explanation → then answer, causing both `showFeedback` and the explanation panel to render simultaneously and duplicate content. Fixed by adding `!showFeedback` to the outer block condition in Task 2.

---

## Task List

### Task 1 — Add `showExplanation` state

**Description:** Add `const [showExplanation, setShowExplanation] = useState(false)` alongside the existing `hintLoading`/`hintError` state. No `useEffect` — React's `key={question.id}` mount in `TestInterface` resets all local state automatically on question change.

**Acceptance criteria:**
- [ ] `showExplanation` state declared inside `QuestionCard`, defaulting to `false`
- [ ] No `useEffect` added for resetting it (would be dead code)
- [ ] No other changes in this task

**Verification:**
- [ ] `npm run dev` — component renders, no console errors

**Dependencies:** None
**Files:** `exam-app/src/components/QuestionCard.jsx` (~line 19)
**Scope:** XS

---

### Task 2 — Replace dead anchor with a proper toggle button

**Description:** Replace the `<a href="#explanation">` (lines 104–109) with a `<button>` that calls `setShowExplanation(v => !v)`. Label toggles between `"Xem giải thích"` and `"Ẩn giải thích"`. Add `!showFeedback` to the outer condition (currently `practiceMode && !submitted`) so the entire hint+explanation block hides once the user answers — the feedback block above already shows the answer at that point.

**Acceptance criteria:**
- [ ] Dead `<a href="#explanation">` is removed
- [ ] Outer block condition is `practiceMode && !submitted && !showFeedback`
- [ ] Button label is `"Xem giải thích"` when `showExplanation === false`, `"Ẩn giải thích"` when true
- [ ] Button `onClick={() => setShowExplanation(v => !v)}`
- [ ] `📖` icon to the left of the label (distinguishable from `💡` hint icon)
- [ ] Same visual style as the hint button: `self-start border-[#2A3A60] bg-[#111827] font-jakarta text-[12px]`

**Verification:**
- [ ] In practice mode with 3 hints shown, button renders and toggles label on click
- [ ] After answering (showFeedback active), the entire hint+explanation block disappears — verified manually

**Dependencies:** Task 1
**Files:** `exam-app/src/components/QuestionCard.jsx` (lines 88, 103–109)
**Scope:** S

---

### Task 3 — Render inline explanation panel

**Description:** Below the toggle button (inside the same `flex flex-col gap-2` container), conditionally render an explanation panel when `showExplanation === true`. Shows: (1) correct answer label in amber, (2) `question.explanation` body text. Fallback: if `question.explanation` is falsy, show the label only — no empty `<p>`. Style matches the existing `showFeedback` panel. Safe accessor `LABELS[question.correct] ?? '?'` guards against missing `correct` field.

**Acceptance criteria:**
- [ ] Panel absent from DOM when `showExplanation === false`
- [ ] Panel shows `"Đáp án đúng: <LETTER>"` using `LABELS[question.correct] ?? '?'`
- [ ] Panel shows `question.explanation` body only when it is truthy
- [ ] Panel styled with `border-[#1A4A2A] bg-[#0A1F14]`; answer label `text-[#F2A20C]`; body text `text-[#6EE7B7]`
- [ ] Panel never appears when `showFeedback` is true (guaranteed by Task 2's outer condition)

**Verification:**
- [ ] Exhaust 3 hints → click button → panel appears with correct letter and explanation text
- [ ] Toggle "Ẩn giải thích" → panel disappears
- [ ] Answer question after exhausting hints → entire block (button + panel) vanishes; feedback block above is the only explanation shown
- [ ] Question with no `explanation` field shows label only, no crash

**Dependencies:** Task 2
**Files:** `exam-app/src/components/QuestionCard.jsx` (inside `hintCount >= MAX_HINTS` branch)
**Scope:** S

---

### Checkpoint — Full verification

- [ ] `npm run dev` — no console errors
- [ ] Hint flow 0→1→2→3 still works unmodified
- [ ] After 3rd hint: "Xem giải thích" button appears
- [ ] Clicking reveals explanation panel; clicking again hides it
- [ ] Answering collapses the whole hint/explanation block; `showFeedback` block remains
- [ ] Navigating to next question: hints and explanation reset (verified via `key={question.id}` remount)
- [ ] `npm run build` exits 0

---

## Risk Table

| Risk | Impact | Mitigation |
|------|--------|------------|
| `question.explanation` absent for many questions | Low | Inline fallback: show answer label only (Task 3 criteria) |
| ~~`showExplanation` leaking across questions~~ | ~~Low~~ | **Eliminated** — `key={question.id}` remount handles it; no extra code needed |
| ~~showFeedback + showExplanation duplicating content~~ | ~~Medium~~ | **Eliminated** — `!showFeedback` guard on outer condition (Task 2) |
| `LABELS[question.correct]` out-of-bounds | Low | `?? '?'` safe accessor in Task 3 |

## Open Questions

- Should revealing the explanation automatically call `onAnswer(question.correct)` to mark the question answered? Requires product decision; not in scope here.
- Should the explanation be AI-generated instead of static? Can be added as a follow-on task replacing Task 3's content source.

## Summary

**3 tasks. 1 file. No backend changes.**

| Task | Scope | Key change |
|------|-------|------------|
| 1 | XS | Add `showExplanation` useState |
| 2 | S | Replace dead anchor with toggle button + `!showFeedback` guard |
| 3 | S | Render explanation panel with safe fallbacks |
