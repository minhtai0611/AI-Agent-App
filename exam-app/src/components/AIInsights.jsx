import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { ResultsInsightsSkeleton } from './Skeleton.jsx'
import MarkdownProse from './MarkdownProse.jsx'
import { useAuth } from '../context/AuthContext'

// Renders streaming plain text with a CSS fade-in on each newly arrived chunk.
// key={prevLen} on the new-text span forces a fresh DOM node each chunk, retriggering the animation.
function StreamingText({ text, className = '' }) {
  const prevLenRef = useRef(0)
  const prevLen = prevLenRef.current
  useEffect(() => { prevLenRef.current = text.length })
  const oldText = text.slice(0, prevLen)
  const newText = text.slice(prevLen)
  return (
    <span className={className}>
      {oldText}
      {newText && <span key={prevLen} className="word-fade">{newText}</span>}
    </span>
  )
}

function FieldSkeleton({ rows = 2 }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3.5 rounded bg-border animate-pulse" style={{ width: i === rows - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

function FieldOrSkeleton({ label, value, rows = 2 }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="font-sans text-[0.8125rem] font-semibold text-muted">{label}</span>}
      <AnimatePresence mode="wait">
        {value ? (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            {typeof value === 'string'
              ? <p className="font-sans text-[0.8125rem] text-muted leading-relaxed">{value}</p>
              : value}
          </motion.div>
        ) : (
          <motion.div key="skel" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <FieldSkeleton rows={rows} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TipList({ label, items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-sans text-[0.8125rem] font-semibold text-muted">{label}</span>
      <div className="flex flex-col gap-2.5">
        {items.map((tip, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-[10px] glass-base flex items-center justify-center">
              <span className="font-sans text-[0.625rem] font-semibold text-muted">{i + 1}</span>
            </div>
            <p className="font-sans text-[0.8125rem] text-muted leading-relaxed">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SchoolSection({ schoolInsight, schools, score }) {
  if (!schoolInsight && (!schools || schools.length === 0)) return null
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[0.8125rem] font-semibold text-muted">Trường phù hợp</span>
        {score !== undefined && (
          <span className="font-sans text-[0.6875rem] text-faint">
            Điểm Toán: <span className="text-primary font-bold">{score}/10</span>
          </span>
        )}
      </div>
      {schoolInsight && (
        <p className="font-sans text-[0.8125rem] text-muted leading-relaxed" style={{ overflowWrap: 'break-word', hyphens: 'none' }}>
          {schoolInsight}
        </p>
      )}
      {schools && schools.length > 0 && (
        <div className="flex flex-col gap-2">
          {schools.map((s, i) => (
            <div key={i} className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-surface-elevated border border-border">
              <span className="font-sans text-[0.8125rem] font-semibold text-foreground">{s.name}</span>
              <span className="font-sans text-xs text-dim">{s.score_range} · {s.type}</span>
              {s.note && <span className="font-sans text-xs text-muted">{s.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AIErrorMessage({ error }) {
  const navigate = useNavigate()
  if (!error) return null

  // 402 insufficient_credits is handled inline in AIInsights — skip here
  if (typeof error === 'object' && (error.code === 'insufficient_credits' || error.status === 402)) {
    return null
  }

  // 403 tier_required
  if (typeof error === 'object' && error.code === 'tier_required') {
    return (
      <div className="flex flex-col gap-3 py-4 items-center text-center">
        <span className="font-sans text-[0.8125rem] text-muted">{error.message || 'Cần nâng cấp gói để sử dụng tính năng này.'}</span>
        <button
          onClick={() => navigate('/account')}
          className="px-5 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-background"
        >
          Nâng cấp
        </button>
      </div>
    )
  }

  // Generic string error
  const msg = typeof error === 'string' ? error : 'Phân tích AI không khả dụng — đang dùng phân tích ngoại tuyến'
  return (
    <div className="flex items-center justify-center py-8 font-sans text-sm text-faint">{msg}</div>
  )
}

export default function AIInsights({ analysis, loading, error, score, onRetry }) {
  const { user } = useAuth()
  const [dismissed402, setDismissed402] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const [showFullAnalysis, setShowFullAnalysis] = useState(false)

  const insights = analysis?.insights

  useEffect(() => {
    if (insights && !error && user?.subscription_tier === 'basic' && user?.id) {
      const seen = localStorage.getItem(`upgrade_nudge_seen_${user.id}`)
      if (!seen) setShowNudge(true)
    }
  }, [insights, error, user])

  function dismissNudge() {
    if (user?.id) localStorage.setItem(`upgrade_nudge_seen_${user.id}`, 'true')
    setShowNudge(false)
  }

  if (loading && !analysis?._streaming) return <ResultsInsightsSkeleton />

  // Inline 402 — soft block (no modal), dismissible
  if ((error?.status === 402 || (typeof error === 'object' && error?.code === 'insufficient_credits')) && !dismissed402) {
    return (
      <div data-testid="credits-exhausted-inline" className="flex flex-col gap-3 p-4 bg-surface border border-border rounded-xl">
        <p className="font-sans text-[13px] text-foreground">
          Bạn đã dùng hết lượt hỏi AI.
        </p>
        <p className="font-sans text-[12px] text-dim">
          Nạp thêm lượt để tiếp tục xem phân tích bài thi của bạn.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = '/account'}
            className="font-sans text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-background"
            data-testid="top-up-cta"
          >
            Nạp ngay
          </button>
          <button
            onClick={() => setDismissed402(true)}
            className="font-sans text-[12px] text-dim px-3 py-1.5"
            data-testid="dismiss-402"
          >
            Để sau
          </button>
        </div>
      </div>
    )
  }

  // Streaming in-progress — field-level skeleton → crossfade to content
  if (analysis?._streaming && !analysis?._streaming_done && !error) {
    return (
      <div className="flex flex-col gap-5">
        {/* insights — word-level fade + static stream cursor */}
        <FieldOrSkeleton value={
          analysis.insights
            ? <p className="font-sans text-[0.8125rem] text-muted leading-relaxed">
                <StreamingText text={analysis.insights} />
                <span className="stream-cursor opacity-70 ml-0.5">|</span>
              </p>
            : null
        } rows={3} />
        {/* question_analysis — word-level fade */}
        <FieldOrSkeleton label="Phân tích câu trả lời" value={
          analysis.question_analysis
            ? <p className="font-sans text-[0.8125rem] text-muted leading-relaxed">
                <StreamingText text={analysis.question_analysis} />
              </p>
            : null
        } rows={2} />
        {/* weak_topics */}
        <FieldOrSkeleton label="Chủ đề cần cải thiện" value={
          Array.isArray(analysis.weak_topics) && analysis.weak_topics.length > 0
            ? <div className="flex flex-wrap gap-2">{analysis.weak_topics.map(t => (
                <span key={t} className="px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded-full font-sans text-xs text-destructive">
                  {TOPIC_LABELS[t] ?? t}
                </span>))}</div>
            : null
        } rows={1} />
        {/* recommendations — word-level fade on last item (actively streaming) */}
        <FieldOrSkeleton label="Khuyến nghị từ AI" value={
          analysis.recommendations?.length
            ? <div className="flex flex-col gap-2">{analysis.recommendations.map((r, i, arr) => (
                <p key={i} className="font-sans text-[0.8125rem] text-muted leading-relaxed">
                  {'• '}
                  {i === arr.length - 1
                    ? <StreamingText text={r} />
                    : r}
                </p>))}</div>
            : null
        } rows={2} />
      </div>
    )
  }

  if (!analysis) {
    return <AIErrorMessage error={error || 'Chưa đủ dữ liệu phân tích'} />
  }

  const isAI = analysis._source === 'ai'

  // ── AI-powered view ──────────────────────────────────────────────────────
  if (isAI) {
    // Show only first sentence of insights until expanded
    const insightsFull = analysis.insights ?? ''
    const firstSentenceEnd = insightsFull.search(/[.!?]\s/) + 1
    const insightsPreview = firstSentenceEnd > 0 ? insightsFull.slice(0, firstSentenceEnd) : insightsFull
    const hasMore = insightsFull.length > insightsPreview.length || !!analysis.question_analysis

    return (
      <div key="ai" className="flex flex-col gap-5">
        {insightsFull && (
          <div className="flex flex-col gap-1.5">
            <p className="font-sans text-[0.8125rem] text-muted leading-relaxed">
              {showFullAnalysis ? insightsFull : insightsPreview}
            </p>
            {hasMore && (
              <button
                onClick={() => setShowFullAnalysis(s => !s)}
                className="font-sans text-[0.75rem] text-dim hover:text-muted transition self-start"
              >
                {showFullAnalysis ? '↑ Thu gọn' : '↓ Xem phân tích đầy đủ'}
              </button>
            )}
          </div>
        )}
        {showFullAnalysis && analysis.question_analysis && (
          <div className="flex flex-col gap-2">
            <span className="font-sans text-[0.8125rem] font-semibold text-muted">Phân tích câu trả lời</span>
            <p className="font-sans text-[0.8125rem] text-muted leading-relaxed">{analysis.question_analysis}</p>
          </div>
        )}
        {Array.isArray(analysis.weak_topics) && analysis.weak_topics.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="font-sans text-[0.8125rem] font-semibold text-muted">Chủ đề cần cải thiện</span>
            <div className="flex flex-wrap gap-2">
              {analysis.weak_topics.map(t => (
                <span key={t} className="px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded-full font-sans text-xs text-destructive">
                  {TOPIC_LABELS[t] ?? t}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Concept prerequisite gap chain */}
        {Array.isArray(analysis.concept_gaps) && analysis.concept_gaps.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="font-sans text-[0.8125rem] font-semibold text-muted">Lộ trình kiến thức cần bổ sung</span>
            <div className="flex flex-col gap-0 rounded-xl border border-surface overflow-hidden">
              {analysis.concept_gaps.map((c, i) => {
                const TOPIC_COLORS_MAP = {
                  algebra: '#6366F1', geometry: '#10B981', calculus: '#F59E0B',
                  probability: '#EC4899', statistics: '#3B82F6', trigonometry: '#8B5CF6',
                }
                const color = TOPIC_COLORS_MAP[c.topic] || '#64748B'
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{ borderBottom: i < analysis.concept_gaps.length - 1 ? '1px solid var(--border)' : 'none', background: c.is_target ? 'color-mix(in srgb, var(--surface) 85%, transparent)' : 'transparent' }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.is_target ? color : '#334155', border: `1.5px solid ${color}` }} />
                    <span className="font-sans text-[12px] flex-1" style={{ color: c.is_target ? '#F0F4FF' : '#64748B' }}>
                      {c.name_vi}
                    </span>
                    <span className="font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${color}22`, color }}>
                      Lớp {c.grade}
                    </span>
                    {c.is_target && (
                      <span className="font-sans text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">Yếu</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <TipList label="Khuyến nghị từ AI" items={analysis.recommendations} />
        <SchoolSection schoolInsight={analysis.school_insight} schools={analysis.schools} score={score} />
        {showNudge && (
          <div data-testid="upgrade-nudge" className="mt-3 p-3 bg-surface border border-border rounded-xl flex flex-col gap-2">
            <p className="font-sans text-[12px] text-foreground">
              Bạn vừa dùng 3 lượt hỏi AI. Gói Học sinh (29k/tháng) = lượt không giới hạn cả tháng.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { dismissNudge(); window.location.href = '/account' }}
                className="font-sans text-[11px] font-semibold text-primary"
                data-testid="nudge-upgrade-cta"
              >
                Xem gói Học sinh →
              </button>
              <button onClick={dismissNudge} className="font-sans text-[11px] text-dim">
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Local (offline) view ─────────────────────────────────────────────────
  const { predictedScoreRange, percentile, weakTopics, recommendations, improvementStrategy } = analysis

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="flex flex-col gap-1.5">
          <span className="self-start px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 font-sans text-[0.6875rem] text-primary/80">
            Ngoại tuyến
          </span>
          {typeof error === 'string' && (
            <p className="font-sans text-[0.75rem] text-muted leading-snug">{error}</p>
          )}
          {onRetry && (
            <button onClick={onRetry} className="self-start font-sans text-[0.75rem] text-primary hover:underline">
              Thử lại
            </button>
          )}
        </div>
      )}

      {predictedScoreRange && (
        <div className="flex items-center justify-between bg-surface-elevated border border-border rounded-xl p-5">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-muted">Dự đoán điểm số kỳ thi thật</span>
            <span className="font-sans font-bold text-[28px] text-[var(--primary)]">
              {predictedScoreRange[0]} – {predictedScoreRange[1]}
            </span>
            {percentile !== undefined && (
              <span className="font-sans text-[0.6875rem] text-faint">
                Top {100 - percentile}% trong lịch sử của bạn
              </span>
            )}
          </div>
          <div className="px-3 py-2 glass-base border-success/20 rounded-lg flex-shrink-0">
            <span className="font-sans text-xs font-bold text-success">Tốt</span>
          </div>
        </div>
      )}

      {weakTopics && weakTopics.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="font-sans text-[0.8125rem] font-semibold text-muted">Chủ đề cần cải thiện</span>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(t => (
              <span key={t} className="px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded-full font-sans text-xs text-destructive">
                {TOPIC_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        </div>
      )}

      <TipList label="Kế hoạch cải thiện" items={improvementStrategy} />

      {/* Offline mode: no AI school suggestions available */}
    </div>
  )
}
