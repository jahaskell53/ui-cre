import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetLinkedInProfiles,
  mockGenerateArticleTitles,
  mockGetCountyCategories,
  mockGetCityCategories,
  mockGetArticleTags,
  mockGetCountyIds,
  mockFrom,
  mockApifyCall,
  mockApifyListItems,
} = vi.hoisted(() => ({
  mockGetLinkedInProfiles: vi.fn(),
  mockGenerateArticleTitles: vi.fn(),
  mockGetCountyCategories: vi.fn(),
  mockGetCityCategories: vi.fn(),
  mockGetArticleTags: vi.fn(),
  mockGetCountyIds: vi.fn(),
  mockFrom: vi.fn(),
  mockApifyCall: vi.fn(),
  mockApifyListItems: vi.fn(),
}))

vi.mock('@/lib/news/news-sources', () => ({
  getLinkedInProfiles: mockGetLinkedInProfiles,
}))

vi.mock('@/lib/news/categorization', () => ({
  generateArticleTitles: mockGenerateArticleTitles,
  getCountyCategories: mockGetCountyCategories,
  getCityCategories: mockGetCityCategories,
  getArticleTags: mockGetArticleTags,
}))

vi.mock('@/lib/news/counties', () => ({
  getCountyIds: mockGetCountyIds,
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

vi.mock('apify-client', () => ({
  ApifyClient: vi.fn().mockImplementation(() => ({
    actor: vi.fn().mockReturnValue({ call: mockApifyCall }),
    dataset: vi.fn().mockReturnValue({ listItems: mockApifyListItems }),
  })),
}))

import { GET } from './route'

function makeRequest(authHeader?: string) {
  return new NextRequest('http://localhost/api/news/scrape-linkedin', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

function setValidEnv() {
  process.env.CRON_SECRET = 'secret'
  process.env.APIFY_TOKEN = 'apify-token'
  process.env.LINKEDIN_COOKIES = JSON.stringify([{ name: 'li_at', value: 'test' }])
}

function clearEnv() {
  delete process.env.CRON_SECRET
  delete process.env.ADMIN_SECRET
  delete process.env.APIFY_TOKEN
  delete process.env.LINKEDIN_COOKIES
}

describe('GET /api/news/scrape-linkedin — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setValidEnv()
  })

  it('returns 500 when neither ADMIN_SECRET nor CRON_SECRET is set', async () => {
    clearEnv()
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
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

describe('GET /api/news/scrape-linkedin — config errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setValidEnv()
  })

  it('returns 500 when APIFY_TOKEN is not set', async () => {
    delete process.env.APIFY_TOKEN
    const res = await GET(makeRequest('Bearer secret'))
    expect(res.status).toBe(500)
  })

  it('returns 500 when LINKEDIN_COOKIES is not set', async () => {
    delete process.env.LINKEDIN_COOKIES
    const res = await GET(makeRequest('Bearer secret'))
    expect(res.status).toBe(500)
  })

  it('returns 500 when LINKEDIN_COOKIES is invalid JSON', async () => {
    process.env.LINKEDIN_COOKIES = 'not-json'
    const res = await GET(makeRequest('Bearer secret'))
    expect(res.status).toBe(500)
  })

  it('returns 500 when no LinkedIn profiles are configured', async () => {
    mockGetLinkedInProfiles.mockResolvedValue([])
    const res = await GET(makeRequest('Bearer secret'))
    expect(res.status).toBe(500)
  })
})

describe('GET /api/news/scrape-linkedin — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setValidEnv()
  })

  it('scrapes profiles and saves articles', async () => {
    mockGetLinkedInProfiles.mockResolvedValue([
      { url: 'https://linkedin.com/in/johndoe' },
    ])
    mockApifyCall.mockResolvedValue({ id: 'run-1', defaultDatasetId: 'dataset-1' })
    mockApifyListItems.mockResolvedValue({
      items: [
        {
          title: 'Multifamily sale in Boston',
          text: 'A deal was just closed',
          url: 'https://linkedin.com/posts/johndoe-1',
          timeSincePosted: '2h',
          author: { firstName: 'John', lastName: 'Doe' },
        },
      ],
    })
    mockGenerateArticleTitles.mockResolvedValue({
      titles: ['CRE Deal Closed'],
      descriptions: ['A major deal was closed in Boston'],
    })
    mockGetCountyCategories.mockResolvedValue([['Suffolk']])
    mockGetCityCategories.mockResolvedValue([['Boston']])
    mockGetArticleTags.mockResolvedValue([['multifamily']])
    mockGetCountyIds.mockResolvedValue(['county-1'])

    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'art-1' }, error: null })
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockInsertSingle }),
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'sources') return { upsert: mockUpsert }
      return { select: mockSelect, insert: mockInsert, upsert: mockUpsert }
    })

    const res = await GET(makeRequest('Bearer secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.articlesSaved).toBe(1)
    expect(body.profilesScraped).toBe(1)
  })
})
