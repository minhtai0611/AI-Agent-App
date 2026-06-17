// Only patterns that UNAMBIGUOUSLY require viewing a separate image to answer.
// Deliberately excludes "hình" alone (appears in "hình chữ nhật", "hình tròn" etc.)
// and "đồ thị" alone (can appear in self-contained questions describing a graph verbally).
const IMAGE_REF_RE = /hình vẽ|hình bên|hình dưới|hình sau|xem hình|theo hình vẽ|bảng biến thiên|xem đề thi gốc|\(Xem/i

export function hasImageDependency(questionText) {
  return IMAGE_REF_RE.test(questionText)
}
