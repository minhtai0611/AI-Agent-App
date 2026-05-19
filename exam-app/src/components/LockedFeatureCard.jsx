export function LockedFeatureCard({ label, tier, onUpgrade }) {
  return (
    <div className="relative rounded-2xl border border-[#1E2A44] bg-[#0D1521] p-5 flex flex-col gap-3 overflow-hidden min-h-[120px]">
      <div className="absolute inset-0 backdrop-blur-[2px] bg-[#0A0E1A]/60 flex flex-col items-center justify-center gap-2 z-10">
        <span className="text-2xl">🔒</span>
        <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">{label}</span>
        <span className="font-jakarta text-[11px] text-[#64748B]">
          Yêu cầu gói {tier === 'student' ? 'Học sinh' : 'Toàn diện'}
        </span>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="mt-1 px-4 py-1.5 rounded-lg font-jakarta text-[12px] font-bold text-[#0A0E1A]"
            style={{ background: '#F2A20C' }}
          >
            Nâng cấp
          </button>
        )}
      </div>
      <div className="h-16 rounded-xl bg-[#141D2E] opacity-30" />
    </div>
  )
}
