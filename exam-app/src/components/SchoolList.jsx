const MATCH_CONFIG = {
  safety: { label: 'An toàn', bg: '#0F2A1A', text: '#10B981', border: '#1A4A2A' },
  match:  { label: 'Phù hợp', bg: '#2A1F08', text: '#F59E0B', border: '#5A3A10' },
  reach:  { label: 'Thách thức', bg: '#2A0F14', text: '#FB7185', border: '#5A1A24' },
}

export default function SchoolList({ recommendations }) {
  if (!recommendations?.length) return null
  return (
    <div className="flex flex-col gap-2.5">
      {recommendations.map(({ school, matchStrength, cutoff }) => {
        const cfg = MATCH_CONFIG[matchStrength] ?? MATCH_CONFIG.match
        return (
          <div
            key={school.id}
            className="flex items-center justify-between bg-[#111827] border border-[#1E2A44] rounded-[10px] px-4 py-3.5"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-jakarta text-[14px] font-medium text-[#F0F4FF]">{school.name}</span>
              <span className="font-jakarta text-[12px] text-[#475569]">
                {school.district} · Điểm chuẩn Toán: {cutoff}
              </span>
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
