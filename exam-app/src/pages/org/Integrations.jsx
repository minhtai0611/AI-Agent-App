import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { getApiKeys, postApiKey, getWebhooks, postWebhook } from '../../api/org.js'

export default function Integrations() {
  usePageMeta('Tích hợp', { noindex: true })
  const [keys, setKeys] = useState(null)
  const [newKey, setNewKey] = useState(null)
  const [webhooks, setWebhooks] = useState(null)
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    getApiKeys().then(setKeys).catch(() => setKeys([]))
    getWebhooks().then(setWebhooks).catch(() => setWebhooks([]))
  }, [])

  async function handleCreateKey() {
    const key = await postApiKey('LMS integration', 'roster:read,scores:read')
    setNewKey(key.apiKey)
    getApiKeys().then(setKeys)
  }

  async function handleCreateWebhook(e) {
    e.preventDefault()
    if (!webhookUrl) return
    await postWebhook(webhookUrl, crypto.randomUUID(), 'attempt.completed')
    setWebhookUrl('')
    getWebhooks().then(setWebhooks)
  }

  return (
    <PageShell title="Tích hợp" maxWidth="max-w-3xl">
      <PageCard label="API keys">
        <button onClick={handleCreateKey} className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Tạo key mới</button>
        {newKey && (
          <p className="font-sans text-[12px] text-primary break-all">Key mới (chỉ hiện một lần): {newKey}</p>
        )}
        <div className="flex flex-col gap-1.5">
          {(keys ?? []).map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
              <span className="font-sans text-[13px] text-foreground">{k.label}</span>
              <span className="font-sans text-[11px] text-dim">{k.scopes}</span>
            </div>
          ))}
        </div>
      </PageCard>

      <PageCard label="Webhooks">
        <form onSubmit={handleCreateWebhook} className="flex items-center gap-2">
          <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://..."
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground" />
          <button type="submit" className="px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Thêm</button>
        </form>
        <div className="flex flex-col gap-1.5">
          {(webhooks ?? []).map(w => (
            <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
              <span className="font-sans text-[13px] text-foreground break-all">{w.url}</span>
              <span className="font-sans text-[11px] text-dim">{w.event_types}</span>
            </div>
          ))}
        </div>
      </PageCard>
    </PageShell>
  )
}
