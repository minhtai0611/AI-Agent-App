import SchoolList from './SchoolList.jsx'

const TOPIC_LABELS = {
  algebra: 'Đại số',
  geometry: 'Hình học',
  statistics: 'Thống kê',
  combinatorics: 'Tổ hợp',
}

export default function AIInsights({ analysis }) {
  if (!analysis) {
    return (
      <div className="flex items-center justify-center py-8 font-jakarta text-sm text-[#475569]">
        Chưa đủ dữ liệu phân tích
      </div>
    )
  }

  const { predictedScoreRange, percentile, weakTopics, recommendations, improvementStrategy } = analysis

  return (
    <div className="flex flex-col gap-5">
      {/* Prediction card */}
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

      {/* Weak topics */}
      {weakTopics.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Chủ đề cần cải thiện</span>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(t => (
              <span
                key={t}
                className="px-3 py-1.5 bg-[#2A0F14] border border-[#5A1A24] rounded-full font-jakarta text-[12px] text-[#FB7185]"
              >
                {TOPIC_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strategy */}
      {improvementStrategy.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Kế hoạch cải thiện</span>
          <div className="flex flex-col gap-2.5">
            {improvementStrategy.map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-[10px] bg-[#1A2A40] flex items-center justify-center">
                  <span className="font-jakarta text-[10px] font-semibold text-[#94A3B8]">{i + 1}</span>
                </div>
                <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* School recommendations */}
      <div className="flex flex-col gap-2.5">
        <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Trường phù hợp</span>
        <SchoolList recommendations={recommendations} />
      </div>
    </div>
  )
}
