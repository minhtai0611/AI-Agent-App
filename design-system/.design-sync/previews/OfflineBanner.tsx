export const Offline = () => (
  <div style={{ background: 'var(--background)', padding: '4px 0' }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px',
      background: 'var(--surface)',
      borderBottom: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
    }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'color-mix(in srgb, var(--primary) 80%, transparent)' }}>
        Không có mạng — tính năng AI không khả dụng · Đề thi vẫn hoạt động bình thường
      </span>
      <span style={{ fontSize: 18, lineHeight: 1, color: 'var(--muted-foreground)', marginLeft: 12, flexShrink: 0, cursor: 'pointer' }}>×</span>
    </div>
  </div>
)

export const Syncing = () => (
  <div style={{ background: 'var(--background)', padding: '4px 0' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px',
      background: 'var(--surface)',
      borderBottom: '1px solid color-mix(in srgb, var(--success) 20%, transparent)',
    }}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
        border: '2px solid var(--success)', borderTopColor: 'transparent',
        display: 'inline-block',
      }} />
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--success)' }}>
        Đã có mạng — đang đồng bộ kết quả...
      </span>
    </div>
  </div>
)
