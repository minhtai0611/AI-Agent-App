import { SymbolPalette } from '@zenith/ui'

/**
 * AllGroups — full palette mounted below a mock answer input.
 * onInsert logs the chosen symbol to the console so the interaction
 * can be observed in the design-sync preview iframe.
 * Note: SymbolPalette initialises open state based on window.innerWidth >= 640,
 * so it will be open by default in a desktop preview viewport.
 */
export const AllGroups = () => (
  <div style={{ padding: 0, background: 'var(--background)', maxWidth: 640 }}>
    <div
      style={{
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px 12px 0 0',
        fontSize: 13,
        color: 'var(--foreground)',
      }}
    >
      <textarea
        rows={2}
        placeholder="Nhập câu trả lời... (nhấn ký hiệu bên dưới để chèn)"
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontSize: 13,
          color: 'var(--foreground)',
          fontFamily: 'inherit',
        }}
        readOnly
      />
    </div>
    <SymbolPalette onInsert={(s: string) => console.log('Inserted:', s)} />
  </div>
)

/**
 * StandaloneMinimal — palette without a surrounding input, useful for verifying
 * the component's own chrome (tab bar + symbol grid) in isolation.
 * onInsert is a no-op so the story remains pure.
 */
export const StandaloneMinimal = () => (
  <div
    style={{
      padding: 0,
      background: 'var(--background)',
      maxWidth: 480,
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--foreground)',
        opacity: 0.5,
        fontFamily: 'inherit',
      }}
    >
      Bảng ký hiệu toán học — chọn để chèn vào bài làm
    </div>
    <SymbolPalette onInsert={() => {}} />
  </div>
)
