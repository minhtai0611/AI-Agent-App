// Zero-width character steganography — encode/decode a user ID into plain text.
// U+200B = 0 bit, U+200C = 1 bit, U+200D = separator between bits.
// Injected only into plain-text segments (never inside $...$ math spans).

const ZW0 = '​'  // zero width space  → bit 0
const ZW1 = '‌'  // zero width non-joiner → bit 1
const ZWS = '‍'  // zero width joiner → bit separator

function encodeId(userId) {
  const bits = (userId >>> 0).toString(2).padStart(32, '0')
  return bits.split('').map(b => b === '0' ? ZW0 : ZW1).join(ZWS)
}

export function embedWatermark(text, userId) {
  if (!text || userId == null) return text
  const encoded = encodeId(userId)
  // Split on math spans ($...$) so we never inject inside LaTeX
  const segments = text.split(/(\$[^$]+\$)/)
  for (let i = 0; i < segments.length; i++) {
    if (!segments[i].startsWith('$') && segments[i].length > 10) {
      segments[i] = segments[i].slice(0, 10) + encoded + segments[i].slice(10)
      break
    }
  }
  return segments.join('')
}

export function extractWatermark(text) {
  if (!text) return null
  const chars = [...text].filter(c => c === ZW0 || c === ZW1 || c === ZWS)
  const bits = chars.filter(c => c !== ZWS).map(c => c === ZW0 ? '0' : '1')
  if (bits.length < 32) return null
  return parseInt(bits.slice(0, 32).join(''), 2)
}
