/**
 * Remotion render script — produces public/landing-demo.mp4
 *
 * Usage:
 *   node remotion/render.mjs
 *   # or via npm:
 *   npm run render:video
 *
 * The output is committed to public/ so it's served statically.
 * Re-run whenever scenes are updated.
 */

import { bundle }       from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path             from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)

const entryPoint  = path.join(__dirname, 'Root.jsx')
const outputFile  = path.join(__dirname, '..', 'public', 'landing-demo.mp4')

console.log('🎬 Bundling Remotion composition...')
const bundled = await bundle({
  entryPoint,
  // Inject webpackOverride for JSX if needed
})

console.log('🎯 Selecting ZenithDemo composition...')
const compositions = await selectComposition({
  serveUrl: bundled,
  id: 'ZenithDemo',
  inputProps: {},
})

console.log(`🚀 Rendering ${compositions.durationInFrames} frames at ${compositions.fps}fps → ${outputFile}`)
await renderMedia({
  composition: compositions,
  serveUrl: bundled,
  codec: 'h264',
  outputLocation: outputFile,
  onProgress: ({ progress }) => {
    const pct = Math.round(progress * 100)
    if (pct % 10 === 0) process.stdout.write(`  ${pct}%...\n`)
  },
})

console.log(`✅ Video rendered → public/landing-demo.mp4`)
