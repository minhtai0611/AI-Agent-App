# Zenith — Demo Quality Review

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI streaming fails during recording (network timeout, cold start) | High | High | Pre-warm API 60s before recording; use localStorage cache for analysis (always available); mock `/analyze/stream` with Playwright route if recording via automation |
| Confetti does not fire (score threshold not met, or canvas-confetti blocked in headless Chromium) | Medium | High | Verify score is exactly 7.6 (≥7.0 threshold); always run in headed Chromium, not headless; test confetti fires before recording session |
| ReactFlow Concept Map renders empty (API returns empty mastery) | Medium | Medium | Scene 7 is Study Plan (not Concept Map) — this risk is avoided by design; Study Plan reads from localStorage cache which is always seeded |
| KaTeX renders raw LaTeX strings instead of math (normalizeMath edge case) | Low-Medium | High | Test the exact Oracle problem string (`∫₀² (3x² - 2x + 1) dx`) in Oracle before recording; confirm KaTeX renders `\boxed{6}` correctly |
| Province-aware school cards empty (Hà Nội not in schools.json or score_correlation.json) | Low | High | Verify `schools.json` has Hà Nội entries with math cutoffs matching score 7.6; AI analysis mock response provides school data anyway as backup |
| Streaming text animation too fast/slow for recording frame rate | Medium | Medium | Record at 60fps; confirm `word-fade` CSS animation respects the frame rate; disable `prefers-reduced-motion` OS setting |
| TestInterface tab-switch warning overlay fires during recording | Medium | Medium | Record in a single browser window; never alt-tab during Scene 3; Playwright spec stays in one page context |
| Question IDs `q_thpt24_*` don't exist in questions.json (renamed or reshuffled) | Low | High | `beforeAll` validation block in Playwright spec checks 5 representative IDs; fails fast with clear error message if any ID is missing |
| `extended_onboarding_done: false` causes ExtendedOnboarding modal to block UI | Low | High | Demo user has `extended_onboarding_done: true` explicitly set; `GET /users/me` mock returns this field |
| Video exceeds 90s due to unexpected loading states | Medium | Medium | All AI responses are mocked or cached; study plan is pre-loaded in localStorage; if any scene runs long, Scene 3 and Scene 7 are the cut candidates (see §Cut Priority below) |
| Non-Vietnamese viewer cannot read Vietnamese UI text | High | Medium | English narration provides all context; critical school name "Đại học Bách Khoa Hà Nội" can have a 2s English caption overlay in post: "Top Engineering University in Hanoi" |
| Credit system Tia display visible early (signals friction) | Medium | Low | Navbar credits badge is on `/exams` and after — start from landing page before auth and navigate quickly past ExamSelect |

---

## Weak Scenes

### Scene 3 (TestInterface) — Weakest Scene

A viewer who has never used Zenith gains little from watching someone press keyboard shortcuts. The starfield background is visually engaging but the question content (Vietnamese multiple-choice) is illegible at typical video playback scale. The hint demonstration requires switching to practice mode, which creates a jarring mode-switch mid-scene.

**Mitigation options:**
1. Reduce Scene 3 from 12s to 6s — show only the question card + timer for 3s, then the streaming hint for 3s
2. Eliminate the timed mode portion entirely — start directly in practice mode (simpler, fewer mode-switches)
3. Keep as-is but add an English caption: "1,500+ real exam questions · KaTeX math rendering"

**Recommendation:** Option 1 (6s trimmed version) if video runs over 90s.

### Scene 2 (Exam Select) — Moderate Weakness

The value proposition ("40+ exams from 63 provinces") appears as metadata text at small font size. At playback speed, viewers see a list of Vietnamese titles they cannot read. The stagger animation is elegant but doesn't communicate breadth effectively in 9 seconds.

**Mitigation:** The text overlay enhancement ("40+ đề thi thật · 63 tỉnh thành") in `ai-enhancement.md` addresses this directly — make sure that overlay is added in post.

### Scene 7 (Account + Pricing) — Risk of Anti-Climax

After the peak of Scene 6 (Oracle streaming solution), the Account page with tier pricing can feel like an appendix. The mastery rank badge is visually satisfying but the pricing table is static and text-heavy.

**Mitigation:** Lead with the mastery rank animation (the spring-physics pop is the strongest visual here) and only show pricing for the last 4s. Do not scroll through individual plan features — keep the 3-column overview visible the whole time.

---

## Repetitive Interactions to Avoid

- **Scrolling appears in both Scene 4 and Scene 6** — in Scene 4 (Results), scroll to AI analysis + school cards; in Scene 6 (Study Plan), scroll to checkpoint. To avoid looking repetitive: enter Scene 6 already scrolled to the checkpoint bar (no visible scroll in that scene).
- **Text appears word-by-word in Scene 4 (AI analysis) and Scene 5 (Oracle streaming)** — intentional repetition that reinforces the "AI thinking" concept, but avoid scenes back-to-back without the fade-to-black separator (already planned between 4→5).
- **Two preview modal interactions** would appear if Scene 2 shows the exam preview modal AND a later scene shows another modal — currently only one modal is shown (Scene 2), so no issue.

---

## Confusing Flows for Non-Vietnamese Viewers

- **Province selection context:** The school matching section in Scene 4 names "Đại học Bách Khoa Hà Nội" — international viewers will not understand the significance. Add a 2s English caption overlay: "Top Engineering University in Hanoi — selective, score-matched"
- **Credit system ("Tia"):** If the credit balance or "Không đủ Tia" warning appears, it is entirely opaque. Hide or crop the credit counter in Scenes 1–6; show it only in Scene 7 (Account) where context is provided by the pricing table.
- **Difficulty labels ("Dễ / Vừa / Khó"):** Color-coded (green/amber/red) so partially self-evident. No action needed if color coding is clearly visible at 1080p.
- **Exam naming conventions:** "THPT Quốc gia" is an unfamiliar term. The overlay enhancement "40+ đề thi thật" (real past exams) and the narration "seventy real past exams" provide sufficient context without naming the acronym.
- **Mastery rank names:** "Học sinh Tiến bộ" in Scene 7 is opaque. The color (indigo) and the rank badge design signal "achievement level" — no action needed unless the badge is a primary focus.

---

## Alternative Scene Orderings

### Alternative A: "Oracle First" — Lead with the Solver

**Order:** Landing → Oracle → Exam Select → Timed Exam → Score Reveal + AI → Study Plan → Account + CTA

**Pros:**
- Oracle is universally legible — solving a math problem step-by-step requires no cultural context
- Opens with the deepest technical demonstration, immediately differentiating Zenith from quiz apps
- Strong hook for international / investor audiences where AI capability is the primary interest

**Cons:**
- Breaks the natural student session loop (you would not go to Oracle before taking an exam)
- The viewer has not yet invested emotionally in a score, so the AI Analysis and Study Plan lack narrative payoff
- Moves the confetti reveal to Scene 4 (instead of 3), losing the "peak moment at midpoint" pacing advantage
- Adds a 500ms+ fade between Oracle and Exam Select (different interaction modes)

**Best for:** International investor pitch, conference stage demo

### Alternative B: "Province-First" — Lead with the Differentiator

**Order:** Landing → Profile Onboarding (province selection visible) → Exam Select → Timed Exam → Score Reveal → School Cards ONLY → Oracle → Account + CTA (drop Study Plan scene)

**Pros:**
- Province selection in Scene 2 sets up the "Hà Nội student" frame explicitly, making school cards in Scene 5 the payoff of a setup rather than a surprise
- Tighter — dropping Study Plan keeps the video under 75s comfortably
- Province-first is the clearest competitive differentiator message for Vietnamese-primary audience

**Cons:**
- Showing profile onboarding (province dropdown UI) risks a weak second scene — standard select list is not visually impressive
- Removes Study Plan, which is important for demonstrating the product's coaching completeness
- If onboarding modal has any UI issues (text overflow, province dropdown lag), it is front-and-center

**Best for:** Vietnamese student/parent primary audience demo

---

## Cut Priority (if video exceeds 90s)

Cut in this order:

1. **Scene 3 (TestInterface) — reduce from 12s to 6s:** Show only the question card for 2s and streaming hint for 4s. Skip the Q1→Q3 keyboard navigation.
2. **Scene 7 (Account) — reduce from 11s to 6s:** Enter already scrolled to pricing table. Skip mastery badge animation (let the narration cover it). Show pricing 3 columns for 4s, hold CTA for 2s.
3. **Scene 2 (Exam Select) — reduce from 9s to 5s:** Skip the preview modal. Show staggered card grid for 3s, then snap cut on clicking "Bắt đầu thi."
4. **End card — reduce from 4s to 3s.**

After all four cuts, estimated runtime: 8 + 5 + 6 + 18 + 12 + 10 + 6 + 3 = **68 seconds.** Well under target.

---

## Overall Confidence Score: 7.5 / 10

**What earns a high score:**
- The product has genuinely exceptional visual moments: streaming AI analysis, confetti + CountUp animation, school cards with province-matched names, Oracle KaTeX rendering, checkpoint bar mechanics
- The dark-mode design is polished and consistent — no visual "embarrassments"
- The emotional arc (tension → relief → awe → clarity → motivation) is structurally sound
- The Playwright automation isolates the demo from the existing test suite (different `testDir` config)
- The demo data is fully pre-seeded — no live API risk for the 3 most critical scenes (Results, Study Plan, AI Analysis)

**What limits the score to 7.5:**
- Scene 3 (TestInterface) is the weakest visual moment and requires a mode-switch to show hints
- The Vietnamese-only UI creates comprehension gaps for non-Vietnamese viewers that require post-production caption work
- Province-aware school matching — the single most differentiated feature — depends on Hà Nội being correctly populated in `schools.json` and `province_patterns.json`; this must be verified before any recording session
- The credit/Tia system appearing in the Navbar is a minor but persistent risk of showing "friction" before value is established

**Path to 9/10:** Add English caption overlays for school names (Scene 4), verify all province data files, and reduce Scene 3 to 6s. With those three changes, the demo would be exceptional.
