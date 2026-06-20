import { FormulaDrawer } from '@zenith/ui'

/**
 * FormulaDrawer manages its own open/closed state internally — no props required.
 * It renders as a fixed bottom-sheet overlay in production, so we contain it with
 * position:relative + overflow:hidden to keep the preview self-contained.
 *
 * Open — the toggle button is always visible; click it to open the drawer.
 * Since the drawer is self-controlled, we show the toggle button in context.
 */
export const ToggleButton = () => (
  <div
    style={{
      padding: 24,
      background: 'var(--background)',
      position: 'relative',
      height: 400,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <div style={{ fontSize: 13, color: 'var(--foreground)', opacity: 0.6, marginBottom: 8 }}>
      Nhấn nút bên dưới để mở bảng công thức:
    </div>
    <FormulaDrawer />
  </div>
)

/**
 * InContext — simulates FormulaDrawer sitting alongside an exam question,
 * showing how the toggle button fits within a toolbar row.
 */
export const InContext = () => (
  <div
    style={{
      padding: 24,
      background: 'var(--background)',
      position: 'relative',
      height: 480,
      overflow: 'hidden',
    }}
  >
    {/* Mock question toolbar */}
    <div
      style={{
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        marginBottom: 16,
        fontSize: 13,
        color: 'var(--foreground)',
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Câu 12.</div>
      <div>
        Giải phương trình: $x^2 - 5x + 6 = 0$
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--foreground)', opacity: 0.5 }}>Công cụ:</span>
        <FormulaDrawer />
      </div>
    </div>
  </div>
)
