import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import { GET } from './route'

function makeRequest(params?: Record<string, string>) {
  const u = new URL('http://localhost/api/people/network-strength')
  if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
  return new NextRequest(u.toString())
}

describe('GET /api/people/network-strength', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeRequest({ id: 'p-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when person id is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns networkStrength for a person', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const mockSingle = vi.fn().mockResolvedValue({ data: { network_strength: 'HIGH' }, error: null })
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(makeRequest({ id: 'p-1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.networkStrength).toBe('HIGH')
  })

  it('defaults to MEDIUM when network_strength is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const mockSingle = vi.fn().mockResolvedValue({ data: { network_strength: null }, error: null })
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(makeRequest({ id: 'p-1' }))
    const body = await res.json()

    expect(body.networkStrength).toBe('MEDIUM')
  })

  it('returns 404 when person not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(makeRequest({ id: 'bad-id' }))
    expect(res.status).toBe(404)
  })
})
