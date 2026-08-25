// Thin wrapper around whatever privacy-respecting analytics script (Rybbit/Plausible) is
// loaded via a <script> tag in index.html. No-ops entirely if that script isn't present —
// local dev and offline-first usage never depend on it.
//
// Deliberately excluded on purpose: anything named around mastery, streaks, or "weak
// topic" — that's the pedagogy line the Ascent Roadmap draws. These events answer "where
// does the product break," not "how is the student doing."

export function track(event, props = {}) {
  try {
    if (typeof window === 'undefined') return
    // Rybbit's default global
    if (typeof window.rybbit?.event === 'function') {
      window.rybbit.event(event, props)
      return
    }
    // Plausible's default global
    if (typeof window.plausible === 'function') {
      window.plausible(event, { props })
      return
    }
  } catch {
    // Analytics must never break the exam-taking flow.
  }
}
