export function LockedFeatureCard({ label, tier, onUpgrade }) {
  return (
    <div className="relative rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 overflow-hidden min-h-[120px]">
      <div className="absolute inset-0 backdrop-blur-[2px] bg-background/60 flex flex-col items-center justify-center gap-2 z-10">
        <span className="text-2xl">🔒</span>
        <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">{label}</span>
        <span className="font-jakarta text-[0.6875rem] text-dim">
          Yêu cầu gói {tier === 'student' ? 'Học sinh' : 'Toàn diện'}
        </span>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="mt-1 px-4 py-1.5 rounded-lg font-jakarta text-xs font-bold text-primary-fg"
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
