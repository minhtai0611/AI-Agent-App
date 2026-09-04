# Vantage Route-Parity Audit Blueprint

Generated 2026-09-04, following the Landing.jsx mockup-parity work (see
`[[project_landing_hero_mockup_parity]]` in Claude Code memory). Scope: the
7 non-hero mockups in `vantage/uploads/` versus their live `exam-app/src/pages/`
counterparts. `hero-redesign-3d.html` / `hero-redesign.html` are excluded —
Landing.jsx audit against those is already done.

This file is the **plan**, not the audit itself. No live-vs-mockup comparison
has been run yet for these 7 routes. Use it to scope and sequence that work
in a future session.

## Why this exists

`vantage/uploads/index.html` (title: "Vantage Prototypes — Nhà ga trung tâm")
is a prototype hub the mockup author built, and it says outright (line
128-130):

> "Mỗi trang là một prototype tự chứa (mở là chạy, kể cả offline), clone
> đúng shell & nền ambient của **hero-redesign-3d.html**."
> (Each page is a self-contained prototype that clones the exact shell and
> ambient background of hero-redesign-3d.html.)

Two consequences:

1. **These are ground-truth specs, not throwaway sketches.** Each one's
   number-preview panels/simulations run real logic (matrix math, probability
   sampling, CAS parsing) — not placeholder data. Treat mismatches as real
   findings, not "well it's just a mockup."
2. **All 7 pages share the same header/nav/footer/ambient-background shell**
   as the Landing page. Any shell-level bug already found and fixed on
   Landing (see "Known bug classes" below) should be checked on all 7 —
   they may share the same root cause if the live app also shares a layout
   shell component across routes, or may need the identical fix repeated if
   each page hand-rolls its own header/footer.

The hub also states a global checklist the mockup author held every page to
(line 169): **zero emoji · theme switch with no reload · reduced-motion
renders static-but-beautiful · every number uses tabular mono figures.**
Worth spot-checking on the live routes too.

## File → route mapping

Confirmed directly from the hub's own labels (`vantage/uploads/index.html`
lines 133-167), not guessed from filenames:

| # | Mockup file | Hub label | Live route | Live component | Mockup size |
|---|---|---|---|---|---|
| P·01 | `ket-qua.html` | "Biên bản mốc — kết quả thi" — **FLAGSHIP** | `/results/:resultId`, `/results/current` | `pages/Results.jsx` (833 lines) | 765 lines |
| P·02 | `chon-de.html` | "Trạm chọn đề" | `/exams` | `pages/ExamSelect.jsx` (503 lines) | 509 lines |
| P·03 | `lich-su.html` | "Sổ leo núi — nhật ký" | `/history` | `pages/History.jsx` (351 lines) | 541 lines |
| P·04 | `may-tinh-cas.html` | "Đồng hồ đo cao — CAS" | `/calculator` | `pages/CasCalculator.jsx` (448 lines) | 606 lines |
| P·05 | `dai-so-tuyen-tinh.html` | "Ma trận là địa hình" | `/linalg` | `pages/LinearAlgebraWorkspace.jsx` (438 lines) | 759 lines |
| P·06 | `xac-suat.html` | "Thung lũng hội tụ" | `/probability` | `pages/ProbabilitySimulator.jsx` (536 lines) | 666 lines |
| P·07 | `playground.html` | "Sổ phác trắc địa — playground" | `/playground` | `pages/MathPlayground.jsx` (770 lines) | 768 lines |

**Not covered by any file in `vantage/uploads/`** (out of this blueprint's
scope, noted for awareness only):
- `/test/:examId` (`TestInterface.jsx`) — no mockup in `uploads/`, but
  `vantage/lam-bai.html` plus `vantage/09-lam-bai-thi.md` and
  `vantage/10-modal-system-redesign.md` (all at the `vantage/` root, outside
  `uploads/`) look like an earlier planning pass for exactly this page. Worth
  a separate look, but the user's request explicitly scoped this blueprint to
  `uploads/`, so it's flagged and not detailed here.
- `/concept/:questionId` (`ConceptExplorer.jsx`) — no mockup found anywhere.
- `/`, `/org/*`, `/content-audit` — Landing already covered; org/admin
  routes have no mockup and are out of the Vantage rebrand's current scope
  per `[[project_strip_to_exam_core]]` / `[[project_vantage_rebrand]]`.

**Reference-only files (not routes, don't audit as a "page")**:
- `index.html` itself — the hub/index of prototypes. Useful as the source of
  the mapping table above and the per-page feature descriptions below; not
  a page that exists in the live app.
- `design-system.html` — titled "v1.0" of the design language. The
  Landing-page work already confirmed `hero-redesign-3d.html`'s *inline*
  tokens (colors, `--font-*` stacks) match `exam-app/src/index.css` exactly.
  Since `design-system.html` self-labels as v1.0 while the shipped shell is
  v1.4.1 (footer text on every other mockup), treat it as potentially stale
  — cross-check anything it claims against `hero-redesign-3d.html`'s actual
  `:root` block before trusting it, don't use it as the primary source.

## Method (reuse what worked on Landing)

1. Serve the mockup locally — `python -m http.server 8123` from
   `vantage/uploads/` — since claude-in-chrome rejects `file://` URLs.
2. Open the live route and the mockup side by side in claude-in-chrome.
3. **Don't trust screenshots alone for canvas/color effects** — this
   automation browser has a confirmed forced-dark-repaint display artifact.
   Sample real pixels via `canvas.getContext('2d').getImageData(...)` and
   compare against the mockup's own canvas for a like-for-like check. See
   `[[feedback_verify_canvas_via_pixels]]`.
3. **Don't trust code comments claiming "intentional deviation."** On
   Landing, several such comments turned out to be undocumented drift, not
   real decisions. Always read the mockup's actual `<style>`/`<script>`
   source before accepting a deviation as deliberate.
4. Compare with `getComputedStyle()` + `getBoundingClientRect()` on matched
   selectors (or by structural position) for font, size, spacing, color, and
   alignment — not eyeballing. Cross-check that every section's content
   shares the same left/right column as its siblings (this is exactly the
   bug class that hit Landing's header — see below).
5. Read each mockup's `<script>` block before assuming a feature is "just
   visual" — these run real logic (matrix ops, RREF, eigen, probability
   sampling, CAS parsing, expression-parser draw-on). A visual mismatch might
   actually be a logic mismatch (wrong computed value, not just wrong
   styling).

## Known bug classes (found on Landing, likely to recur)

Check for these specifically on each of the 7 pages — they're generic
mistakes, not Landing-specific:

- **Shared-column misalignment**: a header/section not wrapped in the same
  `mx-auto max-w-*` container as its siblings, so its content silently sits
  at a different x-offset than everything below/above it. This was the
  root cause of Landing's "wrong position of each element" bug — logo was
  175px off from the rest of the page.
- **`<br>` (or other block-breaking markup) nested inside an
  `inline-block`-styled wrapper** — breaks only within that element's own
  box instead of the actual line, silently mangling intended line breaks.
  Watch for this anywhere the live code stagger-animates words/characters
  (a common Framer Motion pattern in this codebase).
- **Literal-uppercase + wrong font-family on buttons/CTAs** where the mockup
  actually uses sentence-case text in the body font — don't assume "looks
  bold and shouty" was the intent without checking the mockup's actual CSS
  (`text-transform`, `font-family`, `font-weight`).
- **Hardcoded-token colors that break in dark mode** — e.g. a button using
  `var(--paper)` for text color when the mockup hardcodes a literal
  `#F5F2EA`; `--paper` flips to near-black in dark theme, silently breaking
  contrast only in that theme.
- **Missing dot-grid / gradient background patterns** on panel-style
  containers — verify `background-image`/`background-size` against the
  mockup's CSS, don't assume a plain `background-color` is equivalent.
- **Ambient background algorithm drift** — if any of these pages render
  their own instance of the ambient contour-field background (check each
  mockup's `<script>` for the same `HILLS`/`ISO`/polar-contour pattern seen
  in `hero-redesign-3d.html`), confirm the live shared `BgField.jsx` is
  actually reused rather than re-implemented with a different algorithm.

## Per-page granular checklist

Each entry lists the mockup's own described distinguishing features (from
the hub, in the mockup author's words) plus the interactive/computational
surface found in its `<script>` — both need checking, not just visual
layout.

### P·01 — `ket-qua.html` → `Results.jsx` (`/results/:resultId`) — **FLAGSHIP, audit first**
- Hub description: "Điểm là typography · mặt cắt địa hình của đề · nhật ký
  vấp theo sườn · có chế độ in" (the score itself rendered as large
  typography · an elevation-profile cross-section of the exam · a
  "stumbles along the slope" wrong-answer log · has a print mode).
- Sections found: `.xsec`, `.log`, `.topics`, `.next`.
- Script surface: `smoothPath`, `paint`/`draw` (elevation-profile canvas),
  `xf`/`yf` coordinate mapping, `jump` (navigate to a log entry), `css`
  (theme-aware color re-sampling), `readCol`/`readCols`.
- Live component already has 4 tabs per CLAUDE.md (Kết quả/radar chart,
  Nhận xét, Câu sai, Trường phù hợp) — these don't obviously map 1:1 onto
  the mockup's xsec/log/topics/next structure. Root-cause whether the live
  page's IA is a deliberate divergence or drift before "fixing" anything;
  this is the biggest-surface-area page here (833 vs 765 lines) so expect
  the most findings.
- Specifically check: does `/results/current` (or `:resultId`) have a print
  mode / print stylesheet at all? Does the live page render the exam's
  question-difficulty profile as an actual elevation/terrain-style chart,
  or a generic Recharts radar only?

### P·02 — `chon-de.html` → `ExamSelect.jsx` (`/exams`)
- Hub description: "4 tuyến rail màu · bảng mục lục kỹ thuật · dải độ dốc
  sparkline · thanh trượt mốc năm" (4 color-coded "rail" tracks · a
  technical table-of-contents-style list · a gradient/sparkline difficulty
  strip · a year-milestone slider).
- Script surface: `mulberry32` (seeded PRNG — check if live filtering/demo
  data uses a seeded RNG or `Math.random()`), `sparkSVG` (inline sparkline
  generation), `filterY` (year filter), `renderRows`, `observe`
  (IntersectionObserver, likely for scroll-reveal), `toggle`.
- CLAUDE.md describes the live page as having "year/search filters + preview
  modal (briefing checklist, weak-topic warning)" — check whether the
  mockup's "4 rail tracks" and "year-milestone slider" concepts exist on the
  live page at all, or whether the live filters are a plainer form-control
  implementation.

### P·03 — `lich-su.html` → `History.jsx` (`/history`)
- Hub description: "Mặt cắt độ cao với switchback 'leo lại cùng sườn' · 3
  trạng thái demo (trắng / 1 mốc / 7 mốc)" (an elevation cross-section with
  a "re-climbing the same slope" switchback motif · 3 demo states: empty /
  one milestone / seven milestones).
- Sections found: `#stEmpty`, `#stFirst` (`.first`), `#stElev` (`.elev on`),
  `#stJournal` (`.journal on`) — i.e. the mockup has explicit empty/first-run/
  established states, not just a single "list of attempts" view.
- Script surface: `setState` (drives which of the 3 demo states renders),
  `paint`/`draw`, `xf`/`yf`.
- Live page is described in CLAUDE.md as "Past attempts, localStorage-backed"
  — check specifically whether it has an empty-state design at all, since
  the mockup treats that as one of only 3 first-class states.

### P·04 — `may-tinh-cas.html` → `CasCalculator.jsx` (`/calculator`)
- Hub description: "Một ô nhập duy nhất · preview typeset sống · nhịp leo
  từng bước · nhật ký dụng cụ (localStorage)" (a single input field · a
  live typeset preview · a step-by-step "climb" rhythm · a
  localStorage-backed tool log).
- Script surface: `parsePoly`, `derive`, `integrate`, `polyStr`, `pretty`,
  `addStep`/`renderLog` (step-by-step log), `updatePreview`, `measure`,
  `fail`/`finish` (success/failure states).
- Live page uses mathlive input + mathjs (`casEngine.js`) per CLAUDE.md.
  Check specifically: does the live page keep a localStorage-backed history
  of past calculations like the mockup's "nhật ký dụng cụ"? Does it render
  steps in the same "climb rhythm" (numbered/staged reveal) as the mockup's
  `addStep`/`renderLog`, or dump the full solution at once?

### P·05 — `dai-so-tuyen-tinh.html` → `LinearAlgebraWorkspace.jsx` (`/linalg`)
- Hub description: "Lưới ô → mesh 3D sống (engine clone từ hero) · det/hạng/
  RREF/nghịch đảo thật · eigen 2×2 vẽ trục chính" (grid cells → a live 3D
  mesh, using an engine cloned from the hero page · real
  determinant/rank/RREF/inverse computation · 2×2 eigenvalue solving that
  draws the principal axes).
- Script surface: `matMul`, `detRank`, `rref`, `invert`, `eigen2`, `applyOp`,
  `heightsFor` (grid→terrain height mapping), `buildGrid`, `onCell`,
  `project`, `ensureLoop`/`loop` (render loop, shared naming pattern with
  `terrain3d.js`).
- **This is the one CLAUDE.md already flags as incomplete**: "manual spec
  only today (zero AI-router involvement); backend's `draft_linalg_spec`
  ... exists and is tested but has no frontend entry point on this page
  yet." The mockup's "engine clone từ hero" line means it should reuse
  `lib/terrain3d.js` for its 3D mesh — verify the live page's 3D rendering
  actually shares that engine (it's a `/linalg` page titled "ma trận là địa
  hình" = "matrix is terrain" in CLAUDE.md's own file map) rather than a
  separate implementation. Also verify eigen-mode is reachable in the live
  UI at all, since CLAUDE.md says "eigen only reachable via manual spec,
  never NL drafting" — confirm the manual path actually exists and draws
  principal axes like the mockup.

### P·06 — `xac-suat.html` → `ProbabilitySimulator.jsx` (`/probability`)
- Hub description: "Hạt cát rơi → cồn dâng · tuyến lý thuyết đỏ khi n≥100 ·
  phiếu đối chiếu μ/σ · 4 thí nghiệm" (falling sand grains → a rising dune
  visualization · the theoretical curve turns red once n≥100 · a μ/σ
  comparison readout card · 4 experiment types).
- Script surface: `gieo` ("roll/toss" — the simulation trigger), `binX`,
  `lvlY`, `fact`/`C`/`geom` (combinatorics/PMF math), `resetAll`,
  `updateTable`.
- CLAUDE.md: live page does "dice/coin simulation, empirical-vs-theoretical
  histogram" and backend intentionally abstains on "sampling." Check: does
  the mockup's "4 thí nghiệm" (4 experiment types) exceed what the live page
  offers (dice/coin only)? Does the live histogram visually mirror the
  mockup's "sand dune" build-up animation, or render instantly/statically?
  Does the live page implement the n≥100 threshold behavior where the
  theoretical line changes color/emphasis?

### P·07 — `playground.html` → `MathPlayground.jsx` (`/playground`)
- Hub description: "Parser biểu thức thật · nét bút draw-on · chốt giao
  điểm + tọa độ mono · pan/zoom · 4 mực màu" (a real expression parser ·
  hand-drawn "draw-on" stroke animation for curves · intersection markers
  with mono-font coordinates · pan/zoom · 4 ink colors).
- Script surface: a full hand-rolled expression parser
  (`parseExpr`/`parseTerm`/`parseUnary`/`parseFact`/`parsePrim`/
  `parsePrimCall`/`peek`), `compile`, `fitHome` (pan/zoom reset),
  `roundRect`, `scheduleRecompute`/`recompute`, `renderList`.
- CLAUDE.md: live page uses mathlive expression-list + Mafs canvas, with
  AI-router (`/agent/plot`) only for the "mô tả bằng lời" (describe in
  words) box. Check specifically: does the live page draw curves with an
  animated "draw-on" stroke like the mockup, or do they just appear? Are
  intersection/tangent points labeled with mono-font coordinates matching
  the mockup's style? Is pan/zoom implemented, and does color-cycling match
  "4 mực màu" (4 ink colors, presumably cycling per added curve)?

## Suggested audit order

1. **Results (`ket-qua.html`)** — explicitly the flagship, largest surface
   area, and the one most likely to have IA-level (not just style-level)
   drift given the tab structure doesn't obviously match the mockup's
   section names.
2. **LinearAlgebraWorkspace (`dai-so-tuyen-tinh.html`)** — CLAUDE.md already
   flags this page as incomplete (no NL-drafting entry point, eigen
   manual-only); the mockup gives concrete detail on what "done" looks like
   (shared terrain engine, eigen principal-axis drawing) that's worth
   confirming or scoping into a real task before auditing style details.
3. Remaining 5 pages in hub order (P·02, P·03, P·04, P·06, P·07) — no
   evidence yet of which is worse; audit in hub numbering for simplicity
   unless a quick look at one surfaces a reason to reprioritize.

For each page, follow the same fix → test → build → deploy loop used on
Landing (`npx vitest run`, then the Cloudflare Pages deploy commands in
`CLAUDE.md`'s "Deploy commands" section) once real findings are confirmed —
don't batch all 7 pages' fixes into one deploy; ship per-page so a bad find
on page 3 doesn't block shipping fixes already confirmed on pages 1-2.
