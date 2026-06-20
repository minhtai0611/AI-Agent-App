export const Visible = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'var(--surface)', borderRadius: 16, padding: 20, maxWidth: 360,
      border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
          Thêm vào màn hình chính
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--muted-foreground)' }}>
          Trải nghiệm nhanh hơn, offline được
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button style={{
          padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700,
          background: 'var(--primary)', color: 'var(--background)',
        }}>Thêm</button>
        <span style={{ fontSize: 20, lineHeight: 1, color: 'var(--muted-foreground)', cursor: 'pointer' }}>×</span>
      </div>
    </div>
  </div>
)

export const WithCustomMessage = () => (
  <div style={{ padding: 24, background: 'var(--surface)' }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'var(--background)', borderRadius: 16, padding: 20, maxWidth: 360,
      border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
          Thêm vào màn hình chính
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--muted-foreground)' }}>
          Trải nghiệm nhanh hơn, offline được
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button style={{
          padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700,
          background: 'var(--primary)', color: 'var(--background)',
        }}>Thêm</button>
        <span style={{ fontSize: 20, lineHeight: 1, color: 'var(--muted-foreground)', cursor: 'pointer' }}>×</span>
      </div>
    </div>
  </div>
)
