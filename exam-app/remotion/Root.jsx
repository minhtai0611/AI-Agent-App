import { Composition, registerRoot } from 'remotion'
import { ZenithDemo } from './ZenithDemo.jsx'

// Total frames: 435 at 30fps = 14.5 seconds
const TOTAL_FRAMES = 435

function RemotionRoot() {
  return (
    <Composition
      id="ZenithDemo"
      component={ZenithDemo}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1280}
      height={720}
    />
  )
}

registerRoot(RemotionRoot)
