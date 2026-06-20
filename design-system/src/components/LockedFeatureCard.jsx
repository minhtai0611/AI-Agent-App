/**
 * Overlay card for features gated behind a subscription tier.
 * Shows a lock icon, the required tier name, and an optional upgrade CTA.
 *
 * @example
 * <LockedFeatureCard
 *   label="Kế hoạch học tập AI"
 *   tier="student"
 *   onUpgrade={() => navigate('/account#upgrade')}
 * />
 */
export function LockedFeatureCard({ label, tier, onUpgrade }) {
  return (
    <div className="relative rounded-2xl border border-[var(--border)] glass-base p-5 flex flex-col gap-3 overflow-hidden min-h-[120px]">
      <div className="absolute inset-0 bg-[var(--surface)] flex flex-col items-center justify-center gap-2 z-10" style={{ opacity: 0.97 }}>
        <span className="text-2xl">🔒</span>
        <span className="font-sans text-[13px] font-semibold text-[var(--foreground)]">{label}</span>
        <span className="font-sans text-[11px] text-[var(--dim)]">
          Yêu cầu gói {tier === 'student' ? 'Học sinh' : 'Toàn diện'}
        </span>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="mt-1 px-4 py-1.5 rounded-lg font-sans text-[12px] font-bold bg-[var(--primary)] text-[var(--primary-fg)]"
          >
            Nâng cấp
          </button>
        )}
      </div>
      <div className="h-16 rounded-xl bg-[var(--surface)] opacity-30" />
    </div>
  )
}
