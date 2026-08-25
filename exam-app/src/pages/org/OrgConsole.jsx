import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { pageVariants } from '../../utils/animations.js'
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
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">{org?.name ?? 'Tổ chức'}</h1>
          <p className="font-sans text-[13px] text-dim">
            Vai trò của bạn: {member?.role} · {memberCount !== null ? `${memberCount} thành viên` : 'Đang tải…'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {LINKS.map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] font-sans text-[14px] font-medium text-foreground transition hover:border-[var(--primary-border)]"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
