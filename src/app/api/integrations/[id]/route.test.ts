import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockFrom, mockRevokeGrant } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockRevokeGrant: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/nylas/client', () => ({
  revokeGrant: mockRevokeGrant,
}))

import { DELETE } from './route'

function makeDelete(id: string) {
  return new NextRequest(`http://localhost/api/integrations/${id}`, { method: 'DELETE' })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function authAs(userId = 'user-1') {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
}

function noAuth() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
}

describe('DELETE /api/integrations/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    noAuth()
    const res = await DELETE(makeDelete('integ-1'), params('integ-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when integration not found', async () => {
    authAs()
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await DELETE(makeDelete('bad-id'), params('bad-id'))
    expect(res.status).toBe(404)
  })

  it('revokes grant and deletes integration on success', async () => {
    authAs()
    const integration = { id: 'integ-1', nylas_grant_id: 'grant-abc', user_id: 'user-1' }
    const mockSingle = vi.fn().mockResolvedValue({ data: integration, error: null })
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })

    const mockDeleteEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq1 })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return { select: mockSelect }
      return { delete: mockDelete }
    })
    mockRevokeGrant.mockResolvedValue(undefined)

    const res = await DELETE(makeDelete('integ-1'), params('integ-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockRevokeGrant).toHaveBeenCalledWith('grant-abc')
  })

  it('returns 500 when delete fails', async () => {
    authAs()
    const integration = { id: 'integ-1', nylas_grant_id: 'grant-abc', user_id: 'user-1' }
    const mockSingle = vi.fn().mockResolvedValue({ data: integration, error: null })
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })

    const mockDeleteEq2 = vi.fn().mockResolvedValue({ error: { message: 'delete failed' } })
    const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq1 })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return { select: mockSelect }
      return { delete: mockDelete }
    })
    mockRevokeGrant.mockResolvedValue(undefined)

    const res = await DELETE(makeDelete('integ-1'), params('integ-1'))
    expect(res.status).toBe(500)
  })
})
