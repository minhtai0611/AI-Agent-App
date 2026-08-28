import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { useOrgAuth } from '../../context/OrgAuthContext.jsx'
import { fetchMembers } from '../../api/org.js'

const LINKS = [
  { path: '/org/members', label: 'Thành viên' },
  { path: '/org/audit-log', label: 'Nhật ký hoạt động' },
  { path: '/org/content', label: 'Thư viện nội dung' },
  { path: '/org/analytics', label: 'Phân tích học tập' },
  { path: '/org/integrations', label: 'Tích hợp' },
  { path: '/org/compliance', label: 'Tuân thủ & bảo mật' },
  { path: '/org/agent/generate', label: 'Sinh câu hỏi bằng AI' },
  { path: '/org/pending', label: 'Duyệt câu hỏi AI' },
  { path: '/org/proctoring-settings', label: 'Giám sát thi' },
  { path: '/org/proctoring-review', label: 'Phiên thi bị gắn cờ' },
  { path: '/org/psychometric-flags', label: 'Cảnh báo chất lượng câu hỏi' },
  { path: '/org/settings', label: 'Cài đặt' },
]

export default function OrgConsole() {
  usePageMeta('Bảng điều khiển tổ chức', { noindex: true })
  const { org, member } = useOrgAuth()
  const navigate = useNavigate()
  const [memberCount, setMemberCount] = useState(null)

  useEffect(() => {
    fetchMembers().then(rows => setMemberCount(rows.length)).catch(() => setMemberCount(null))
  }, [])

  return (
    <PageShell title={org?.name ?? 'Tổ chức'} maxWidth="max-w-3xl">
      <p className="font-sans text-[13px] text-dim -mt-2">
        Vai trò của bạn: {member?.role} · {memberCount !== null ? `${memberCount} thành viên` : 'Đang tải…'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LINKS.map(link => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="text-left p-4 rounded-xl border border-border bg-surface-elevated font-sans text-[14px] font-medium text-foreground transition hover:border-primary-border"
          >
            {link.label}
          </button>
        ))}
      </div>
    </PageShell>
  )
}
