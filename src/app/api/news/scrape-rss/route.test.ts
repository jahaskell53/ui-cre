import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetRssFeeds, mockFrom } = vi.hoisted(() => ({
  mockGetRssFeeds: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/news/news-sources', () => ({
  getRssFeeds: mockGetRssFeeds,
  sanitizeImageUrl: vi.fn((url: string) => url || ''),
}))

vi.mock('@/lib/news/counties', () => ({
  getCountyIds: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

// Mock rss-parser so no real network calls are made
vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(function() {
    return { parseURL: vi.fn().mockResolvedValue({ items: [] }) }
  }),
}))

import { GET } from './route'

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/news/scrape-rss', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/news/scrape-rss — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('returns 401 when CRON_SECRET is set and header is missing', async () => {
    process.env.CRON_SECRET = 'secret'
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when auth header is wrong', async () => {
    process.env.CRON_SECRET = 'secret'
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/news/scrape-rss — processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'secret'

    // Default supabase mock: sources select + single for source name lookup
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert })
  })

  it('returns ok:true with 0 loaded when no RSS feeds configured', async () => {
    mockGetRssFeeds.mockResolvedValue([])

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.results.rss.loaded).toBe(0)
  })

  it('returns ok:true even when RSS feed fetch fails', async () => {
    mockGetRssFeeds.mockRejectedValue(new Error('network error'))

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.results.rss.loaded).toBe(0)
  })

  it('includes timings in response', async () => {
    mockGetRssFeeds.mockResolvedValue([])

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(body.timings).toBeDefined()
    expect(typeof body.timings.total).toBe('number')
  })
})
