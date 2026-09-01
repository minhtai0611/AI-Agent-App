// Vantage v1.4.1 shell footer — one mono line, per pages-overhaul-plan.md's
// "Vỏ chung" spec: "GIẤY — MỰC — CỜ ĐỈNH · V2 · ∫Σ√π∞Δ".
export default function Footer() {
  return (
    <footer
      className="relative z-[1] mt-auto border-t px-6 py-4 text-center"
      style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.08em' }}>
        GIẤY — MỰC — CỜ ĐỈNH · V2 · ∫Σ√π∞Δ
      </span>
    </footer>
  )
}
