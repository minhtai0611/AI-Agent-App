// Shared by the Pure Math Toolset pages' page-local agent-fetch helpers (MathPlayground,
// LinearAlgebraWorkspace, ProbabilitySimulator, CasCalculator) — turns a failed /agent/*
// response into a message a student can actually act on, instead of a bare "HTTP 503".
// The raw `detail` FastAPI sends back (e.g. "ai_router_base_url is not set — configure it
// before calling the agent endpoints") is an operator-facing string, not something to show
// a student, so it's deliberately not surfaced here.
export async function describeAgentFetchError(res) {
  if (res.status === 503) {
    return 'Dịch vụ AI hiện không khả dụng (chưa cấu hình hoặc đang bảo trì phía máy chủ). Vui lòng thử lại sau.'
  }
  if (res.status >= 400 && res.status < 500) {
    return 'Yêu cầu không hợp lệ.'
  }
  return `Máy chủ gặp sự cố (HTTP ${res.status}). Vui lòng thử lại sau.`
}
