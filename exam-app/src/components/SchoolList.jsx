const MATCH_CONFIG = {
  safety: { label: 'An toàn',     bg: '#0F2A1A', text: '#10B981', border: '#1A4A2A' },
  match:  { label: 'Phù hợp',    bg: '#2A1F08', text: '#F59E0B', border: '#5A3A10' },
  reach:  { label: 'Thách thức', bg: '#2A0F14', text: '#FB7185', border: '#5A1A24' },
}

const TYPE_LABELS = {
  chuyên:           'Chuyên',
  chất_lượng_cao:  'Chất lượng cao',
  thường:           'Phổ thông',
}

const TREND_ICON = {
  rising:  { icon: '↑', color: '#FB7185', title: 'Điểm chuẩn đang tăng' },
  falling: { icon: '↓', color: '#10B981', title: 'Điểm chuẩn đang giảm' },
  stable:  { icon: '→', color: '#94A3B8', title: 'Điểm chuẩn ổn định' },
}

const ORDER = ['safety', 'match', 'reach']

export default function SchoolList({ recommendations }) {
  if (!recommendations?.length) return null

  const sorted = [...recommendations].sort(
    (a, b) => ORDER.indexOf(a.matchStrength) - ORDER.indexOf(b.matchStrength)
  )

  return (
    <div className="flex flex-col gap-2.5">
      {sorted.map(({ school, matchStrength, cutoff }) => {
        const cfg = MATCH_CONFIG[matchStrength] ?? MATCH_CONFIG.match
        const trend = TREND_ICON[school.trend]
        const typeLabel = TYPE_LABELS[school.type] ?? school.type

        return (
          <div
            key={school.id}
            className="flex items-center justify-between bg-[#111827] border border-[#1E2A44] rounded-[10px] px-4 py-3.5 gap-3"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-jakarta text-[14px] font-medium text-[#F0F4FF] truncate">
                  {school.name}
                </span>
                {trend && (
                  <span
                    className="font-jakarta text-[11px] font-bold flex-shrink-0"
                    style={{ color: trend.color }}
                    title={trend.title}
                  >
                    {trend.icon}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-jakarta text-[11px] text-[#475569]">{school.district}</span>
                <span className="font-jakarta text-[10px] text-[#2A3A50]">·</span>
                <span className="font-jakarta text-[11px] text-[#475569]">{typeLabel}</span>
                <span className="font-jakarta text-[10px] text-[#2A3A50]">·</span>
                <span className="font-jakarta text-[11px] text-[#475569]">
                  Điểm Toán 2024: <span className="text-[#94A3B8]">{cutoff}</span>
                </span>
              </div>
            </div>

            <div
              className="px-2.5 py-1 rounded-md border flex-shrink-0"
              style={{ background: cfg.bg, borderColor: cfg.border }}
            >
              <span className="font-jakarta text-[11px] font-semibold" style={{ color: cfg.text }}>
                {cfg.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
