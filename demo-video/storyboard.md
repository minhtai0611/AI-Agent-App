# Zenith — Launch Video Storyboard

**Target runtime:** 84 seconds · 8 scenes + end card  
**Format:** 1920×1080 · 16:9 · 60fps  
**Persona:** Nguyễn Minh Tuấn — Grade 12 · Hà Nội · Student tier

---

## Scene 1 — Hero Arrival
**Duration:** 8 seconds  
**Goal:** Brand recognition + emotional hook. Establish dark, premium, Vietnamese-student-first aesthetic.

**Actions:**
- Browser opens the app. Page loads from blank — no browser chrome visible.
- Hero headline animates in word by word: "Học để hiểu," (gold #F2A20C) then "không học để quên." (white)
- Ambient glow orbs pulse slowly in the background (blue/gold radial gradients).
- Zenith logo mark (✦) is visible above the headline.
- Feature showcase carousel begins auto-cycling below the fold.

**Visual Focus:** Full-width hero headline, centered. No scrolling. Let the gold second line land and hold for 2 seconds.

**Transition:** Slow cross-dissolve (400ms) → Scene 2.

**Narration Hook:**
> "Every Vietnamese student has a target score. Zenith is the AI that shows you exactly how to reach it."

---

## Scene 2 — Exam Select: Choosing a Real Exam
**Duration:** 9 seconds  
**Goal:** Show depth of content (40+ exams) and ease of discovery; establish province-aware filtering.

**Actions:**
- Navigate to `/exams`. Timed mode is active (default).
- Two category sections visible: "Thi THPT Quốc gia" (gold accent) and "Thi vào lớp 10" (blue accent). Cards stagger-animate in.
- Type "THPT 2024" in the search bar — cards filter to 2 results.
- Hover over "Đề thi THPT Quốc gia 2024 — Môn Toán" card (scale: 1.015 spring hover).
- Click "Bắt đầu" — preview modal slides up showing: title, 50 questions, 90 minutes, timed badge.
- Hold on preview modal for 1.5s so viewer reads the details.
- Click "Bắt đầu thi" inside the modal.

**Visual Focus:** First, wide shot of staggered card grid (3s). Then zoom to preview modal showing duration badge and gold CTA button (3s). Then snap cut on button press.

**Transition:** Snap cut → Scene 3 as TestInterface mounts.

**Narration Hook:**
> "Choose from over seventy real past exams — filtered to your province and grade level. One click to start."

---

## Scene 3 — TestInterface: Inside the Exam
**Duration:** 12 seconds  
**Goal:** Demonstrate the immersive, distraction-free exam experience: timer, progress dots, LaTeX rendering, AI hint.

**Actions:**
1. TestInterface loads. Starfield canvas background visible. Gold accent bar across the top.
2. Nav bar shows: "Câu 1 / 50" left, exam title center (truncated), timer right (counting: 89:42...).
3. Progress bar (2px, gold gradient) fills 2% beneath the navbar.
4. QuestionCard displays a LaTeX-rendered calculus question (KaTeX rendering visible in real time).
5. Topic badge "Tích phân" (gold pill) and difficulty badge "Trung bình" (blue pill) are visible.
6. Press keyboard shortcut **B** — choice B highlights with an emerald flash (300ms transition).
7. Progress dot for question 1 turns green in the dot row at bottom.
8. Press **→** arrow key — advances to question 2. New question slides in.
9. Press **→** again to question 3 (the calculus/hint question). Pause 1s.
10. In practice mode scene (4b): click "Gợi ý" button — streaming hint text appears word-by-word in a popover below the answer choices.

**Visual Focus:** Steps 1–4: full question card (80% of viewport). Steps 8–10: zoom into streaming hint popover showing ~15 words appearing live (50% of viewport).

**Transition:** Cross-dissolve (300ms) → Scene 4.

**Narration Hook:**
> "Inside the exam: full-screen focus, a live countdown, and keyboard shortcuts for speed. Stuck? Request an AI hint that guides your thinking — without giving away the answer."

---

## Scene 4 — Submit + Results: Score, Confetti, AI Analysis
**Duration:** 18 seconds  
**Goal:** The emotional peak. Show the full results flow: score CountUp → confetti burst → streaming AI insights → radar chart → school recommendation cards.

**Actions:**
1. Results page loads at `/results/result_demo_2024_001`. Score SVG ring animates from 0° to completion.
2. CountUp number ticks from 0.0 to **7.6** over 1.8s (gold #F2A20C, 40px).
3. "Khá giỏi" label fades in beside the score with time taken and answered count stats.
4. At ring completion: **confetti burst** fires (150 particles — green, blue, amber, purple, ~3s fade).
5. Scroll down slowly to "Phân tích AI" section. Streaming text appears word-by-word:
   - "Điểm mạnh rõ rệt ở Đại số (89%) và Hàm số (88%)."
   - "Cần tập trung cải thiện Hình học (60%) và Tích phân (57%)."
6. Scroll to "Hồ sơ năng lực" — **RadarChart** materializes: 7 topic axes, red for Hình học, emerald for Đại số.
7. Click "Trường phù hợp" tab — **school cards** fade in one by one:
   - "Đại học Bách Khoa Hà Nội" — score range 7.0–8.5
   - "Đại học Kinh tế Quốc dân" — score range 6.5–8.0
   - Animated fit bars slide left-to-right.

**Visual Focus:** Steps 1–4: centered score ring, then confetti fills frame. Steps 5–6: split view of AI text streaming below score. Step 7: school cards spanning full width.

**Transition:** Fade to black (500ms out · 500ms hold · 500ms in) → Scene 5. This breath signals the gear-shift from analysis to active problem-solving.

**Narration Hook:**
> "Submit — and your score appears instantly. If you did well, confetti. Then the AI streams your personal analysis: your strongest topics, your weakest, and — most importantly — the schools in Hà Nội you're on track to enter."

---

## Scene 5 — Oracle AI: Step-by-Step Math Solver
**Duration:** 12 seconds  
**Goal:** Show the premium power feature — real LaTeX math solved live, step by step.

**Actions:**
1. Navigate to `/oracle`. Page loads: dark background, Oracle bubble in idle state (slow gold/violet glow pulse), wiki status dot glows green.
2. Click the textarea. Type (human-paced): "Tính tích phân ∫₀² (3x² - 2x + 1) dx"
3. Symbol palette visible in toolbar below the input.
4. Press **Ctrl+Enter** to submit. Oracle bubble transitions to "thinking" state (faster pulse).
5. Solution streams in step by step (KaTeX renders mid-stream):
   - "**Bước 1:** Xác định dạng bài: tích phân xác định tuyến tính..."
   - "**Bước 2:** Tìm nguyên hàm: $F(x) = x^3 - x^2 + x + C$"
   - "**Bước 3:** Áp dụng Newton-Leibniz: $F(2) - F(0) = 6$"
   - "**Kết luận:** $\displaystyle\int_0^2 (3x^2 - 2x + 1)\,dx = \boxed{6}$"
6. Oracle bubble transitions to "celebrating" state (0.7s spring scale pop).

**Visual Focus:** The streaming solution text with KaTeX formulas visually rendering mid-stream. Crop to 70% viewport width centered on the Oracle panel. The pulsing Oracle bubble glow is visible in the corner.

**Transition:** Smooth cut → Scene 6.

**Narration Hook:**
> "Oracle AI solves any math problem step by step — not just the answer, but the reasoning. Each step renders in real time, so you understand the why, not just the what."

---

## Scene 6 — Study Plan: Recovery Path with Checkpoint
**Duration:** 10 seconds  
**Goal:** Close the learning loop — show that Zenith doesn't abandon you after a result.

**Actions:**
1. Navigate to `/study-plan/result_demo_2024_001`. Page loads showing recovery plan.
2. "Mục tiêu" section with score gap: "Cần cải thiện 0.4 điểm để vào Đại học Khoa học Tự nhiên."
3. First FocusCard auto-expanded (index 0): topic "Hình học không gian."
4. Error pattern alert (yellow): "Sai ở tính thể tích của khối chóp và khối trụ."
5. Three practice tasks listed (bulleted).
6. **Checkpoint bar** visible: "Đúng 3 câu liên tiếp" — 2/3 progress shown, gold-to-emerald gradient fill, animating.
7. Click second FocusCard to expand: "Tích phân" — collapses first, second expands with tasks.

**Visual Focus:** The CheckpointBar fill animation is the hero visual. Hold 2s on the bar so the mechanic is legible. The progress fill (0 → 2/3) should be visible for at least 1.5s.

**Transition:** Cross-dissolve → Scene 7.

**Narration Hook:**
> "After every exam, Zenith builds a focused recovery path. Each topic has concrete tasks — and a checkpoint: answer three correct in a row to clear it and move on."

---

## Scene 7 — Account: Mastery Rank + Pricing
**Duration:** 11 seconds  
**Goal:** Commercial close — show progress gamification (rank badge, credit gauge) and the 3-tier pricing structure.

**Actions:**
1. Navigate to `/account`. Profile visible: "Nguyễn Minh Tuấn", Grade 12 badge, Province "Hà Nội."
2. **SVG credit gauge** animates (arc fill, gold color): 50 credits shown on the gauge.
3. **Mastery rank badge**: "Học sinh Tiến bộ" in indigo (#818CF8) — spring pop animation (0.7s, stiffness 320).
4. Scroll down to pricing table: 3 tier cards animate in:
   - "Cơ bản — Miễn phí" (gray border)
   - "Học sinh — 29,000đ/tháng" with **"PHỔ BIẾN"** badge in gold (highlighted card, raised shadow)
   - "Toàn diện — 59,000đ/tháng" (indigo border)
5. Hold 3s on pricing table — wide enough to show all 3 cards clearly.
6. "Bắt đầu miễn phí" CTA button on "Cơ bản" card is visible in gold.

**Visual Focus:** First 4s on profile + rank badge. Last 4s on pricing table ensuring "PHỔ BIẾN" badge is readable and all 3 tier columns are fully visible.

**Transition:** Fade to black (500ms) → End card.

**Narration Hook:**
> "Watch your mastery rank rise with every session. Start free — upgrade when you're ready for unlimited AI, personalized study plans, and score prediction."

---

## End Card
**Duration:** 4 seconds (not counted in main scene total)

**Content:**
- Background: `#0A0E1A` deep dark with a single slow amber glow pulse
- Center: Zenith logo mark ✦ in `#F2A20C` at 48px
- Headline: "Luyện thi thông minh hơn." (Fraunces Italic, 28px, white)
- Subline: "AI phân tích · 63 tỉnh thành · Từ 29,000đ / tháng" (Jakarta Sans, 14px, `#94A3B8`)
- URL: "zenith.vn" centered at bottom

---

## Scene Duration Summary

| # | Scene | Duration |
|---|-------|----------|
| 1 | Hero Arrival | 8s |
| 2 | Exam Select → Preview → Start | 9s |
| 3 | TestInterface — Exam + Hint | 12s |
| 4 | Results — Score + Confetti + AI Analysis + Schools | 18s |
| 5 | Oracle AI — Streaming Solution | 12s |
| 6 | Study Plan — Recovery Path + Checkpoint | 10s |
| 7 | Account — Mastery Rank + Pricing | 11s |
| — | End Card | 4s |
| **Total** | | **84s** |
