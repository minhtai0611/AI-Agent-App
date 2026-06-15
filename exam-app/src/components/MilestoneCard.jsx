import { useNavigate } from 'react-router-dom'

const TOPIC_VI = {
  algebra: 'Đại số',
  geometry: 'Hình học',
  functions: 'Hàm số',
  statistics: 'Thống kê',
  trigonometry: 'Lượng giác',
  combinatorics: 'Tổ hợp',
  calculus: 'Giải tích',
  logarithm: 'Logarithm',
}

function getStrongest(topicBreakdown) {
  if (!topicBreakdown) return null
  return Object.entries(topicBreakdown).sort(([, a], [, b]) => (b.accuracy ?? b) - (a.accuracy ?? a))[0]?.[0]
}

function getWeakest(topicBreakdown) {
  if (!topicBreakdown) return null
  return Object.entries(topicBreakdown).sort(([, a], [, b]) => (a.accuracy ?? a) - (b.accuracy ?? b))[0]?.[0]
}

function getImprovedTopic(prev, curr) {
  if (!prev || !curr) return null
  let best = null, bestDelta = 0
  for (const topic of Object.keys(curr)) {
    const prevAcc = prev[topic]?.accuracy ?? prev[topic] ?? 0
    const currAcc = curr[topic]?.accuracy ?? curr[topic] ?? 0
    const delta = currAcc - prevAcc
    if (delta > bestDelta) { bestDelta = delta; best = { topic, delta: Math.round(delta * 100) } }
  }
  return best
}

function getMilestone(examCount, current, previous, subscriptionTier) {
  const tb = current?.topicBreakdown
  if (examCount === 1) {
    const strongest = getStrongest(tb)
    const weakest = getWeakest(tb)
    if (!strongest || !weakest) return null
    return {
      type: 'exam_1',
      message: `Zenith đã xác định: ${TOPIC_VI[strongest] ?? strongest} là điểm mạnh · ${TOPIC_VI[weakest] ?? weakest} là điểm cần cải thiện nhất`,
    }
  }
  if (examCount === 2 && previous) {
    const improved = getImprovedTopic(previous.topicBreakdown, tb)
    return {
      type: 'exam_2',
      message: improved
        ? `${TOPIC_VI[improved.topic] ?? improved.topic} cải thiện ${improved.delta}% so với lần trước 🎉`
        : 'Chưa có cải thiện rõ rệt — thử dùng Ôn sai để luyện đúng chỗ',
      showPrediction: true,
    }
  }
  if (examCount === 4) {
    return {
      type: 'exam_4',
      message: 'Bạn đã thi 4 lần — dự đoán điểm chính xác hơn đã khả dụng',
      showKalman: subscriptionTier === 'complete',
    }
  }
  return null
}

export default function MilestoneCard({ examCount, currentResult, previousResult, subscriptionTier, onViewPrediction }) {
  const navigate = useNavigate()
  const milestone = getMilestone(examCount, currentResult, previousResult, subscriptionTier)
  if (!milestone) return null

  return (
    <div data-testid="milestone-card" className="bg-surface border border-primary/20 rounded-2xl px-5 py-4 flex flex-col gap-2 mb-4">
      <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-primary">
        {milestone.type === 'exam_1' ? 'Lần đầu thi với Zenith' : milestone.type === 'exam_2' ? 'So sánh với lần trước' : 'Bạn đã thi 4 lần'}
      </span>
      <p className="font-sans text-[14px] text-foreground leading-snug">{milestone.message}</p>
      {milestone.showKalman && (
        <button
          onClick={onViewPrediction ?? (() => navigate('/account'))}
          className="font-sans text-[12px] font-semibold text-primary text-left"
        >
          Xem dự đoán điểm →
        </button>
      )}
      {milestone.showPrediction && !milestone.showKalman && (
        <p className="font-sans text-[11px] text-dim">Dự đoán sơ bộ sẽ hiện trên trang chủ sau khi đăng nhập.</p>
      )}
    </div>
  )
}
