import { describe, it, expect } from 'vitest'
import { describeAgentFetchError } from '../agentError.js'

function fakeResponse(status) {
  return { status }
}

describe('describeAgentFetchError', () => {
  it('gives a student-facing message for 503 without leaking the internal config detail', async () => {
    const msg = await describeAgentFetchError(fakeResponse(503))
    expect(msg).toMatch(/không khả dụng/)
    expect(msg).not.toMatch(/ai_router_base_url/)
  })

  it('gives a generic message for other 4xx statuses', async () => {
    expect(await describeAgentFetchError(fakeResponse(422))).toBe('Yêu cầu không hợp lệ.')
    expect(await describeAgentFetchError(fakeResponse(404))).toBe('Yêu cầu không hợp lệ.')
  })

  it('includes the status code for other 5xx statuses', async () => {
    expect(await describeAgentFetchError(fakeResponse(500))).toContain('500')
  })
})
