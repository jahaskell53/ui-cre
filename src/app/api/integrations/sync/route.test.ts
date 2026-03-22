import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockFrom, mockEnqueueEmailSync } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockEnqueueEmailSync: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/utils/sqs', () => ({
  enqueueEmailSync: mockEnqueueEmailSync,
}))

import { POST, GET } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/integrations/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function makeGetRequest() {
  return new NextRequest('http://localhost/api/integrations/sync')
}

function setupAuth(userId = 'user-1') {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })

  const mockEq2 = vi.fn().mockResolvedValue({ error: null })
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 })

  mockFrom.mockImplementation(() => ({ update: mockUpdate }))

  return { mockUpdate }
}

// ─── POST — validation ────────────────────────────────────────────────────────

describe('POST /api/integrations/sync — validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when grantId is missing', async () => {
    const res = await POST(makePostRequest({ userId: 'user-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await POST(makePostRequest({ grantId: 'grant-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when both are missing', async () => {
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })
})

// ─── POST — auth ──────────────────────────────────────────────────────────────

describe('POST /api/integrations/sync — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when getUser errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Auth error' } })
    const res = await POST(makePostRequest({ grantId: 'grant-1', userId: 'user-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makePostRequest({ grantId: 'grant-1', userId: 'user-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when userId does not match authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'other-user' } }, error: null })
    const res = await POST(makePostRequest({ grantId: 'grant-1', userId: 'user-1' }))
    expect(res.status).toBe(401)
  })
})

// ─── POST — happy path ────────────────────────────────────────────────────────

describe('POST /api/integrations/sync — happy path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks integration as syncing and enqueues job', async () => {
    const { mockUpdate } = setupAuth('user-1')
    mockEnqueueEmailSync.mockResolvedValue(undefined)

    const res = await POST(makePostRequest({ grantId: 'grant-1', userId: 'user-1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'syncing' })
    expect(mockEnqueueEmailSync).toHaveBeenCalledWith('grant-1', 'user-1')
  })

  it('returns 500 when enqueueEmailSync throws', async () => {
    setupAuth('user-1')
    mockEnqueueEmailSync.mockRejectedValue(new Error('SQS unavailable'))

    const res = await POST(makePostRequest({ grantId: 'grant-1', userId: 'user-1' }))
    expect(res.status).toBe(500)
  })
})

// ─── GET — auth ───────────────────────────────────────────────────────────────

describe('GET /api/integrations/sync — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when getUser errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Auth error' } })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })
})

// ─── GET — happy path ─────────────────────────────────────────────────────────

describe('GET /api/integrations/sync — happy path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns integrations for authenticated user', async () => {
    const integrations = [{ id: 'int-1', status: 'active' }]
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const mockEq = vi.fn().mockResolvedValue({ data: integrations, error: null })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(makeGetRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.integrations).toEqual(integrations)
  })

  it('returns 500 when DB fetch fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })
})
