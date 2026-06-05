# Zenith — Demo Strategy

## Recommended Target Audience for the Demo Video

Vietnamese Grade 12 students (and their parents) who are 3–6 months from the THPT Quốc gia exam and currently using either nothing, a static PDF question bank, or an expensive private tutor. They understand that practice tests exist but have never seen one combined with AI feedback that speaks about *their province* and *their target schools*.

**Secondary audience:** Vietnamese edtech investors and school administrators who need to understand the product's technical differentiation at a glance, and international edtech observers interested in how AI is being applied to high-stakes exam prep in Southeast Asia.

---

## Demo Objective

Show — in under 90 seconds — that Zenith transforms a completed exam from a single score into a personalized, province-specific action plan, replacing the need for a private tutor.

---

## Key Takeaways

After watching the demo, viewers should walk away knowing:

1. **Real exams + AI feedback together, not separately** — this is not just a question bank; the intelligence layer is built around the student's actual performance
2. **The AI knows your province** — it names the actual schools you can get into based on your score and your location
3. **You leave every session knowing exactly which concept to study next** — not just which questions you got wrong, but why and what to do about it

---

## Demo Flow Rationale

The 8-scene arc follows the natural student session loop (select → take → understand → act), which means a viewer who is a student will mentally "try on" each moment as their own experience rather than watching a feature tour.

**Scene 1 (Landing):** Establishes credibility fast — real exam names, province count — before any claim of AI intelligence. Skeptical viewers need to see the data foundation first.

**Scene 2 (Auth — pre-seeded):** Authentication is table stakes; we skip the Google OAuth screen entirely. The profile snapshot (Grade 12, Hà Nội) is shown briefly to establish the persona and activate the province-awareness frame.

**Scene 3 (Exam Select → Preview):** The catalog depth (40+ exam cards staggering in) implies scale without requiring the viewer to count. The preview modal establishes that this is a real, structured exam — not a quiz.

**Scene 4 (Timed Exam + Hint):** Brief but necessary to establish that this is a *serious* test environment. The keyboard shortcuts signal power-user ergonomics. The hint scene (in practice mode) shows Socratic coaching — guiding thinking without giving the answer.

**Scene 5 (Score + Confetti + AI Analysis + School Cards):** The emotional peak of Act 1. The CountUp animation + confetti converts exam-result anxiety into joy. The streaming AI insights signal real intelligence. The province-named school cards are the "wow" moment that no competitor replicates.

**Scene 6 (Oracle):** Demonstrates the deepest capability for the highest-anxiety use case: encountering an unfamiliar problem type the night before an exam. LaTeX streaming signals technical rigor.

**Scene 7 (Study Plan):** Closes the loop. The checkpoint mechanic ("Đúng 3 câu liên tiếp") shows that Zenith defines completion concretely — not vaguely encouraging "study more."

**Scene 8 (Account + Pricing):** The commercial close. Mastery rank shows progress is measurable. Pricing establishes affordability. "Bắt đầu miễn phí" (Start free) is the CTA.

**Fade-to-black between Scene 5→6:** Signals a gear-shift from passive analysis to active problem-solving. Scenes 5 and 6 have distinct interaction modes that would feel jarring without a visual breath.

---

## Anti-Patterns to Avoid

- **Do not show the Google OAuth consent screen** — authentication is table stakes and wastes 8–12 seconds
- **Do not show pricing prominently mid-video** — it breaks the aspirational tone; pricing belongs only in the closing scene
- **Do not show the credit balance counter** early — it signals friction before the viewer has seen value
- **Do not linger on any loading spinner > 1 second** — pre-warm all API calls before recording
- **Do not show Formula Drawer, Admin panel, ClassDashboard, or Error Analysis** — power-user features that confuse a general audience
- **Do not demo voice input** — microphone permissions and processing delays are unpredictable in recordings
- **Avoid rapid mouse movement** — cursor should glide at ≤400px/s; jarring movement breaks the premium feel
- **Do not scroll more than once per scene** — repeated scroll animations feel like a UI tour, not a product experience

---

## Emotional Arc

| Phase | Scenes | Intended Viewer Feeling |
|---|---|---|
| Recognition | 1–2 (Landing, Auth) | "This looks real. These are actual exams I've heard of." |
| Tension | 3–4 (Exam Select, Timed Exam) | "This feels like the real thing. The timer is stressful in a familiar way." |
| Relief / Pride | 5 (Score reveal + confetti) | "That score animation is satisfying. I want to feel that." |
| Surprise / Trust | 5 (Streaming AI + school cards) | "It knows my province. It's naming schools I'm actually applying to." |
| Awe | 6 (Oracle with LaTeX) | "It solved that integral step-by-step. My textbook doesn't explain it this clearly." |
| Clarity | 7 (Study Plan + checkpoint) | "I know exactly what to do tomorrow morning. It's concrete." |
| Motivation | 8 (Mastery rank + pricing) | "I can start for free. I should try this." |

---

## Why Zenith Wins vs. Alternatives

| Dimension | Generic Quiz App | Private Tutor | Zenith |
|---|---|---|---|
| Real past exams (official sources) | Sometimes | Usually | Always (40+, official) |
| Province awareness | Never | Depends on tutor | Always (63 provinces, calibrated) |
| School-specific cutoff matching | Never | Sometimes | Always (sigmoid probability) |
| Concept prerequisite tracing | Never | Manual | Automated (BKT + DAG) |
| AI step-by-step solver | Sometimes (static) | Yes | Always (streaming, LaTeX, voice, OCR) |
| Available at 2 AM before exam | Yes | No | Yes |
| Cost per month | Free–$5 | $50–$200+ | $1.20–$2.50 (29,000–59,000 VND) |
| Spaced repetition | Rarely | Manual | Built-in (FSRS algorithm) |
