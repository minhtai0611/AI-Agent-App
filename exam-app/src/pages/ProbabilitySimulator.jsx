import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import PageShell, { PageCard } from '../components/PageShell.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { describeAgentFetchError } from '../lib/agentError.js'

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function runSimulation(body) {
  try {
    const res = await fetch(`${_API_BASE}/agent/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { available: false, reason: await describeAgentFetchError(res) }
    return await res.json()
  } catch (err) {
    return { available: false, reason: err.message }
  }
}

function toChartData(histogram, pmf, trials) {
  const empiricalCounts = {}
  for (const v of histogram) empiricalCounts[v] = (empiricalCounts[v] ?? 0) + 1
  const keys = Object.keys(pmf).map(Number).sort((a, b) => a - b)
  return keys.map((k) => ({
    label: String(k),
    empirical: (empiricalCounts[k] ?? 0) / trials,
    theoretical: pmf[String(k)],
  }))
}

export default function ProbabilitySimulator() {
  usePageMeta('Xác suất & mô phỏng', { noindex: true })
  const [experiment, setExperiment] = useState('dice')
  const [nDice, setNDice] = useState(2)
  const [trials, setTrials] = useState(2000)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    setLoading(true)
    const statistic = experiment === 'coin' ? 'count' : 'sum'
    const res = await runSimulation({ experiment, n_dice: nDice, trials, statistic })
    setResult(res)
    setLoading(false)
  }

  const chartData = result?.available ? toChartData(result.histogram, result.pmf, trials) : null

  return (
    <PageShell title="Xác suất & mô phỏng">
      <PageCard>
        <div className="flex gap-2">
          {['dice', 'coin'].map((e) => (
            <button
              key={e}
              onClick={() => { setExperiment(e); setResult(null) }}
              className={`px-3.5 py-2 rounded-lg font-sans text-xs border transition ${experiment === e ? 'bg-primary text-primary-fg border-primary' : 'bg-surface text-muted border-border'}`}
            >
              {e === 'dice' ? 'Xúc xắc (tổng)' : 'Đồng xu (số mặt sấp)'}
            </button>
          ))}
        </div>

        <div className="flex gap-4 flex-wrap">
          <label className="flex flex-col gap-1 font-sans text-xs text-dim">
            {experiment === 'dice' ? 'Số con xúc xắc' : 'Số lần tung'}
            <input
              type="number" min={1} max={10} value={nDice}
              onChange={(e) => setNDice(parseInt(e.target.value, 10) || 1)}
              className="w-24 h-9 px-2 rounded-md border border-border bg-background font-mono text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 font-sans text-xs text-dim">
            Số lần mô phỏng
            <input
              type="number" min={100} max={50000} step={100} value={trials}
              onChange={(e) => setTrials(parseInt(e.target.value, 10) || 100)}
              className="w-28 h-9 px-2 rounded-md border border-border bg-background font-mono text-sm"
            />
          </label>
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="self-start px-5 py-2.5 rounded-lg font-sans text-sm font-bold bg-primary text-primary-fg disabled:opacity-40"
        >
          {loading ? 'Đang mô phỏng…' : 'Chạy mô phỏng'}
        </button>
      </PageCard>

      {result && !result.available && (
        <p className="font-sans text-sm text-destructive">{result.reason ?? 'Không thể mô phỏng.'}</p>
      )}

      {chartData && (
        <PageCard label="Thực nghiệm so với lý thuyết">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="label" tick={{ fill: 'var(--dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--dim)', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="empirical" fill="var(--primary)" name="Thực nghiệm" radius={[3, 3, 0, 0]} />
                <Bar dataKey="theoretical" fill="var(--foreground)" fillOpacity={0.35} name="Lý thuyết" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageCard>
      )}
    </PageShell>
  )
}
