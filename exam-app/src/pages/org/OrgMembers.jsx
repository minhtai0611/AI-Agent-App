import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { fetchMembers, updateMember, inviteMember } from '../../api/org.js'

const ROLES = ['learner', 'proctor', 'admin', 'owner']

export default function OrgMembers() {
  usePageMeta('Thành viên tổ chức', { noindex: true })
  const [members, setMembers] = useState(null)
  const [error, setError] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('learner')

  const reload = () => fetchMembers().then(setMembers).catch(() => setError('Không tải được danh sách thành viên.'))

  useEffect(() => { reload() }, [])

  async function handleRoleChange(memberId, role) {
    await updateMember(memberId, { role })
    reload()
  }

  async function handleDeactivate(memberId) {
    await updateMember(memberId, { status: 'deactivated' })
    reload()
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail) return
    await inviteMember(inviteEmail, inviteRole)
    setInviteEmail('')
    reload()
  }

  return (
    <PageShell title="Thành viên" maxWidth="max-w-3xl">
      <PageCard>
        <form onSubmit={handleInvite} className="flex items-center gap-2 flex-wrap">
          <input
            type="email" required placeholder="email@congty.com" value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground flex-1 min-w-[200px]"
          />
          <select
            value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" className="px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Mời</button>
        </form>
      </PageCard>

      {error && <p className="font-sans text-[13px] text-destructive">{error}</p>}
      {!error && members === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}

      <div className="flex flex-col gap-2">
        {(members ?? []).map(m => {
          const locked = m.source === 'scim'
          return (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-elevated flex-wrap">
              <div className="flex flex-col flex-1 min-w-[160px]">
                <span className="font-sans text-[13px] font-medium text-foreground">{m.email}</span>
                <span className="font-sans text-[11px] text-dim">
                  {m.source === 'scim' ? 'Đồng bộ SCIM' : m.source === 'sso_jit' ? 'Đăng nhập SSO' : 'Thêm thủ công'} · {m.status}
                </span>
              </div>
              <select
                value={m.role} disabled={locked}
                onChange={e => handleRoleChange(m.id, e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-border bg-background font-sans text-[12px] text-foreground disabled:opacity-50"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                disabled={locked || m.status === 'deactivated'}
                onClick={() => handleDeactivate(m.id)}
                className="px-3 py-1.5 rounded-lg font-sans text-[11px] font-medium border border-border text-dim disabled:opacity-40"
              >
                Vô hiệu hóa
              </button>
            </div>
          )
        })}
      </div>
    </PageShell>
  )
}
