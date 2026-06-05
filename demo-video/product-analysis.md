# Zenith — Product Analysis

## Executive Summary

Zenith is a Vietnamese AI-native mathematics exam-preparation platform targeting Grade 9–12 students preparing for the THPT national graduation exam and competitive high-school entrance exams. The platform differentiates itself from generic quiz banks through three proprietary intelligence layers: province-calibrated AI analysis (understanding the question-distribution patterns of all 63 Vietnamese provinces), an Oracle math solver that renders step-by-step LaTeX solutions in real time, and a BKT-powered concept mastery graph that traces prerequisite gaps back to their root cause. At 29,000–59,000 VND per month (under USD $3), Zenith offers tutoring-quality coaching at textbook pricing.

---

## Target Audience

**Primary**
- Grade 12 students (16–18 years) in Vietnam's 63 provinces, 3–6 months before the THPT Quốc gia national graduation and university entrance exam
- Grade 9 students (14–15 years) preparing for the competitive THPT high-school entrance exam
- Students in major cities (Hà Nội, TP. HCM, Đà Nẵng, Hải Phòng) who need to outperform provincial averages to reach selective schools

**Secondary**
- Parents and tutors monitoring student exam readiness metrics
- Math-gifted students preparing for international exams (AMC, SAT, GCSE, IB) alongside the Vietnamese curriculum
- School administrators evaluating edtech for class-level deployment

---

## Core Problem Solved

Vietnamese students studying for high-stakes math exams have no affordable tool that understands the local examination system. Generic platforms give correct answers but not province-calibrated feedback, cannot identify which prerequisite concept caused a cascade of failures, and cannot predict whether a student's current score will get them into a specific Hà Nội or TP. HCM high school. Zenith closes all three gaps simultaneously.

---

## Feature Inventory

| Feature | Tier | Visual Impressiveness (1–5) | Demo Priority |
|---|---|---|---|
| 70+ real past exams (THPT, Grade 10, AMC, SAT, GCSE) | Basic | 3 | High |
| Timed exam interface with starfield background | Basic | 4 | High |
| Streaming AI post-exam analysis (word-by-word reveal) | Student | 5 | High |
| Province-aware school matching (63 provinces, sigmoid fit) | Student | 5 | High |
| Oracle AI Math Solver (LaTeX / voice / OCR) | Basic (5/day) | 5 | High |
| Score CountUp animation + confetti on high scores | Basic | 5 | High |
| AI-generated adaptive study plan | Student | 4 | High |
| Concept Mastery Graph — BKT node-link visualization | Student | 5 | Medium |
| Spaced repetition review queue (FSRS) | Student | 3 | Medium |
| Daily challenge + streak system 🔥 | Basic | 4 | Medium |
| Mastery rank progression (Pemula → Chuyên gia) | Basic | 4 | Medium |
| OCR exam upload (photo → questions → instant practice) | Student | 4 | Medium |
| AI-generated custom exam (topic + difficulty selection) | Complete | 4 | Medium |
| AchievementCeremony spring-physics animation on milestone | Basic | 5 | Medium |
| Adaptive practice (difficulty scales in real time) | Student | 3 | Low |
| Province pattern tips on results page | Student | 3 | Low |
| Score correlation (exam score → predicted THPT score) | Student | 4 | Low |
| Radar chart — topic breakdown | Basic | 3 | Low |
| Kalman-filter score prediction | Complete | 4 | Low |
| ClassDashboard (teacher view) | Complete | 3 | Low |
| Error Analysis page (pattern clustering) | Basic | 3 | Low |
| Placement / Diagnostic test | Basic | 3 | Low |
| Formula Drawer sidebar | Basic | 2 | Low |
| Streak freeze mechanic | Student | 2 | Low |
| Grade-change request workflow | All | 2 | Low |

---

## User Journey Map

| Step | Page | What Happens |
|---|---|---|
| 1. First visit | `/` Landing | Hero with staggered text animation; auto-cycling 4-feature showcase (Exam / Oracle / Analysis / Concept Map); pricing section; social proof |
| 2. Authentication | AuthModal | Google OAuth one-tap sign-in; Google token → backend `/auth/google` |
| 3. Profile onboarding | ProfileOnboarding modal | Student selects grade (9–12) + province (63 provinces) + school type; accepts ToS; blocks any credit-deducting request until complete |
| 4. Exam selection | `/exams` | Browse 40+ exams grouped by THPT / Grade 10; toggle Timed / Practice / Lab; filter by year/province; OCR upload option |
| 5. Exam preview | ExamSelect modal | Preview card: exam title, question count, duration; pre-exam briefing if history exists; Start button |
| 6. Taking the exam | `/test/:examId` | Full-screen timed interface; starfield background; question card with LaTeX; keyboard shortcuts; formula drawer; watermark overlay; anti-cheat (DevTools detection, tab-switch pause) |
| 7. Submit | TestInterface | Auto-submit on timeout or manual; score computed client-side by scoringEngine; AI analysis triggered in background |
| 8. Results + Score | `/results/current` | CountUp score animation; optional confetti burst (score ≥7); radar chart of topics; streaming AI analysis word-by-word; province-aware school match cards with sigmoid fit bars |
| 9. Study Plan | `/study-plan/:resultId` | AI-generated recovery path: focus areas with error patterns, 3-5 practice tasks, checkpoint mechanic ("Đúng N câu liên tiếp") |
| 10. Oracle | `/oracle` | LaTeX input (MathLive), voice, or OCR; step-by-step streaming solution with KaTeX rendering; Socratic hints |
| 11. Concept Map | `/concept-map` | ReactFlow DAG of 55+ concepts colored by mastery score; gap-trace tooltip shows root weakness |
| 12. Account / Progress | `/account`, `/progress` | Streak counter, mastery rank badge with spring animation, credit balance gauge, score trend charts, province narrative, pricing table |

---

## Product Strengths

1. **Province intelligence is genuinely unique** — 63 provinces each have calibrated topic weights, school cutoff data, and a sigmoid probability score that tells a student exactly how likely they are to get into a named school
2. **Streaming AI analysis creates a theatrical "thinking" moment** — word-by-word text appearance makes intelligence feel alive rather than static
3. **BKT + FSRS + Concept Mastery tri-layer** — BKT estimates knowledge from exam performance, FSRS schedules spaced reviews, Mastery tracks stage progression (stages 0–5)
4. **Oracle's input flexibility** — LaTeX via MathLive, voice via useVoiceInput, OCR via backend — rare at this price point
5. **AchievementCeremony spring physics** — uses `spring({ stiffness: 320, damping: 18 })`, a physically accurate spring, giving milestone moments a tactile feel
6. **Dark-mode-first design** with consistent amber/indigo accent system (#F2A20C / #818CF8) — matches student night-study habits
7. **Real data** — 1,500+ questions from official national exam boards, not AI-generated content
8. **Credit economy is transparent** — Basic tier gives enough credits to form a genuine opinion before upgrading

---

## Hidden / Advanced Features Worth Showcasing

- **Gap-trace tooltip** on Concept Map: clicking a weak concept reveals the prerequisite chain causing it
- **Score correlation table**: maps practice exam score → predicted real THPT scores for specific schools
- **Province pattern tips** on results: surfaced from `province_patterns.json`, tells students which topic types their province historically emphasizes
- **Learner archetype classifier**: silently categorizes users (e.g., "Scattered Learner", "Steady Improver") and personalizes AI analysis tone
- **Streak recovery path**: students who miss a day can regain streak via a targeted topic mastery task
- **ClassDashboard**: full teacher-facing view with class-level analytics (not highlighted in public demo)
- **Kalman-filter score prediction**: Bayesian score predictor with 90% confidence intervals (Complete tier)

---

## Recommended Demo Focus Areas (Ranked)

1. Score CountUp + confetti burst — instant emotional payoff, universal appeal
2. Streaming AI analysis text — shows AI capability visually, no explanation needed
3. Province-aware school matching with named schools — the most differentiated feature
4. Oracle step-by-step solution with KaTeX LaTeX rendering — demonstrates technical depth
5. Exam select catalog — establishes breadth of real past exams
6. Timed exam interface with starfield — sets mood and serious-tool context
7. AI Hint in practice mode — shows Socratic coaching without giving answers
8. Study Plan checkpoint mechanic — closes the learning loop convincingly
