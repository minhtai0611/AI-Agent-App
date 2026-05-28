import { useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { ResultsInsightsSkeleton } from './Skeleton.jsx'
import MarkdownProse from './MarkdownProse.jsx'

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
        <div key={i} className="h-3.5 rounded bg-[#1E2A44] animate-pulse" style={{ width: i === rows - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

function FieldOrSkeleton({ label, value, rows = 2 }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">{label}</span>}
      <AnimatePresence mode="wait">
        {value ? (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            {typeof value === 'string'
              ? <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{value}</p>
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
      <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">{label}</span>
      <div className="flex flex-col gap-2.5">
        {items.map((tip, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-[10px] bg-[#1A2A40] flex items-center justify-center">
              <span className="font-jakarta text-[10px] font-semibold text-[#94A3B8]">{i + 1}</span>
            </div>
            <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SchoolSection({ schoolInsight, schools, score }) {
  if (!schoolInsight && (!schools || schools.length === 0)) return null
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-[#1E2A44]">
      <div className="flex items-center justify-between">
        <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Trường phù hợp</span>
        {score !== undefined && (
          <span className="font-jakarta text-[11px] text-[#475569]">
            Điểm Toán: <span className="text-[#F2A20C] font-bold">{score}/10</span>
          </span>
        )}
      </div>
      {schoolInsight && (
        <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed" style={{ overflowWrap: 'break-word', hyphens: 'none' }}>
          {schoolInsight}
        </p>
      )}
    </div>
  )
}

function AIErrorMessage({ error }) {
  const navigate = useNavigate()
  if (!error) return null

  // Structured 402 insufficient_credits
  if (typeof error === 'object' && error.code === 'insufficient_credits') {
    return (
      <div className="flex flex-col gap-3 py-4 items-center text-center">
        <span className="font-jakarta text-[13px] text-[#94A3B8]">
          Hết Tia — còn <strong className="text-amber-400">{error.balance}</strong> Tia, cần <strong>{error.required}</strong>.
        </span>
        <button
          onClick={() => navigate('/account#topup')}
          className="px-5 py-2 rounded-lg font-jakarta text-[12px] font-bold"
          style={{ background: '#F2A20C', color: '#0A0E1A' }}
        >
          Mua top-up
        </button>
      </div>
    )
  }

  // 403 tier_required
  if (typeof error === 'object' && error.code === 'tier_required') {
    return (
      <div className="flex flex-col gap-3 py-4 items-center text-center">
        <span className="font-jakarta text-[13px] text-[#94A3B8]">{error.message || 'Cần nâng cấp gói để sử dụng tính năng này.'}</span>
        <button
          onClick={() => navigate('/account')}
          className="px-5 py-2 rounded-lg font-jakarta text-[12px] font-bold"
          style={{ background: '#F2A20C', color: '#0A0E1A' }}
        >
          Nâng cấp
        </button>
      </div>
    )
  }

  // Generic string error
  const msg = typeof error === 'string' ? error : 'Phân tích AI không khả dụng — đang dùng phân tích ngoại tuyến'
  return (
    <div className="flex items-center justify-center py-8 font-jakarta text-sm text-[#475569]">{msg}</div>
  )
}

export default function AIInsights({ analysis, loading, error, score }) {
  if (loading && !analysis?._streaming) return <ResultsInsightsSkeleton />

  // Streaming in-progress — field-level skeleton → crossfade to content
  if (analysis?._streaming && !analysis?._streaming_done && !error) {
    return (
      <div className="flex flex-col gap-5">
        {/* insights — word-level fade + static stream cursor */}
        <FieldOrSkeleton value={
          analysis.insights
            ? <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">
                <StreamingText text={analysis.insights} />
                <span className="stream-cursor opacity-70 ml-0.5">|</span>
              </p>
            : null
        } rows={3} />
        {/* question_analysis — word-level fade */}
        <FieldOrSkeleton label="Phân tích câu trả lời" value={
          analysis.question_analysis
            ? <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">
                <StreamingText text={analysis.question_analysis} />
              </p>
            : null
        } rows={2} />
        {/* weak_topics */}
        <FieldOrSkeleton label="Chủ đề cần cải thiện" value={
          analysis.weak_topics?.length
            ? <div className="flex flex-wrap gap-2">{analysis.weak_topics.map(t => (
                <span key={t} className="px-3 py-1.5 bg-[#2A0F14] border border-[#5A1A24] rounded-full font-jakarta text-[12px] text-[#FB7185]">
                  {TOPIC_LABELS[t] ?? t}
                </span>))}</div>
            : null
        } rows={1} />
        {/* recommendations — word-level fade on last item (actively streaming) */}
        <FieldOrSkeleton label="Khuyến nghị từ AI" value={
          analysis.recommendations?.length
            ? <div className="flex flex-col gap-2">{analysis.recommendations.map((r, i, arr) => (
                <p key={i} className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">
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
    return (
      <div key="ai" className="flex flex-col gap-5">
        {analysis.insights && (
          <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{analysis.insights}</p>
        )}
        {analysis.question_analysis && (
          <div className="flex flex-col gap-2">
            <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Phân tích câu trả lời</span>
            <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{analysis.question_analysis}</p>
          </div>
        )}
        {analysis.weak_topics && analysis.weak_topics.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Chủ đề cần cải thiện</span>
            <div className="flex flex-wrap gap-2">
              {analysis.weak_topics.map(t => (
                <span key={t} className="px-3 py-1.5 bg-[#2A0F14] border border-[#5A1A24] rounded-full font-jakarta text-[12px] text-[#FB7185]">
                  {TOPIC_LABELS[t] ?? t}
                </span>
              ))}
            </div>
          </div>
        )}
        <TipList label="Khuyến nghị từ AI" items={analysis.recommendations} />
      </div>
    )
  }

  // ── Local (offline) view ─────────────────────────────────────────────────
  const { predictedScoreRange, percentile, weakTopics, recommendations, improvementStrategy } = analysis

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <span className="self-start px-2 py-0.5 rounded-full bg-[#1F1A0A] border border-[#4A3A1A] font-jakarta text-[11px] text-[#FBBF24]">
          Ngoại tuyến
        </span>
      )}

      {predictedScoreRange && (
        <div className="flex items-center justify-between bg-[#111827] border border-[#2A3A60] rounded-xl p-5">
          <div className="flex flex-col gap-1">
            <span className="font-jakarta text-[12px] text-[#94A3B8]">Dự đoán điểm số kỳ thi thật</span>
            <span className="font-fraunces text-[28px] font-bold text-[#F2A20C]">
              {predictedScoreRange[0]} – {predictedScoreRange[1]}
            </span>
            {percentile !== undefined && (
              <span className="font-jakarta text-[11px] text-[#475569]">
                Top {100 - percentile}% trong lịch sử của bạn
              </span>
            )}
          </div>
          <div className="px-3 py-2 bg-[#1A2A10] border border-[#2D4A1A] rounded-lg flex-shrink-0">
            <span className="font-jakarta text-[12px] font-bold text-[#10B981]">Tốt</span>
          </div>
        </div>
      )}

      {weakTopics && weakTopics.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Chủ đề cần cải thiện</span>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(t => (
              <span key={t} className="px-3 py-1.5 bg-[#2A0F14] border border-[#5A1A24] rounded-full font-jakarta text-[12px] text-[#FB7185]">
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
