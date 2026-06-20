import { MarkdownProse } from '@zenith/ui'

/**
 * BasicMarkdown — short paragraph with bold, italic, inline code, and a list.
 */
export const BasicMarkdown = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 600 }}>
    <MarkdownProse>
      {`## Phân tích kết quả học tập

Bạn đã hoàn thành **10/12 câu** trong đề thi thử Toán THPT Quốc Gia.
Đây là kết quả *khá tốt* so với mức trung bình của lớp.

Những chủ đề cần ôn tập thêm:

- Hàm số và đồ thị
- Phương trình lượng giác
- Tích phân bất định

Hãy dùng \`/study-plan\` để tạo kế hoạch ôn tập cá nhân hoá.`}
    </MarkdownProse>
  </div>
)

/**
 * WithMath — note: MarkdownProse uses remark-gfm only (no remark-math),
 * so LaTeX expressions render as plain text. This story demonstrates how
 * a math formula looks in the prose context (unstyled, literal string).
 * Use MathBlock/MathText for rendered LaTeX.
 */
export const WithMath = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 600 }}>
    <MarkdownProse>
      {`### Nghiệm của phương trình bậc hai

Cho phương trình $ax^2 + bx + c = 0$ (với $a \\neq 0$),
nghiệm được tính theo công thức:

$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$

**Ví dụ:** Giải $2x^2 - 7x + 3 = 0$.

Với $a=2$, $b=-7$, $c=3$, ta có $\\Delta = 49 - 24 = 25 > 0$,
nên phương trình có hai nghiệm phân biệt.`}
    </MarkdownProse>
  </div>
)

/**
 * WithTable — markdown table showing a score breakdown by topic.
 */
export const WithTable = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 640 }}>
    <MarkdownProse>
      {`### Bảng điểm theo chủ đề

| Chủ đề | Số câu | Đúng | Tỉ lệ |
|--------|--------|------|-------|
| Hàm số | 4 | 3 | 75% |
| Tích phân | 3 | 2 | 67% |
| Lượng giác | 3 | 3 | 100% |
| Tổ hợp – Xác suất | 2 | 1 | 50% |

> **Nhận xét:** Bạn làm tốt nhất ở phần Lượng giác và cần cải thiện Tổ hợp – Xác suất.`}
    </MarkdownProse>
  </div>
)
