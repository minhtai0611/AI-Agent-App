import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { analyzeErrorPatterns } from '../api/aiClient.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

const ERROR_TYPES = [
  { id: 'sign_error',        label: 'Sai dấu',         color: '#FB7185' },
  { id: 'formula_confusion', label: 'Nhầm công thức',  color: '#F2A20C' },
  { id: 'procedural_slip',   label: 'Sai quy trình',   color: '#818CF8' },
  { id: 'conceptual_gap',    label: 'Lỗ hổng khái niệm', color: '#60A5FA' },
  { id: 'calculation',       label: 'Tính toán sai',   color: '#34D399' },
]

// ── Temporal decay aggregation from local history ─────────────────────────────
function aggregateLocalErrors(results) {
  const now = Date.now()
  const WEEK_MS = 7 * 86400_000
  const λ = 0.15  // decay per week

  // topic → error_type → weighted count
  const agg = {}

  for (const r of results) {
    const weeksAgo = (now - new Date(r.timestamp || r.created_at || 0).getTime()) / WEEK_MS
    const w = Math.exp(-λ * Math.max(0, weeksAgo))
    const tb = r.topicBreakdown || {}
    for (const [topic, data] of Object.entries(tb)) {
      const wrong = (data.total || 0) - (data.correct || 0)
      if (wrong <= 0) continue
      if (!agg[topic]) agg[topic] = {}
      // Spread wrong answers across error types (unknown — no per-question type here)
      agg[topic]['procedural_slip'] = (agg[topic]['procedural_slip'] || 0) + wrong * w * 0.4
      agg[topic]['conceptual_gap']  = (agg[topic]['conceptual_gap']  || 0) + wrong * w * 0.3
      agg[topic]['calculation']     = (agg[topic]['calculation']     || 0) + wrong * w * 0.3
    }
  }

  return Object.entries(agg)
    .map(([topic, byType]) => {
      const total = Object.values(byType).reduce((s, v) => s + v, 0)
      return { topic, total, ...byType }
    })
    .filter(d => d.total > 0.1)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)
}

// ── Radar data from aggregates ────────────────────────────────────────────────
function buildRadarData(aggregates) {
  const totals = {}
  for (const d of aggregates) {
    for (const et of ERROR_TYPES) {
      totals[et.id] = (totals[et.id] || 0) + (d[et.id] || 0)
    }
  }
  const max = Math.max(...Object.values(totals), 1)
  return ERROR_TYPES.map(et => ({
    type: et.label,
    value: Math.round((totals[et.id] || 0) / max * 100),
  }))
}

// ── Topic label mapping ───────────────────────────────────────────────────────
const TOPIC_VI = {
  algebra: 'Đại số', geometry: 'Hình học', calculus: 'Giải tích',
  trigonometry: 'Lượng giác', statistics: 'Thống kê', probability: 'Xác suất',
  combinatorics: 'Tổ hợp', number_theory: 'Số học', functions_and_graphs: 'Hàm số',
}

function topicLabel(t) { return TOPIC_VI[t] || t }

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ErrorAnalysis() {
  usePageMeta('Phân tích lỗi sai', { noindex: true })
  const navigate = useNavigate()
  const { user } = useAuth()
  const { results } = useHistory()

  const [aiData, setAiData] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const localAgg = useMemo(() => aggregateLocalErrors(results || []), [results])
  const radarData = useMemo(() => buildRadarData(localAgg), [localAgg])

  // Use AI aggregates if available, otherwise use local
  const barData = aiData?.aggregates?.length
    ? aiData.aggregates.map(a => ({
        topic: a.concept_id,
        total: a.total,
        ...a.by_type,
      }))
    : localAgg

  async function fetchAI() {
    if (!user?.id) return
    setAiLoading(true)
    setAiError('')
    const { data, error } = await analyzeErrorPatterns()
    setAiLoading(false)
    if (error) {
      setAiError(typeof error === 'string' ? error : 'Không thể phân tích lúc này.')
      return
    }
    if (data) setAiData(data)
  }

  // Auto-fetch if user is logged in and has exam history
  useEffect(() => {
    if (user?.id && results?.length >= 3) fetchAI()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasMisconceptions = aiData?.misconceptions?.length > 0

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
        <button onClick={() => navigate('/exams?mode=lab')}
          className="font-jakarta text-[0.8125rem] text-dim hover:text-muted transition">
          ← Lab
        </button>
        <span className="font-fraunces text-[18px] font-bold text-foreground">Phân tích lỗi sai</span>
        {aiData?.cached && (
          <span className="px-2 py-0.5 rounded-full font-jakarta text-[0.625rem] bg-border text-faint">cache 24h</span>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-8 flex flex-col gap-8">
        {(!results || results.length < 3) ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-4xl">📊</span>
            <span className="font-fraunces text-[18px] font-bold text-foreground">Cần thêm dữ liệu</span>
            <p className="font-jakarta text-[0.8125rem] text-dim max-w-xs">Hoàn thành ít nhất 3 bài thi để xem phân tích lỗi sai.</p>
            <button onClick={() => navigate('/exams')}
              className="px-5 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold"
              style={{ background: '#F2A20C', color: '#0A0E1A' }}>
              Vào thi ngay
            </button>
          </div>
        ) : (
          <>
            {/* ── Error DNA Radar ─────────────────────────────────────────── */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="font-fraunces text-[16px] font-bold text-foreground mb-1">DNA lỗi sai</h2>
              <p className="font-jakarta text-xs text-dim mb-5">Hồ sơ loại lỗi của bạn từ toàn bộ lịch sử thi</p>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1E2A44" />
                  <PolarAngleAxis dataKey="type" tick={{ fontSize: 11, fill: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Bạn" dataKey="value" stroke="#F2A20C" fill="#F2A20C" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Heatmap bar chart ───────────────────────────────────────── */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="font-fraunces text-[16px] font-bold text-foreground mb-1">Lỗi theo chủ đề</h2>
              <p className="font-jakarta text-xs text-dim mb-5">
                Trọng số tính theo độ gần đây (lỗi gần đây nặng hơn)
              </p>
              {barData.length === 0 ? (
                <p className="font-jakarta text-[0.8125rem] text-faint text-center py-8">Chưa có dữ liệu lỗi.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2A44" vertical={false} />
                    <XAxis
                      dataKey="topic"
                      tickFormatter={topicLabel}
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={55}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #1E2A44', borderRadius: 8, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12 }}
                      labelFormatter={topicLabel}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11 }} />
                    {ERROR_TYPES.map(et => (
                      <Bar key={et.id} dataKey={et.id} name={et.label} stackId="a" fill={et.color} radius={et.id === 'calculation' ? [4, 4, 0, 0] : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── AI Misconception report ─────────────────────────────────── */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-fraunces text-[16px] font-bold text-foreground">Chẩn đoán AI</h2>
                  <p className="font-jakarta text-xs text-dim mt-0.5">Top 3 hiểu lầm cốt lõi · ⚡2 Tia</p>
                </div>
                {!hasMisconceptions && !aiLoading && (
                  <button onClick={fetchAI}
                    className="px-4 py-2 rounded-lg font-jakarta text-xs font-bold transition"
                    style={{ background: '#F2A20C', color: '#0A0E1A' }}>
                    Phân tích ngay
                  </button>
                )}
              </div>
              {aiLoading && (
                <div className="flex items-center gap-2 py-6">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="font-jakarta text-[0.8125rem] text-dim">AI đang phân tích lỗi sai của bạn...</span>
                </div>
              )}
              {aiError && <p className="font-jakarta text-xs text-red-400 py-3">{aiError}</p>}
              {hasMisconceptions && (
                <div className="flex flex-col gap-4">
                  {aiData.misconceptions.map((m, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl bg-surface-elevated border border-border">
                      <span className="text-2xl mt-0.5">{'🔍🧩🎯'[i]}</span>
                      <div className="flex flex-col gap-1">
                        <span className="font-jakarta text-[0.6875rem] font-bold text-amber-400 uppercase tracking-wide">{m.concept || `Hiểu lầm ${i + 1}`}</span>
                        <p className="font-jakarta text-[0.8125rem] text-highlight">{m.misconception}</p>
                        <p className="font-jakarta text-xs text-dim">💡 {m.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!hasMisconceptions && !aiLoading && !aiError && (
                <p className="font-jakarta text-[0.8125rem] text-faint py-4 text-center">
                  Nhấn "Phân tích ngay" để AI xác định hiểu lầm cốt lõi của bạn.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
