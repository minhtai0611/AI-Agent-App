export const DEFAULT_PREFERENCES = {
  hint_style:        'socratic',       // 'socratic' | 'direct' | 'visual'
  explanation_depth: 'detailed',       // 'brief' | 'detailed' | 'step-by-step'
  language_mix:      'vietnamese-only',// 'vietnamese-only' | 'mixed'
  weak_topic_focus:  true,             // auto-prioritise weak topics in hints
}

export const STORAGE_KEY = 'ai_preferences'

export function loadPreferences(store = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs, store = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  store?.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function isCustomized(prefs) {
  return Object.keys(DEFAULT_PREFERENCES).some(k => prefs[k] !== DEFAULT_PREFERENCES[k])
}

const HINT_STYLE_DESC = {
  socratic: 'Socratic — đặt câu hỏi gợi mở, để học sinh tự suy nghĩ',
  direct:   'direct — trả lời thẳng, giải thích rõ ràng',
  visual:   'visual — ưu tiên sơ đồ, bước từng phần trực quan',
}

const DEPTH_DESC = {
  brief:        'brief — ngắn gọn, 1–2 câu',
  detailed:     'detailed — giải thích rõ ràng',
  'step-by-step': 'step-by-step — từng bước cụ thể',
}

export function preferencesToPromptContext(prefs) {
  const parts = []
  if (prefs.hint_style !== DEFAULT_PREFERENCES.hint_style)
    parts.push(`Phong cách: ${HINT_STYLE_DESC[prefs.hint_style] ?? prefs.hint_style}`)
  if (prefs.explanation_depth !== DEFAULT_PREFERENCES.explanation_depth)
    parts.push(`Độ chi tiết: ${DEPTH_DESC[prefs.explanation_depth] ?? prefs.explanation_depth}`)
  if (prefs.language_mix === 'mixed')
    parts.push('Ngôn ngữ: mixed (Vietnamese + English math terms)')
  if (prefs.weak_topic_focus === false)
    parts.push('Không ưu tiên chủ đề yếu')

  return parts.length > 0 ? `[Tùy chỉnh AI: ${parts.join('. ')}]` : ''
}
