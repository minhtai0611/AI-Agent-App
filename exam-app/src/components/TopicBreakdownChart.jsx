import { TOPIC_LABELS } from '../utils/topicLabels.js'

const TOPIC_COLORS = {
  algebra: '#10B981',
  geometry: '#FBBF24',
  statistics: '#FB7185',
  combinatorics: '#10B981',
}

function barColor(accuracy) {
  if (accuracy >= 0.7) return '#10B981'
  if (accuracy >= 0.5) return '#FBBF24'
  return '#FB7185'
}

export default function TopicBreakdownChart({ topicBreakdown }) {
  const entries = Object.entries(topicBreakdown)
  const maxAcc = Math.max(...entries.map(([, tb]) => tb.accuracy), 0.01)

  return (
    <div className="flex items-end gap-5 h-[120px] px-1">
      {entries.map(([topic, tb]) => {
        const color = TOPIC_COLORS[topic] ?? barColor(tb.accuracy)
        const heightPct = (tb.accuracy / maxAcc) * 100
        return (
          <div key={topic} className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end">
            <div
              className="w-full rounded-t-[4px] transition-all"
              style={{ height: `${heightPct}%`, background: color }}
            />
            <span className="font-jakarta text-[0.625rem] text-faint text-center">
              {TOPIC_LABELS[topic] ?? topic}
            </span>
          </div>
        )
      })}
    </div>
  )
}
