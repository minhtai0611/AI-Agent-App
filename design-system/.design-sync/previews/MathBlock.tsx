import { MathBlock } from '@zenith/ui'

/**
 * Integral — displays a definite integral with solution.
 * MathBlock uses remark-math + rehype-katex so $…$ and $$…$$ are rendered by KaTeX.
 */
export const Integral = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 560 }}>
    <MathBlock>
      {'Tính tích phân sau:\n\n$$\\int_0^1 x^2 \\, dx = \\left[\\frac{x^3}{3}\\right]_0^1 = \\frac{1}{3}$$\n\nVậy diện tích hình phẳng giới hạn bởi $y = x^2$, trục $Ox$ và $x = 1$ bằng $\\dfrac{1}{3}$.'}
    </MathBlock>
  </div>
)

/**
 * QuadraticFormula — the quadratic formula with discriminant discussion.
 */
export const QuadraticFormula = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 560 }}>
    <MathBlock>
      {'**Nghiệm phương trình bậc hai** $ax^2 + bx + c = 0$:\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nPhân tích biệt thức $\\Delta = b^2 - 4ac$:\n\n- $\\Delta > 0$: hai nghiệm phân biệt $x_1, x_2$\n- $\\Delta = 0$: nghiệm kép $x = -\\dfrac{b}{2a}$\n- $\\Delta < 0$: vô nghiệm thực'}
    </MathBlock>
  </div>
)

/**
 * Matrix — a 2×2 matrix determinant formula with example.
 */
export const Matrix = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 560 }}>
    <MathBlock>
      {'**Định thức ma trận** $2 \\times 2$:\n\n$$\\det(A) = \\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc$$\n\n**Ví dụ:** Tính định thức của $A = \\begin{pmatrix} 3 & 1 \\\\ 2 & 4 \\end{pmatrix}$\n\n$$\\det(A) = 3 \\cdot 4 - 1 \\cdot 2 = 12 - 2 = 10$$'}
    </MathBlock>
  </div>
)
