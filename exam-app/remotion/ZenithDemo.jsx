import { AbsoluteFill, Series } from 'remotion'
import { FadeTransition, SceneLabel } from './Transition.jsx'
import { Scene1_ExamSelect }  from './scenes/Scene1_ExamSelect.jsx'
import { Scene2_TakeExam }    from './scenes/Scene2_TakeExam.jsx'
import { Scene3_AIAnalysis }  from './scenes/Scene3_AIAnalysis.jsx'
import { Scene4_ConceptMap }  from './scenes/Scene4_ConceptMap.jsx'
import { Scene5_GenerateExam } from './scenes/Scene5_GenerateExam.jsx'

// Scene durations in frames at 30fps
const S1 = 75   // 2.5s  — Exam select
const S2 = 90   // 3.0s  — Taking exam
const S3 = 90   // 3.0s  — AI analysis
const S4 = 90   // 3.0s  — Concept map
const S5 = 90   // 3.0s  — Generate exam
// Total: 435 frames = 14.5s

const SCENES = [
  { component: Scene1_ExamSelect,  dur: S1, label: 'Chọn đề thi', icon: '📋' },
  { component: Scene2_TakeExam,    dur: S2, label: 'Làm bài',      icon: '✏️' },
  { component: Scene3_AIAnalysis,  dur: S3, label: 'Phân tích AI', icon: '🎯' },
  { component: Scene4_ConceptMap,  dur: S4, label: 'Bản đồ học',   icon: '🗺' },
  { component: Scene5_GenerateExam,dur: S5, label: 'Tạo đề AI',    icon: '✦' },
]

export function ZenithDemo() {
  return (
    <AbsoluteFill>
      <Series>
        {SCENES.map(({ component: Comp, dur, label, icon }, i) => (
          <Series.Sequence key={i} durationInFrames={dur}>
            <AbsoluteFill style={{ position: 'relative' }}>
              <FadeTransition totalFrames={dur}>
                <Comp />
              </FadeTransition>
              <AbsoluteFill style={{ pointerEvents: 'none' }}>
                {/* Scene label overlay */}
                <SceneLabel label={label} icon={icon} />
              </AbsoluteFill>
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  )
}
