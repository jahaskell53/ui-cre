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

import { GET, PUT } from './route'

function makePut(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/news/preferences', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

function authAs(userId = 'user-1', email = 'user@example.com') {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId, email } }, error: null })
}

function noAuth() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/news/preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    noAuth()
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns preferences without location data when no subscriber_id', async () => {
    authAs()
    const profile = {
      newsletter_active: true,
      newsletter_interests: ['multifamily'],
      newsletter_timezone: 'America/New_York',
      newsletter_preferred_send_times: ['08:00'],
      newsletter_subscribed_at: '2026-01-01',
      subscriber_id: null,
    }
    const mockSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.newsletter_active).toBe(true)
    expect(body.counties).toEqual([])
    expect(body.cities).toEqual([])
  })

  it('returns 500 on DB error', async () => {
    authAs()
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('fetches counties and cities when subscriber_id is present', async () => {
    authAs()
    const profile = {
      newsletter_active: true,
      newsletter_interests: [],
      newsletter_timezone: 'America/New_York',
      newsletter_preferred_send_times: [],
      newsletter_subscribed_at: null,
      subscriber_id: 'sub-1',
    }

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      callCount++
      if (callCount === 1) {
        // profiles
        const mockSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
        return { select: vi.fn().mockReturnValue({ eq: mockEq }) }
      }
      if (table === 'subscriber_counties') {
        const mockEq = vi.fn().mockResolvedValue({ data: [{ counties: { name: 'Suffolk' } }] })
        return { select: vi.fn().mockReturnValue({ eq: mockEq }) }
      }
      if (table === 'subscriber_cities') {
        const mockEq = vi.fn().mockResolvedValue({
          data: [{ cities: { name: 'Boston', state: 'Massachusetts', state_abbr: 'MA' } }],
        })
        return { select: vi.fn().mockReturnValue({ eq: mockEq }) }
      }
      return {}
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.counties).toEqual(['Suffolk'])
    expect(body.cities[0].name).toBe('Boston')
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/news/preferences — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    noAuth()
    const res = await PUT(makePut({ newsletter_active: true }))
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/news/preferences — existing subscriber', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates profile and subscriber when subscriber_id exists', async () => {
    authAs()
    const mockProfileUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mockSubscriberUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      callCount++
      if (callCount === 1) {
        // get current profile
        const mockSingle = vi.fn().mockResolvedValue({
          data: { subscriber_id: 'sub-1', full_name: 'Alice' },
        })
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
        return { select: vi.fn().mockReturnValue({ eq: mockEq }) }
      }
      if (table === 'profiles') return { update: mockProfileUpdate }
      if (table === 'subscribers') return { update: mockSubscriberUpdate }
      // subscriber_counties delete
      if (table === 'subscriber_counties') {
        return { delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
      return {}
    })

    const res = await PUT(
      makePut({ newsletter_active: true, newsletter_timezone: 'America/New_York' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 500 when profile update fails', async () => {
    authAs()

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const mockSingle = vi.fn().mockResolvedValue({
          data: { subscriber_id: null, full_name: 'Alice' },
        })
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
        return { select: vi.fn().mockReturnValue({ eq: mockEq }) }
      }
      // profiles update
      return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: 'fail' } }) }) }
    })

    const res = await PUT(makePut({ newsletter_active: false }))
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/news/preferences — new subscriber creation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates subscriber when enabling newsletter with no existing subscriber', async () => {
    authAs('user-1', 'alice@example.com')

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      callCount++
      if (callCount === 1) {
        // get current profile — no subscriber_id
        const mockSingle = vi.fn().mockResolvedValue({
          data: { subscriber_id: null, full_name: 'Alice' },
        })
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
        return { select: vi.fn().mockReturnValue({ eq: mockEq }) }
      }
      if (table === 'subscribers' && callCount === 2) {
        // check existing subscriber — none found
        const mockSingle = vi.fn().mockResolvedValue({ data: null })
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
        return { select: vi.fn().mockReturnValue({ eq: mockEq }) }
      }
      if (table === 'subscribers' && callCount === 3) {
        // insert new subscriber
        const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'new-sub-1' }, error: null })
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
        return { insert: vi.fn().mockReturnValue({ select: mockSelect }) }
      }
      if (table === 'profiles') {
        // update profile
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
      if (table === 'subscribers') {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
      return {}
    })

    const res = await PUT(makePut({ newsletter_active: true }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
