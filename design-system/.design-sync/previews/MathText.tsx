import { MathText } from '@zenith/ui'

export const InlineArithmetic = () => (
  <div style={{ padding: 24, background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>
    <p style={{ color: 'var(--foreground)', fontSize: 15, lineHeight: 1.6 }}>
      Cho biết <MathText>$a = 3$</MathText> và <MathText>$b = 4$</MathText>,
      tính <MathText>{'$\\sqrt{a^2 + b^2}$'}</MathText>.
    </p>
  </div>
)

export const Fraction = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <p style={{ color: 'var(--foreground)', fontSize: 15, lineHeight: 1.6 }}>
      Rút gọn biểu thức: <MathText>{`$\\frac{x^2 - 1}{x + 1}$`}</MathText>
    </p>
  </div>
)

export const Calculus = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <p style={{ color: 'var(--foreground)', fontSize: 15, lineHeight: 1.6 }}>
      Tính tích phân <MathText>{`$\\int_0^1 x^2 \\, dx$`}</MathText> bằng cách dùng công thức <MathText>{`$\\int x^n dx = \\frac{x^{n+1}}{n+1} + C$`}</MathText>.
    </p>
  </div>
)

export const WithTable = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 400 }}>
    <MathText>{`| $x$ | $f(x)$ |\n|---|---|\n| 0 | 1 |\n| 1 | 2 |\n| 2 | 5 |`}</MathText>
  </div>
)
