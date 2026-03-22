import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetFirecrawlSources, mockSanitizeImageUrl, mockFrom } = vi.hoisted(() => ({
  mockGetFirecrawlSources: vi.fn(),
  mockSanitizeImageUrl: vi.fn((url: string) => url || ''),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/news/news-sources', () => ({
  getFirecrawlSources: mockGetFirecrawlSources,
  sanitizeImageUrl: mockSanitizeImageUrl,
}))

vi.mock('@/lib/news/counties', () => ({
  getCountyIds: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

// Mock p-retry to just call the function directly
vi.mock('p-retry', () => ({
  default: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}))

import { GET } from './route'

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/news/scrape-firecrawl', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

function setupSupabaseMocks() {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  const mockInsertSelect = vi.fn().mockResolvedValue({ data: { id: 'art-new' }, error: null })
  const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockInsertSelect }) })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'sources') return { upsert: mockUpsert }
    return { select: mockSelect, insert: mockInsert }
  })
}

describe('GET /api/news/scrape-firecrawl — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'secret'
  })

  it('returns 401 when auth header is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when auth header is wrong', async () => {
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/news/scrape-firecrawl — no sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'secret'
    setupSupabaseMocks()
  })

  it('returns ok:true with empty results when no firecrawl sources', async () => {
    mockGetFirecrawlSources.mockResolvedValue([])

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.results).toEqual({})
  })

  it('includes timings in response', async () => {
    mockGetFirecrawlSources.mockResolvedValue([])

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(body.timings).toBeDefined()
    expect(typeof body.timings.total).toBe('number')
  })
})

describe('GET /api/news/scrape-firecrawl — with sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'secret'
  })

  afterEach(() => vi.unstubAllGlobals())

  it('skips source with no URL', async () => {
    mockGetFirecrawlSources.mockResolvedValue([
      { sourceId: 'src-1', sourceName: 'Source 1', url: null },
    ])
    setupSupabaseMocks()

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results['src-1'].loaded).toBe(0)
  })

  it('scrapes articles from a source', async () => {
    mockGetFirecrawlSources.mockResolvedValue([
      { sourceId: 'crenews', sourceName: 'CRE News', url: 'https://crenews.com' },
    ])
    setupSupabaseMocks()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              json: {
                articles: [
                  {
                    url: 'https://crenews.com/article-1',
                    title: 'Multifamily Deal Closed',
                    description: 'A deal was closed',
                    date: '2026-03-01',
                    imageUrl: null,
                  },
                ],
              },
            },
          }),
      })
    )

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    // 1 article scraped and saved
    expect(body.results['crenews'].loaded).toBe(1)
  })

  it('handles firecrawl API error gracefully (returns 0 for that source)', async () => {
    mockGetFirecrawlSources.mockResolvedValue([
      { sourceId: 'bad-src', sourceName: 'Bad Source', url: 'https://bad.example.com' },
    ])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results['bad-src'].loaded).toBe(0)
  })
})
