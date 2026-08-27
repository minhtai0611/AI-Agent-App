// Maps a validated VisualizationSpec's `template` to its scene module — must stay in
// lockstep with backend/app/agent/visualization_schema.py's discriminated union.
// Scene3DLazy's `scene` prop expects `() => Promise<{default: Component}>`, so each
// entry here is a dynamic import, not the component itself.
export const CONCEPT_SCENE_REGISTRY = {
  pyramid: () => import('./PyramidScene.jsx'),
  prism: () => import('./PrismScene.jsx'),
  sphere_cone: () => import('./SphereConeScene.jsx'),
  conic_section: () => import('./ConicSectionScene.jsx'),
  vector_add: () => import('./VectorAdditionScene.jsx'),
  function_surface: () => import('./FunctionSurfaceScene.jsx'),
  solid_of_revolution: () => import('./SolidOfRevolutionScene.jsx'),
}

export function resolveConceptScene(template) {
  return CONCEPT_SCENE_REGISTRY[template] ?? null
}
