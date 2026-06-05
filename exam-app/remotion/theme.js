// Design tokens matching the exam app's dark theme
export const C = {
  bg:       '#0A0E1A',
  card:     '#0D1221',
  border:   '#1E2A44',
  border2:  '#2A3A50',
  text:     '#F8FAFC',
  textSub:  '#94A3B8',
  textMuted:'#475569',
  amber:    '#F2A20C',
  green:    '#34D399',
  red:      '#FB7185',
  indigo:   '#818CF8',
  blue:     '#60A5FA',
}

export const FONT = "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif"
export const FONT_SERIF = "Georgia, serif"

export function card(extra = {}) {
  return {
    background: C.card,
    border: `1.5px solid ${C.border}`,
    borderRadius: 16,
    padding: '20px 24px',
    ...extra,
  }
}
