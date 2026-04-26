import SchoolList from './SchoolList.jsx'

const TOPIC_LABELS = {
  algebra: 'Đại số',
  geometry: 'Hình học',
  statistics: 'Thống kê',
  combinatorics: 'Tổ hợp',
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-20 bg-[#111827] rounded-xl" />
      <div className="h-5 w-1/2 bg-[#111827] rounded" />
      <div className="flex gap-2">
        <div className="h-7 w-20 bg-[#111827] rounded-full" />
        <div className="h-7 w-24 bg-[#111827] rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-5 bg-[#111827] rounded" />
        <div className="h-5 bg-[#111827] rounded w-5/6" />
        <div className="h-5 bg-[#111827] rounded w-4/6" />
      </div>
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

export default function AIInsights({ analysis, loading, error }) {
  if (loading) return <Skeleton />

  if (!analysis) {
    return (
      <div className="flex items-center justify-center py-8 font-jakarta text-sm text-[#475569]">
        {error ? 'Phân tích AI không khả dụng — đang dùng phân tích ngoại tuyến' : 'Chưa đủ dữ liệu phân tích'}
      </div>
    )
  }

  const isAI = analysis._source === 'ai'

  // ── AI-powered view ──────────────────────────────────────────────────────
  if (isAI) {
    return (
      <div key="ai" className="flex flex-col gap-5 animate-fade-in-up">
        <span className="self-start px-2 py-0.5 rounded-full bg-[#1A2A10] border border-[#2D4A1A] font-jakarta text-[11px] text-[#10B981]">
          ✦ Claude AI
        </span>
        {analysis.insights && (
          <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{analysis.insights}</p>
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

      {recommendations && recommendations.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Trường phù hợp</span>
          <SchoolList recommendations={recommendations} />
        </div>
      )}
    </div>
  )
}
