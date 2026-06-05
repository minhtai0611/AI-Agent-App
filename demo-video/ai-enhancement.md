# Zenith — AI Video Enhancement Plan

## Scene-by-Scene Enhancements

---

### Scene 1: Hero Arrival (0:00–0:08)

**Enhancement type:** Atmospheric ambient motion + color grade  
**Tool:** Kling AI (image-to-video ambient loop) or Runway Gen-3 (video-to-video texture pass)

**Kling AI prompt (background layer):**
> "Dark indigo space background, slow drift of tiny amber and violet light particles, no hard edges, dreamlike depth of field, cinematic, 8-second seamless loop, no text, no UI, macro lens feel"

**Camera movement:** None on the app itself. Apply a very slow (8s) parallax drift of ~4px on a separate background layer behind the screen recording, using CapCut keyframe position tool. This creates subtle depth without disrupting the UI.

**Color grade note:** Pull down highlights to near #0A0E1A equivalent, boost amber channel (+15 hue rotation toward gold). Add a very subtle vignette (15% edge darkening) to focus attention on the hero headline.

---

### Scene 2: Exam Select Catalog (0:08–0:17)

**Enhancement type:** Text overlay + subtle Ken Burns on card grid  
**Tool:** CapCut (keyframe opacity + position on text layer)

**Overlay text to animate in:**
> "40+ đề thi thật · 63 tỉnh thành"
> White text · Plus Jakarta Sans Bold · fade in at 0:10 · hold 2s · fade out at 0:15

**Camera movement:** Subtle Ken Burns on the exam card grid: 1.0x → 1.02x scale over 9s, panning very slightly upward. Implies depth without distraction.

**Color grade note:** Slightly cool tint (−5 temperature) to contrast with the warm amber score badges on each card row.

---

### Scene 3: TestInterface — Exam + Hint (0:17–0:29)

**Enhancement type:** Timer pulse composite + hint popover highlight  
**Tool:** CapCut (mask + opacity keyframe on a circular glow over the timer element)

**Timer glow asset prompt (for static generation in Midjourney or DALLE):**
> "Soft red-orange circular glow, no hard edges, radius 60px, transparent PNG, ambient light only"

Composite the glow asset over the timer region with a 1-second heartbeat pulse: opacity 0 → 0.6 → 0 keyed at 60fps.

**Hint reveal enhancement:** As the hint text streams in word-by-word, add a thin amber underline (2px, 80% opacity) that sweeps left-to-right beneath each new line in CapCut. Synchronized to the streaming text timing.

**Camera movement:** None — stability signals seriousness.

**Color grade note:** Reduce saturation by 10% on this scene only to make the amber timer pop relative to the UI. Add +5% contrast.

---

### Scene 4: Score + Confetti + AI Analysis + School Cards (0:29–0:47)

**Enhancement type:** Celebration — zoom punch + warm color grade + underline sweep on AI text  
**Tool:** CapCut (zoom punch keyframe at CountUp completion) + Runway Gen-3 (color grade preset: "Golden Hour")

**Runway color grade prompt:**
> "Warm golden grade, boost yellows and greens, slight lens flare at frame center, cinematic exposure lift, celebratory, joyful, no desaturation"

**Zoom punch (MOST IMPORTANT enhancement in the entire video):**
At the exact frame where CountUp reaches 7.6 (approximately 1.8s into Scene 4):
- Apply a single 0.12s zoom punch: 1.0x → 1.06x → 1.0x using CapCut elastic ease
- Center point: the score digit itself
- This punch is the cinematic equivalent of a "sting" in music — it locks the number in the viewer's mind

**School cards enhancement:** Add a soft indigo-to-teal glow composite behind each school card as they fade in. Use Runway prompt:
> "Soft indigo-to-teal gradient glow behind a dark card, depth of field bokeh in background, no text, subtle, editorial, 1920x1080"

**Camera movement:** None (content is moving enough with confetti + scroll).

**Color grade note:** This is the warmest scene. Lift blacks slightly (+5 pedestal), push saturation +15 on yellows and greens to make the confetti more vivid. The score digit #F2A20C should feel like sunlight.

---

### Scene 5: Oracle AI — Streaming Solution (0:47–0:59)

**Enhancement type:** Step reveal highlight beam + scholarly background texture  
**Tool:** Kling AI (background texture loop) + CapCut (step highlight overlay)

**Kling AI background texture prompt:**
> "Abstract dark slate surface, faint chalk dust particles drifting slowly, soft ambient light from upper left, no text, no math symbols visible, 8-second seamless loop, cinematic, scholarly, quiet"

**Step highlight overlay:** As each solution step appears, flash a 0.3s horizontal amber bar (2px height, full-width, 30% opacity) behind that step's text row. This draws the eye to new content and reinforces the "streaming" mental model. Keyframe in CapCut.

**Camera movement:** Very slight rightward pan (~12px over 12s) on the Oracle panel — implies "zooming in" to the detail without actually zooming.

**Color grade note:** Deep, scholarly. Reduce brightness by 5%, add +8 contrast. The KaTeX-rendered boxed answer (white on dark) should be the brightest element in the frame. Add soft vertical vignettes on left and right edges.

---

### Scene 6: Study Plan — Checkpoint (0:59–1:09)

**Enhancement type:** Checkpoint bar glow composite  
**Tool:** Runway Gen-3 (video-to-video: add soft bar glow) + CapCut (animated progress fill accent)

**Runway prompt for checkpoint bar enhancement:**
> "Dark UI card, a horizontal progress bar filling from left to right in gold-to-green gradient, soft ambient glow behind the bar, 3-second duration, loop-ready, no text, cinematic, clean"

**Camera movement:** Very slow downward drift (mirroring the scroll): CapCut position keyframes pan the layer ~60px downward over 10s.

**Color grade note:** Keep grade neutral. The gold (checkpoint not yet cleared) and emerald (cleared) colors on the bar are already correct — do not over-grade and lose the saturation difference.

---

### Scene 7: Account — Mastery Rank + Pricing (1:09–1:20)

**Enhancement type:** Mastery rank badge spring pop + pricing table glow  
**Tool:** CapCut (scale keyframe on badge layer) + Veo 2 (end card background generation)

**Badge pop composite:** At the moment the "Học sinh Tiến bộ" badge animates in (spring stiffness 320 — ~0.7s), add a brief radial glow pulse (indigo #818CF8, 0.4s, opacity 0 → 0.5 → 0) behind the badge in CapCut.

**Camera movement:** Very slow upward tilt (15px over 11s) — creates a sense of "rising."

**Color grade note:** Warmest point of the video. Lift exposure by 8%, push amber saturation to near maximum. Should feel like dawn after a long study session.

---

## End Card (1:20–1:24)

**Tool:** Veo 2 (generative background loop)

**Veo 2 prompt:**
> "Abstract dark space with slowly moving golden light streaks, indigo nebula wisps, calm and aspirational, 5-second looping sequence, no text, no people, cinematic, 1920x1080"

**End card layout:**
```
[Veo 2 loop at 40% opacity over #0A0E1A solid]

               ✦
    Luyện thi thông minh hơn.
  AI phân tích · 63 tỉnh thành
     Từ 29,000đ / tháng

   [  Bắt đầu miễn phí →  ]   ← gold button with breathing pulse

              zenith.vn
```

**CTA button animation:** 1.0x → 1.03x → 1.0x scale loop, 2s period, sinusoidal ease — subtle breathing effect that draws the eye without being distracting.

---

## Overall Color Grade Recommendation

Apply a base LUT to all scenes for consistency before scene-specific grades:

| Parameter | Value |
|---|---|
| Shadows | Pulled to near #0A0E1A |
| Highlights | Warm amber shift (+10 toward #F2A20C) |
| Contrast | +12 (punchy, not harsh) |
| Saturation | −8 globally (prevents rich UI colors from clipping; individual scenes restore selectively) |
| Vignette | 12% global edge darkening throughout |

**Grade arc across the video:**

| Scenes | Grade Mood | Feel |
|---|---|---|
| 1–3 | Cool / neutral | Focused, serious, credible |
| 4 | Warm / golden | Celebratory, emotional peak |
| 5–6 | Cool / analytical | Intelligent, precise |
| 7 + End | Warm / aspirational | Hopeful, motivating |

---

## Music Vibe

Three movements that mirror the emotional arc:

**Movement 1 (Scenes 1–3, 0:00–0:29):** Minimal, slightly tense. Sparse piano notes over a soft sub-bass drone, ~80 BPM. Implies focus and serious preparation without being oppressive.

**Movement 2 (Scenes 4–5, 0:29–0:59):** A single percussion hit on the confetti burst, then the melody opens up. A subtle melodic motif (synth or acoustic guitar) feels like a door opening. Still restrained but warmer. Tempo rises to ~95 BPM.

**Movement 3 (Scenes 6–7 + End, 0:59–1:24):** Hopeful, quietly confident resolution. Not triumphant pop — the feeling of finishing a difficult proof correctly. Tempo holds at ~100 BPM, then decelerates to hold on the end card.

**Overall palette:** Lo-fi acoustic meets ambient electronic. Think Nils Frahm at lower energy, or a Vietnamese indie lo-fi artist. Avoid anything with lyrics, vocal chops, or EDM builds — they fight with the Vietnamese text on screen.

**Key cue:** The single percussion hit must land exactly on the CountUp completion / confetti burst (Scene 4, ~1.8s in). This is the most important audio sync point in the entire video.
