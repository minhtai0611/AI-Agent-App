# Zenith — Lumina Design System

Lumina replaces the warm "Meridian" earth tones with a cool deep aesthetic. The design thesis: Zenith's core value is *precision diagnosis* — it finds exactly where a student loses points. A midnight-indigo ground reads as a precision instrument. Cobalt blue and violet as accent colors signal certainty and intelligence rather than warmth and approachability.

---

## Color Palette

### Philosophy
- **Light mode:** Cool blue-tinted off-white (`#F4F6FC`) — not warm cream.
- **Dark mode:** Midnight indigo (`#0B0F1A`) — deep, not muddy dark gray.
- **Primary:** Cobalt blue (`#3B6FE8` light / `#5B8FF0` dark) — precise, trusted.
- **Accent:** Violet (`#7C5CE8` light / `#A78BFA` dark) — creative, premium.
- **Mastery peak (level 5):** Inherits primary brand color — the highest achievement resolves into the color of certainty.

### Key Tokens

```
Light:  --background #F4F6FC | --surface #EDF0F8 | --foreground #0F1629
Dark:   --background #0B0F1A | --surface #111622 | --foreground #E8EDFF
Primary light: #3B6FE8 | Primary dark: #5B8FF0
Accent light:  #7C5CE8 | Accent dark:  #A78BFA
```

### Mastery Scale
0 → slate (unknown) | 1 → red | 2 → orange | 3 → amber | 4 → emerald | 5 → primary blue (mastered)

---

## Typography

### Fonts
- **Body / UI:** Sora — geometric humanist, full Vietnamese Unicode (U+0102-0103, U+1EA0-1EF9), weights 300–800
- **Numbers / Data:** DM Mono — scores, percentages, stats, credit balances
- **Math:** JetBrains Mono — KaTeX rendering only (self-hosted WOFF2)

### Scale
```
Display:  clamp(3.2rem, 7vw, 5.5rem) / weight 800
H1:       2rem / weight 700
H2:       1.5rem / weight 600
H3:       1.125rem / weight 600
Body:     1rem / weight 400 / line-height 1.65
Small:    0.875rem
XSmall:   0.75rem
Data:     font-mono (DM Mono) for scores, counts, percentages
```

### Principles
- Use weight 800 for hero headlines only.
- Body copy: weight 400, line-height 1.65 for comfortable reading in Vietnamese.
- Scores and numeric data always in `font-mono`.
- Never mix display serif with Sora — Sora covers both roles.

---

## Spacing

Standard Tailwind scale. Key reference points:
- Section gap: `32px` (gap-8)
- Card padding: `20px` (p-5)
- Inline gap: `8px` (gap-2) / `12px` (gap-3)
- Page max-width: `max-w-2xl` for content, `max-w-5xl` for dashboards

---

## Border Radius

```
xs: 4px   sm: 6px   md: 8px   lg: 12px   xl: 16px   2xl: 28px   full: 9999px
```
- Buttons: `radius-md` (8px)
- Cards: `radius-lg` (12px) or `radius-xl` (16px)
- Modals / large containers: `radius-xl` (16px) or `radius-2xl` (28px)
- Badges / chips: `radius-full`

---

## Shadows

```
xs:   subtle lift
sm:   card default
md:   card hover / modal
lg:   overlay panels
xl:   popovers / dropdowns
glow: 0 0 0 1px rgba(59,111,232,0.25), 0 4px 16px rgba(59,111,232,0.15) — focus + hover on interactive cards
```

Use `shadow-glow` on: focused inputs, hovered interactive cards, active AI elements.

---

## Motion

### Tiers
- **Tier 0 — Instant:** State toggles, icon swaps. `0ms`.
- **Tier 1 — Micro:** Button hover/press, badge updates. `100–150ms ease`.
- **Tier 2 — Element:** Card entry, tab switch, list stagger. `280–350ms ease-smooth`.
- **Tier 3 — Page:** Route transitions, modal open. `320ms ease-smooth`.
- **Tier 4 — Cinematic:** Hero sequence, score reveal, achievement ceremony. `400–800ms` with explicit delays.

### Key Variants (from `src/utils/animations.js`)
- `pageVariants` — all page-level motion.div wrappers
- `listVariants` + `itemVariants` — staggered lists (max 8 items, no stagger beyond that)
- `cardHover` — `whileHover="hover" initial="rest"` on interactive glass-base cards
- `heroItem(key)` — Landing hero elements with orchestrated delays
- `viewNavigate()` — View Transitions API wrapper for route changes

### Principles
- Every motion serves meaning: enter = appear, exit = leave, hover = alive, error = shake.
- Stagger max 8 items. Beyond that, animate as a group.
- `prefers-reduced-motion` is respected via MotionConfig — always.
- Cinematic animations (hero, score reveal) belong only in marketing/results contexts.

---

## Component Patterns

### Surface Classes (class name–locked, 73+ JSX files)
```css
.glass-base      → surface bg + border + shadow-sm
.glass-elevated  → surface-elevated bg + border + shadow-md
.glass-brand     → primary-subtle bg + primary-border
```

### Buttons
- Primary: `bg-primary text-primary-fg` hover: `#2D5BC7`
- Accent: `bg-accent text-accent-fg` hover: `#6347CC`
- Outline: `border-border text-foreground` hover: `bg-surface`
- Ghost: `text-muted-fg` hover: `bg-surface text-foreground`
- All buttons: `radius-md`, `font-size 14px`, `font-weight 500`, `padding 8px 16px`

### Cards
- Default: `.glass-base rounded-xl` or `.glass-base rounded-2xl`
- Interactive: add `cardHover` motion variant + `shadow-glow` on hover
- Brand highlight: `.glass-brand`

### Focus
- All interactive: `focus-visible:outline-2 focus-visible:outline-primary`
- Inputs: `shadow-glow` on focus ring

---

## Aurora Effects (Landing only)

Three blobs: `#3B6FE8` (cobalt) / `#7C5CE8` (violet) / `#059669` (emerald)
Light opacity: `0.06` | Dark opacity: `0.35`
Remove any 4th blob (pink) if present.

---

## Accessibility

- WCAG AA minimum contrast on all text/background combos.
- `prefers-contrast: more` — boost slate-500 → slate-700 equivalents.
- `prefers-reduced-motion` — zero durations via MotionConfig.
- `prefers-reduced-transparency` — swap glass to opaque surface.
- Touch targets minimum 44×44px on coarse pointer devices.
- Focus ring: 2px `--primary` outline, 2px offset.
