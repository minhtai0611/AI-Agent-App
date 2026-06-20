import { AchievementCeremony } from '@zenith/ui'

/**
 * trigger=true — animates in on mount (simulates freshly-earned milestone).
 * Wrap with className for layout context.
 */
export const PerfectScore = () => (
  <div style={{ padding: 24, background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
    <AchievementCeremony trigger={true} className="block text-center">
      <div style={{ fontSize: 64 }}>🏆</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', marginTop: 8 }}>
        Xuất sắc! Điểm tuyệt đối
      </div>
      <div style={{ fontSize: 13, color: 'var(--primary)', marginTop: 4 }}>
        10/10 câu đúng — Đề Toán THPT 2024
      </div>
    </AchievementCeremony>
  </div>
)

/**
 * trigger=false — component renders but stays invisible (scale 0.7, opacity 0).
 * Shows the "not yet triggered" resting state.
 */
export const NotYetEarned = () => (
  <div style={{ padding: 24, background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
    <div style={{ fontSize: 13, color: 'var(--foreground)', marginBottom: 8 }}>
      Trạng thái chưa đạt (trigger=false — ẩn hoàn toàn):
    </div>
    <AchievementCeremony trigger={false} className="block text-center">
      <div style={{ fontSize: 64 }}>🎖️</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', marginTop: 8 }}>
        Hoàn thành 7 ngày liên tiếp
      </div>
      <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4 }}>
        Streak học tập 7 ngày
      </div>
    </AchievementCeremony>
    <div style={{ fontSize: 11, color: 'var(--foreground)', opacity: 0.4, marginTop: 8 }}>
      (không nhìn thấy nội dung bên trên — đang ở trạng thái ẩn)
    </div>
  </div>
)
