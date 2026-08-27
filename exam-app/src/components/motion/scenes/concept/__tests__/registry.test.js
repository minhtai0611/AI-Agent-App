import { describe, it, expect } from 'vitest'
import { CONCEPT_SCENE_REGISTRY, resolveConceptScene } from '../registry.js'

// Must match backend/app/agent/visualization_schema.py's VisualizationSpec union exactly —
// a mismatch here means the backend can emit a template the frontend can't render.
const EXPECTED_TEMPLATES = [
  'pyramid', 'prism', 'sphere_cone', 'conic_section', 'vector_add', 'function_surface', 'solid_of_revolution',
]

describe('CONCEPT_SCENE_REGISTRY', () => {
  it('has exactly the templates the backend schema defines', () => {
    expect(Object.keys(CONCEPT_SCENE_REGISTRY).sort()).toEqual([...EXPECTED_TEMPLATES].sort())
  })

  it.each(EXPECTED_TEMPLATES)('resolves a loader for template "%s" that yields a default export', async (template) => {
    const loader = resolveConceptScene(template)
    expect(typeof loader).toBe('function')
    const mod = await loader()
    expect(typeof mod.default).toBe('function')
  })

  it('returns null for an unknown template instead of throwing', () => {
    expect(resolveConceptScene('not_a_real_template')).toBeNull()
  })
})
