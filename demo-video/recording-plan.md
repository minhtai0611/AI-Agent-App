# Zenith — Recording Plan

## Technical Specifications

| Parameter | Value |
|---|---|
| Browser | Chromium (no browser UI chrome visible) |
| Viewport | 1920 × 1080 |
| Recording resolution | 1920 × 1080 |
| Frame rate | 60 fps |
| Aspect ratio | 16:9 |
| Color space | sRGB |
| System font scaling | 100% — no DPI scaling |
| Dark mode | Yes — app is dark-mode by default (`bg: #0A0E1A`) |
| Mouse cursor | Visible; smooth movement ≤ 400px/s; minimum 800ms between click and next action |
| Scroll behavior | `behavior: 'smooth'`; 2.5–3s pause between scroll events |
| Audio | None captured — narration added in post-production |

---

## What Must NOT Appear in Any Frame

- Browser address bar or navigation controls
- Bookmarks bar, extension icons, or popups
- System notification toasts — disable OS notifications before recording
- Loading spinners > 1 second — pre-warm all API calls
- Credit balance counter prominently in early scenes (crop if needed)
- Any error state (AIErrorBoundary must not fire)
- Tab-switch warning overlay (stay in one window throughout)
- DevTools panel (will trigger anti-cheat overlay in TestInterface)

---

## Pre-Recording Checklist

1. Log in as the demo account (Grade 12, Hà Nội) and verify profile fields are set
2. Pre-complete the exam in a separate session so the results page is deep-linkable
3. Verify `province_patterns.json` has a "Hà Nội" entry (province tips appear in Results)
4. Clear `sessionStorage` — prevents "resume draft?" banner from appearing
5. Set OS idle timer to 30 minutes minimum
6. Disable OS notifications (Windows: Focus Assist / macOS: Do Not Disturb)
7. Set system font scaling to 100% — no High DPI scaling
8. Disable `prefers-reduced-motion` OS setting so all Framer Motion animations play
9. Run frontend dev server: `npm --prefix exam-app run dev`
10. Run backend with demo API token set in `.env`
11. Verify confetti fires at the results page with score 7.6 (open DevTools → verify canvas-confetti call)
12. Close DevTools before recording (TestInterface detects window size delta)
13. Use a custom CSS cursor overlay (64px) for visibility: `document.body.style.cursor = 'none'` + DOM overlay

---

## Scene-by-Scene Recording Notes

### Scene 1: Landing Hero (0:00–0:08)
- Open `http://localhost:5173/` — full viewport, no scroll
- Let hero stagger animation run naturally (350ms stagger between words)
- Feature carousel auto-cycles — show at least one full tab transition
- Mouse rests near center; no interaction
- Hold final state for 1s before transition

### Scene 2: Exam Select (0:08–0:17)
- Navigate to `/exams` — timed mode is default
- Let staggered exam cards animate in (`staggerChildren: 0.07` — about 1.5s for full list)
- Type "THPT 2024" in the search bar at human speed
- Hover over the first result card (scale spring visible)
- Click "Bắt đầu" → hold on preview modal 1.5s
- Click "Bắt đầu thi" — snap cut on button press

### Scene 3: TestInterface (0:17–0:29)
- Launch exam in timed mode (90-minute timer visible)
- Show Q1 with KaTeX-rendered LaTeX for 2s before answering
- Press keyboard shortcut B — show answer flash
- Press → to advance, show progress dot turn green
- Jump to practice mode for hint demonstration (separate browser tab is fine)
- On Q3 in practice mode: click "Gợi ý" — let streaming hint text build word by word
- Record hint popover for at least 1.5s

**Important:** Do NOT alt-tab during timed exam — triggers tab-switch pause overlay

### Scene 4: Results — Score + Confetti + AI + Schools (0:29–0:47)
- Deep-link to `/results/result_demo_2024_001`
- Let CountUp animate from 0.0 → 7.6 (1.8s duration — do not interrupt)
- Wait for confetti burst to begin before any scroll
- Let confetti settle 1s before scrolling
- Scroll to "Phân tích AI" — 2.5s smooth scroll
- Let streaming text build (AI analysis cache is pre-loaded — appears immediately but with animation)
- Scroll to RadarChart — hold 1.5s on fully rendered chart
- Click "Trường phù hợp" tab — hold on school cards for 2s
- **Zoom hint (post-production):** apply 1.0x → 1.06x → 1.0x zoom punch at the moment CountUp reaches 7.6

### Scene 5: Oracle AI (0:47–0:59)
- Navigate to `/oracle`
- Wait for wiki status dot to show green (mocked response: `{phase: "ready"}`)
- Click textarea — type calculus problem at ~60ms/char human pace
- Press Ctrl+Enter to submit
- Let "thinking" state animate for 1.5s before first step appears
- Step through solution using "Tiếp theo →" button if visible (reveals steps one at a time)
- Scroll to show final boxed answer
- Hold on complete solution for 1s

### Scene 6: Study Plan (0:59–1:09)
- Navigate to `/study-plan/result_demo_2024_001`
- Wait for "Kế hoạch phục hồi" heading to appear
- First FocusCard (Hình học) is auto-expanded — hold for 2s
- Scroll to show checkpoint bar — hold 2s to show the 2/3 fill animation
- Click second FocusCard (Tích phân) — let first collapse and second expand

### Scene 7: Account + Pricing (1:09–1:20)
- Navigate to `/account`
- Wait for credit gauge SVG arc animation (fills from 0 → 50)
- Verify mastery rank badge "Học sinh Tiến bộ" in indigo is visible
- Scroll to pricing section — hold 3s on pricing table
- Ensure all 3 tier columns are fully visible (do not crop)
- End on "PHỔ BIẾN" badge and gold CTA button visible

---

## Transition Plan

| Between Scenes | Transition | Duration |
|---|---|---|
| Scene 1 → 2 | Cross-dissolve | 400ms |
| Scene 2 → 3 | Snap cut (button press moment) | — |
| Scene 3 → 4 | Cross-dissolve | 300ms |
| Scene 4 → 5 | **Fade to black** | 500ms out · 500ms hold · 500ms in |
| Scene 5 → 6 | Cross-dissolve | 300ms |
| Scene 6 → 7 | Cross-dissolve | 300ms |
| Scene 7 → End card | **Fade to black** | 500ms |

---

## Recording Tool Recommendations

### Primary: Playwright Built-In Video Recording

```javascript
// playwright.config.demo.js
use: {
  video: { mode: 'on', size: { width: 1920, height: 1080 } },
  viewport: { width: 1920, height: 1080 },
}
```

Playwright gives deterministic mouse movement via `page.mouse.move(x, y, { steps: 20 })` and eliminates OS notification risk. Run:

```bash
npx playwright test demo-video/playwright-demo.spec.ts \
  --config demo-video/playwright.config.demo.js \
  --headed --project=chromium
```

Video output: `test-results/` (gitignored)

### Fallback: OBS Studio

- Scene: Browser Source (Chromium at 1920×1080)
- Encoder: x264 at CRF 18, or NVENC Quality 18
- Output format: MP4 (H.264)
- Audio: disabled at capture time (narration added in post)
- Virtual Camera: off

---

## Zoom and Cursor Recommendations

- **Zoom:** No browser zoom during recording. Apply post-production zoom in CapCut (scene-specific). The one mandatory zoom punch is during score CountUp in Scene 4.
- **Cursor:** Use a custom 64px white circle cursor overlay (Framer Motion `motion.div` fixed-position overlay synced to `mousemove` event). Alternatively, enable large cursor in OS accessibility settings before recording.
- **Cursor speed:** Playwright `mouse.move` with `steps: 20` at 60fps gives ~33ms/step — equivalent to ~400px/s human speed. Set `page.mouse.move` delay via helper `humanMove()` if using OBS.
