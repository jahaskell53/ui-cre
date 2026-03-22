import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockRecalculate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRecalculate: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn(),
  }),
}))

vi.mock('@/lib/network-strength', () => ({
  recalculateNetworkStrengthForUser: mockRecalculate,
}))

import { POST } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/people/recalculate-network-strength', { method: 'POST' })
}

describe('POST /api/people/recalculate-network-strength', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('calls recalculate and returns success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRecalculate.mockResolvedValue(undefined)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockRecalculate).toHaveBeenCalledWith(expect.anything(), 'user-1')
  })

  it('returns 500 when recalculate throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRecalculate.mockRejectedValue(new Error('DB error'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })
})
