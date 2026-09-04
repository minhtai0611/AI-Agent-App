# Vantage Route-Parity Audit — Findings

Executed 2026-09-04 per `ROUTE_AUDIT_BLUEPRINT.md`. Method: mockup served at
`localhost:8123` (`vantage/uploads/`), live app at `localhost:5173` (dev
servers started for this audit), side-by-side screenshots + structural
inspection via claude-in-chrome. A synthetic exam result was seeded into
`localStorage.exam_history` to reach `/results/:id` and `/history` with real
data (7.5/10, 9/12 correct, 3 wrong) since neither page is reachable with
empty state via direct URL otherwise.

This is a findings report, not a fix. Per the blueprint, fixes should ship
per-page, not batched. Severity ranked by how far live drifts from the
mockup's actual described feature set.

## P·01 — Results (`/results/:resultId`) — **CRITICAL drift, biggest gap found**

The live page is structurally a different IA than the mockup, not a styling
mismatch:

- **No shell reuse at all.** The live page renders a generic secondary
  header bar ("← Trang chủ" / "Kết quả thi" / "Lịch sử" button) instead of
  the shared ambient-background shell (Navbar + BgField canvas) every other
  route and the mockup use. No `TRẠM · BIÊN BẢN MỐC` breadcrumb, no ambient
  contour background visible on this route.
- **Score is a small Recharts-style circular gauge** ("7.5" in a thin ring),
  not the mockup's huge typographic treatment (`7,75` rendered at ~72px as
  the page's dominant element, per hub description "Điểm là typography").
- **No elevation-profile canvas.** Mockup's centerpiece is `Mặt cắt địa hình
  của đề` — a canvas line+area chart plotting per-question difficulty as a
  climbing profile (`paint`/`xf`/`yf` in its script), with milestone/prior-
  attempt delta readouts (`SO LẦN TRƯỚC ▲ +0,50`). Live page instead shows a
  Recharts `RadarChart` "Hồ sơ năng lực" — a genuinely different chart type
  answering a different question (topic mastery, not question-by-question
  difficulty terrain).
- **IA doesn't map onto mockup's sections.** Live uses 4 shadcn tabs (Kết
  quả / Nhận xét / Câu sai / Trường phù hợp) vs. the mockup's flat sections
  (`.xsec`, `.log`, `.topics`, `.next`). This isn't necessarily wrong on its
  own, but none of live's tabs reproduce the mockup's wrong-answer "stumble
  log" tied to the elevation profile (`jump` — click a slope point to jump
  to that question's log entry).
- **No print mode found** in the time available — worth a dedicated check
  (`window.print` / print stylesheet) before concluding either way.

This page needs a scoping decision, not a quick style patch: is the radar
chart / 4-tab IA a deliberate, already-approved redesign, or undocumented
drift from a spec the mockup encodes in real detail? Recommend resolving
that question with the user before touching code here — this is the
"biggest-surface-area page" the blueprint already predicted would need it.

## P·03 — History (`/history`) — **HIGH drift**

- **The mockup's core visualization is entirely absent.** Mockup's
  centerpiece is `Mặt cắt độ cao · hành trình`, a canvas chart plotting all
  attempts as connected elevation points, with a dashed-vs-solid line
  convention specifically to show "leo lại cùng sườn" (re-climbing the same
  exam) as a distinct visual thread. Live page has **no chart at all** —
  just a large numeral (`7.50`) and a flat monthly list.
- **No first-run/empty-state design.** Mockup explicitly treats 3 states
  (empty / first milestone / established journal, `#stEmpty`/`#stFirst`/
  `#stJournal`, toggled via `setState`) as first-class. Live page was only
  observed with 1 seeded result; there's no evidence in `History.jsx` (per
  earlier file read) of a distinct empty-state layout vs. just an empty
  list — worth confirming directly against the component, but the seeded
  single-entry state already looks like a stripped-down version of the
  mockup's "first milestone" state, missing its center "leo tiếp để về sườn"
  CTA styling and the switchback framing entirely.
- Live's per-entry list styling (plain rows) also drops the mockup's Δ vs.
  prior-attempt indicator (`▲ +0,75`) shown inline per entry.

## P·05 — Linear Algebra Workspace (`/linalg`) — **HIGH, confirms CLAUDE.md's flag**

- **No 3D terrain mesh rendering observed on page load or after entering a
  matrix.** Mockup's right-hand panel is a live 3D mesh ("ENGINE 3D: CLONE
  TỪ HERO · TOÁN THẬT" — explicitly a `terrain3d.js`-shared engine) that
  reacts to the matrix grid. Live page's equivalent panel is a static dark
  box with instructional placeholder text ("Nhấn Xử Địa Hình để xem số
  liệu") and never rendered a mesh in this session — this needs a follow-up
  check with an actual matrix operation triggered (not just page load) to
  confirm whether it's fully missing or just not idle-rendered, but nothing
  in the initial view resembles a 3D scene at all, static or animated.
- **Eigen is present but demoted**: a "Hiển thị nâng cao (eigen, SVD)"
  checkbox exists — consistent with CLAUDE.md's note that eigen is
  reachable only via a manual, gated path — but the mockup treats "Eigen
  (2×2)" as a first-class operation in the main left-rail list alongside
  Cộng/Nhân/Định thức, not hidden behind an "advanced" toggle.
- Live's op list is otherwise a *superset* of the mockup's (adds LU/QR/
  Cholesky decomposition) — that's a feature the mockup doesn't even
  describe, not a regression.
- Confirms CLAUDE.md's own note verbatim: "manual spec only today," and the
  mockup's "engine clone từ hero" line is not currently true of the live
  page.

## P·06 — Probability Simulator (`/probability`) — **MEDIUM**

- **Only 2 of the mockup's 4 experiment types are present.** Live shows
  tabs for "Xúc xắc (tổng)" / "Đồng xu" only; mockup's hub description and
  visible tab strip list 4: `Đồng xu ×10 / Xúc xắc / Tổng 2 xúc xắc / Tùy
  chỉnh p` — i.e. a fixed-N coin-flip mode and a custom-probability mode
  that live doesn't expose at all. (CLAUDE.md already flags "sampling" as
  intentionally abstained on the backend — this may be the same scope cut,
  worth confirming it's deliberate rather than confusing "custom p" with
  the backend's unimplemented "sampling" op; they read as different
  features.)
- **No axes/gridlines before the first roll.** Mockup pre-renders the chart
  frame (axis labels 0/2/4, x-axis 0–10, "n = 0") even at rest. Live page's
  chart area is fully blank except centered placeholder text until the
  first "Gieo" — a materially different (and less polished) empty state.
- Layout, copy, and button row (Gieo ×1/×100/×1000, "Dọn thung lũng",
  "Tuyến lý thuyết" checkbox) otherwise match closely — this page is
  structurally close, the gap is scope (missing modes) and empty-state
  polish, not a redesign.

## P·07 — Math Playground (`/playground`) — **MEDIUM**

- **Right-hand curve-list panel doesn't reflect the graph state.** On load,
  the live graph already shows 2 plotted curves, but the curve-list panel
  shows a single unfilled entry-mode UI (a `y = f(x)` type dropdown + "+ Vẽ
  nét này" button) rather than the mockup's list of already-added curves
  each with a color bullet, expression, domain, and show/remove controls.
  This looks like a state-sync bug worth a direct look at
  `MathPlayground.jsx`, not just a style gap — the canvas and the sidebar
  disagree about what's plotted.
- **No intersection/tangent coordinate labels observed**, though this may
  simply be because no two curves were near an intersection at default
  zoom — the mockup's markers only appear at actual crossings, so this
  needs a same-curve-set comparison to confirm, not a page-load screenshot.
- Grid/axis styling, layout, and header/breadcrumb match the mockup well.

## P·02 — Exam Select (`/exams`) — **LOW, close match**

Live already implements the mockup's headline features: 4 color-coded rail
tracks, a year-milestone slider ("Lọc theo mốc năm"), and a matching
breadcrumb ("TRẠM · BẢN ĐỒ TUYẾN"). Nav item set differs (live has app-wide
Thi thử/Lịch sử/Công cụ; mockup hub nav is generic Công cụ/Lộ trình/Hỏi đáp)
but that's expected — the mockup hub's nav is shared shell chrome, not a
per-page spec. No deeper issues surfaced in this pass; a closer diff of the
sparkline/table-of-contents details listed in the blueprint wasn't done
before time ran out — lowest priority for follow-up.

## P·04 — CAS Calculator (`/calculator`) — **LOW, close match, exceeds spec in places**

Live matches the mockup's breadcrumb, title, and subtitle almost verbatim,
and **already implements the localStorage tool log** the blueprint asked to
verify ("Nhật ký dụng cụ" shows prior expressions with their derivative,
e.g. `x**3 + 2*x → 3*x**2 + 2`). Live's tab list is a superset of the
mockup's (adds "Đo nhanh", "Nguyên hàm", "Taylor", "ODE" beyond the
mockup's 6 tabs) — an enhancement, not a gap. No issues found in this pass.

## Suggested next step

Fix in the blueprint's priority order: **Results → LinearAlgebra → History
→ Probability/Playground → (ExamSelect/Calculator low priority)**. Results
and LinearAlgebra both raise a scoping question (is the current IA a
deliberate departure?) that's worth resolving with the user before writing
any code, per the earlier Results section — recommend starting there rather
than jumping straight to fixes.
