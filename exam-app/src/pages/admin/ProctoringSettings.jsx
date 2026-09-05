import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { useEscapeToClose } from '../../hooks/useEscapeToClose.js'
import { getProctoringSettings, updateProctoringSettings } from '../../api/org.js'

const TIERS = [
  { value: 'none', label: 'Không giám sát' },
  { value: 'ai_review', label: 'AI tự động rà soát' },
  { value: 'identity_plus_ai', label: 'Xác minh danh tính + AI' },
  { value: 'human_escalation', label: 'Giám sát viên trực tiếp' },
]

export default function ProctoringSettings() {
  usePageMeta('Cài đặt giám sát thi', { noindex: true })
  const [tier, setTier] = useState('none')
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)
  useEscapeToClose(open, () => setOpen(false))

  useEffect(() => {
    getProctoringSettings().then(s => setTier(s.tier_enabled)).catch(() => {})
  }, [])

  async function handleChange(value) {
    setTier(value)
    setSaved(false)
    await updateProctoringSettings(value)
    setSaved(true)
  }

  const currentLabel = TIERS.find(t => t.value === tier)?.label ?? tier

  return (
    <PageShell title="Giám sát thi (AI proctoring)">
      <p className="font-sans text-[13px] text-dim -mt-2">
        Mức giám sát cao nhất tổ chức cho phép — mức thực tế áp dụng cho mỗi bài thi còn phụ thuộc vào độ khó/tính chất kỳ thi.
        Đây là bản khung: chưa kết nối nhà cung cấp giám sát thực tế.
      </p>

      <PageCard className="max-w-sm">
        <div className="vtg-ledger-table">
          <div className="vtg-ledger-row">
            <span className="vtg-ledger-label">Mức hiện tại</span>
            <span className="vtg-ledger-value">{currentLabel}</span>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="vtg-btn-primary self-start">
          MỞ PHIẾU ĐIỀU PHỐI ▲
        </button>
      </PageCard>

      {open && (
        <div className="vtg-overlay" onClick={() => setOpen(false)}>
          <div className="vtg-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="vtg-modal-head">
              <div>
                <span className="vtg-modal-kicker">CÀI ĐẶT GIÁM SÁT KỲ THI</span>
                <span className="vtg-modal-title">Phiếu điều phối cấp độ giám sát</span>
              </div>
              <button onClick={() => setOpen(false)} className="vtg-modal-close" aria-label="Đóng">✕</button>
            </div>

            <div className="vtg-modal-body">
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                Mức giám sát cao nhất tổ chức cho phép
              </p>
              <div className="flex flex-col gap-2">
                {TIERS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => handleChange(t.value)}
                    className="text-left px-4 py-3 transition"
                    style={{
                      fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, borderRadius: 'var(--r-sm)',
                      border: `1px solid ${tier === t.value ? 'var(--accent)' : 'var(--line)'}`,
                      background: tier === t.value ? 'color-mix(in srgb, var(--accent) 10%, var(--paper))' : 'var(--paper-2)',
                      color: tier === t.value ? 'var(--accent-deep)' : 'var(--ink)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {saved && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--pine)' }}>Đã lưu.</span>
              )}
            </div>

            <div className="vtg-modal-foot">
              <button onClick={() => setOpen(false)} className="vtg-btn-primary">XONG ▲</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
